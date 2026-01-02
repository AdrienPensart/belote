import { DurableObject } from 'cloudflare:workers';
import { FullTable, Stat, User } from './db/schema.types';
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { GameService } from './services/GameService';
import { UserService } from './services/UserService';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import migrations from '../drizzle/migrations';
import * as schema from './db/schema';

type Sessions = Map<WebSocket, { [key: string]: string }>;

export class MyDurableObject extends DurableObject<Env> {
	sessions: Sessions;
	storage: DurableObjectStorage;
  	db: DrizzleSqliteDODatabase<any>;
	gameService: GameService;
	userService: UserService;
	alarmTime: number | null; 
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.storage = ctx.storage;
    	this.db = drizzle(this.storage, { schema, logger: false });
		this.sessions = new Map<WebSocket, { [key: string]: string }>();
		this.gameService = new GameService(this.db);
		this.userService = new UserService(this.db);
		this.alarmTime = 0;
		ctx.blockConcurrencyWhile(async () => {
			await this._migrate();
			this.alarmTime = await ctx.storage.getAlarm();
		});
	}
	async _migrate() {
		await migrate(this.db, migrations);
	}

	async getStats(user: User) : Promise<Stat[]> {
		return await this.gameService.getStats(user);
	}
	
	async passwordChange(request: Request, pseudo:string, admin: boolean): Promise<Response> {
		return this.userService.passwordChange(request, pseudo,admin);
	}
	async createAccount(request: Request): Promise<Response> {
		return this.userService.createAccount(request);
	}
	async authenticate(request: Request): Promise<Response> {
		const user = await this.userService.authenticate(request);
		if (!user) {
			return new Response('you need to login', {
            	status: 401,
        	});
		}
		await this.gameService.addUserToTable(user, (await this.gameService.getPanamaTable()).table.id);
		const token = Buffer.from(user.token!!).toString('base64');
		const response = new Response(token, {
            status: 200,
        });
		response.headers.set('Authorization',token);
		return response;
	}
	async validateToken(token: string | undefined, admin: Boolean = false): Promise<User | Response> {
		return this.userService.validateToken(token,admin);
	}
	async changeUserState(request: Request, pseudo:string) {
		await this.userService.changeUserState(request, pseudo);
	}
	async quit(pseudo: string) {
		const userId = await this.userService.quit(pseudo);
		return await this.gameService.quit(userId);
	}
	async finish(tableId: number, winningTeam: string, pseudo: string | undefined) {
		return await this.gameService.finish(tableId, winningTeam, pseudo);
	}
	async deleteTable(tableId: number) {
		return await this.gameService.deleteTable(tableId);
	}

	

	// for admin exclusively
	async addTimer(request: Request) {
		const body: {minutes: number} = await request.json();
		const triggerAt = Date.now() + body.minutes * 60 * 1000;
		await this.ctx.storage.setAlarm(triggerAt);
		await this.ctx.storage.put("scheduledAt", triggerAt);
		this.alarmTime = triggerAt;
	}

	async timeLeftUntilAlarm(): Promise<number> {
		const scheduledAt = await this.ctx.storage.get<number>("scheduledAt");

		if (!scheduledAt) return -1;             // no alarm set

		const now = Date.now();
		const msLeft = scheduledAt - now;

		const secondsLeft = Math.max(0, Math.floor(msLeft / 1000));  
  		return secondsLeft;
	}

	async removeTimer() {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.delete("scheduledAt");
	}

	async alarm() {
		console.log("Alarm executed at", Date.now());

		await this.adminGenerateTables();
	}
	async getUserList(){
		return await this.userService.getUserList();
	}
	async adminGenerateTables() {
		await this.gameService.generateTables();
	}

	async adminDeleteAllTables() {
		const allTables = await this.gameService.getTables();
		const panamaTable = await this.gameService.getPanamaTable();
		for (const fullTable of allTables.filter((fullTable) => fullTable.table.id !== panamaTable.table.id)) {
			await this.gameService.deleteTable(fullTable.table.id);
		}
	}

	async adminShuffleTables() {
		// clear all tables
		await this.adminDeleteAllTables();

		// regenerate
		await this.adminGenerateTables();
	}

	async changeReadyState(request: Request) {
		await this.gameService.changeReadyState(request);
	}

	async getTables(): Promise<FullTable[]> {
		return this.gameService.getTables();
	}
	async notifyAll(reason: string) {
		this.sessions.forEach((_, session) => {
			session.send(`you must refresh tables because: ${reason}`);
		});
	}
	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		const id = crypto.randomUUID();
		this.sessions.set(server, { id });
		server.addEventListener('close', () => {
			this.sessions.delete(server);
		});
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}
