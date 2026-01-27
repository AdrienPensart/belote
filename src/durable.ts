import { DurableObject } from 'cloudflare:workers';
import { AlarmEvent, FullTable, GameHistory, GameMode, Stat, User } from './db/schema.types';
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { GameService } from './services/GameService';
import { UserService } from './services/UserService';
import { migrate } from 'drizzle-orm/durable-sqlite/migrator';
import migrations from '../drizzle/migrations';
import * as schema from './db/schema';

type Sessions = Map<WebSocket, { [key: string]: string }>;
const REPEAT_ALARM_TIMER = 3600000;
export class MyDurableObject extends DurableObject<Env> {
	sessions: Sessions;
	storage: DurableObjectStorage;
  	db: DrizzleSqliteDODatabase<any>;
	gameService: GameService;
	userService: UserService;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.storage = ctx.storage;
    	this.db = drizzle(this.storage, { schema, logger: false });
		this.sessions = new Map<WebSocket, { [key: string]: string }>();
		this.gameService = new GameService(this.db);
		this.userService = new UserService(this.db);
		ctx.blockConcurrencyWhile(async () => {
			await this._migrate();
			let currentAlarm = await this.storage.getAlarm();
			if (currentAlarm != null && currentAlarm < Date.now()) {
				await this.alarm();
			}
		});
	}
	async _migrate() {
		await migrate(this.db, migrations);
	}

	async getStats(user: User) : Promise<Stat[]> {
		return await this.gameService.getStats(user);
	}

	async getHistory(user: User, limit: number = 50): Promise<GameHistory[]> {
		return await this.gameService.getHistory(user, limit);
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
	async getGameModes(): Promise<GameMode[]> {
		return await this.gameService.getGameModes();
	}
	async createManualTable(pseudos: string[], gameMode: GameMode) {
		return await this.gameService.createManualTable(pseudos,gameMode);
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
		await this.ctx.storage.put("timerGameLaunchScheduledAt", triggerAt);
		await this.scheduleEvent('timerGameLaunch', triggerAt);
	}

	async scheduleEvent(id: string, runAt: number, repeatMs: number | undefined = undefined) {
		await this.ctx.storage.put(`event:${id}`, { id, runAt, repeatMs });
		const currentAlarm = await this.ctx.storage.getAlarm();
		if (!currentAlarm || runAt < currentAlarm) {
			await this.ctx.storage.setAlarm(runAt);
		}
	}

	async timeLeftUntilAlarm(): Promise<number> {
		const events: Map<string,AlarmEvent> = await this.ctx.storage.list({ prefix: "event:" });
		if (events.get('event:repeatTimer1Hour') === undefined) {
			await this.scheduleEvent('repeatTimer1Hour', Date.now()+REPEAT_ALARM_TIMER, REPEAT_ALARM_TIMER);
		}
		const timerScheduledAt = await this.ctx.storage.get<number>("timerGameLaunchScheduledAt");

		if (!timerScheduledAt) return -1;             // no alarm set

		const now = Date.now();
		const msLeft = timerScheduledAt - now;

		const secondsLeft = Math.max(0, Math.floor(msLeft / 1000));  
  		return secondsLeft;
	}

	async removeTimer() {
		await this.ctx.storage.delete(`event:timerGameLaunch`);
		await this.ctx.storage.delete("timerGameLaunchScheduledAt");
	}

	async alarm() {
		const now = Date.now();
		const events: Map<string,AlarmEvent> = await this.ctx.storage.list({ prefix: "event:" });
		let nextAlarm = null;

		for (const [key, event] of events) {
			if (event.runAt <= now) {
				await this.processEvent(event);
				if (event.repeatMs) {
					event.runAt = now + event.repeatMs;
					await this.ctx.storage.put(key, event);
				} else {
					await this.ctx.storage.delete(key);
				}
			}
			// Track the next event time
			if (event.runAt > now && (!nextAlarm || event.runAt < nextAlarm)) {
				nextAlarm = event.runAt;
			}
		}

		if (nextAlarm) await this.ctx.storage.setAlarm(nextAlarm);
	}
	async processEvent(event: AlarmEvent) {
		console.log(`Processing event ${event.id}`);
		switch(event.id) {
			case 'timer':
				await this.adminGenerateTables();
				await this.ctx.storage.delete("timerGameLaunchScheduledAt");
				break;
			case 'repeatTimer1Hour':
				await this.gameService.removeDisconnectedUsers();
				break;
		}
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

	async swapPeople(pseudos: string[]) {
		await this.gameService.swapPeople(pseudos);
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
