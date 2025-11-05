import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { log } from 'node:console';

class User {
	name!: string;
	joinedAt!: number;
	lastActiveAt!: number;
	ip!: string;

	constructor(name: string, ip: string) {
		this.name = name;
		this.joinedAt = Date.now();
		this.lastActiveAt = this.joinedAt;
		this.ip = ip;
	}
}

export interface Env {
	USER: string;
	PASSWORD: string;
	MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
}
const BASIC_USER = 'admin';
const BASIC_PASS = 'password';

function shuffleArray<T>(array: T[]): T[] {
	const newArray = [...array]; // Create a shallow copy to avoid modifying the original array
	let currentIndex = newArray.length;
	let randomIndex: number;

	// While there remain elements to shuffle.
	while (currentIndex !== 0) {
		// Pick a remaining element.
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[newArray[currentIndex], newArray[randomIndex]] = [newArray[randomIndex], newArray[currentIndex]];
	}

	return newArray;
}

function replacer(key: string, value: any): any {
	if (value instanceof Map) {
		return Array.from(value.values());
	}
	return value;
}

type Tables = Map<string, Map<string, User>>;

export class MyDurableObject extends DurableObject<Env> {
	tables!: Tables;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		ctx.blockConcurrencyWhile(async () => {
			this.tables = (await ctx.storage.get('tables')) || new Map();
			let changed = false;
			this.tables.forEach((table, _) => {
				table.forEach((user, username) => {
					if (user.ip === 'unknown' || !user.ip) {
						table.delete(username);
						changed = true;
					}
				});
			});
			if (changed) {
				await ctx.storage.put('tables', this.tables);
			}
		});
	}

	async finish(username: string, ip?: string): Promise<boolean> {
		this.tables = (await this.ctx.storage.get('tables')) || new Map();
		let found = false;
		let oldTableName: string = '';
		this.tables.forEach((table, tableName) => {
			let user = table.get(username);
			if (user === undefined) {
				return;
			}

			if (ip !== undefined) {
				if (ip != user.ip) {
					return false;
				}
			}

			found = true;
			if (tableName != 'panama') {
				oldTableName = tableName;
			}
			table.delete(username);
			let panamaTable = this.tables.get('panama') || new Map();
			panamaTable.set(username, user);
		});

		if (!found) {
			return false;
		}

		if (oldTableName.length === 0) {
			await this.ctx.storage.put('tables', this.tables);
			return true;
		}

		let oldTable = this.tables.get(oldTableName);
		if (oldTable === undefined) {
			await this.ctx.storage.put('tables', this.tables);
			return true;
		}

		let panamaTable = this.tables.get('panama') || new Map();
		for (let user of oldTable.values()) {
			panamaTable.set(user.name, user);
		}
		this.tables.set('panama', panamaTable);
		this.tables.delete(oldTableName);
		await this.ctx.storage.put('tables', this.tables);
		return true;
	}
	async quit(username: string, ip?: string): Promise<boolean> {
		this.tables = (await this.ctx.storage.get('tables')) || new Map();
		let found = false;
		let oldTableName: string = '';
		this.tables.forEach((table, tableName) => {
			let user = table.get(username);
			if (user === undefined) {
				return;
			}

			if (ip !== undefined) {
				if (ip != user.ip) {
					return;
				}
			}

			found = true;
			if (tableName != 'panama') {
				oldTableName = tableName;
			}
			table.delete(username);
		});

		if (!found) {
			return false;
		}

		if (oldTableName.length === 0) {
			await this.ctx.storage.put('tables', this.tables);
			return true;
		}

		let oldTable = this.tables.get(oldTableName);
		if (oldTable === undefined) {
			await this.ctx.storage.put('tables', this.tables);
			return true;
		}

		let panamaTable = this.tables.get('panama') || new Map();
		for (let user of oldTable.values()) {
			panamaTable.set(user.name, user);
		}

		this.tables.set('panama', panamaTable);
		this.tables.delete(oldTableName);
		await this.ctx.storage.put('tables', this.tables);
		return true;
	}

	async join(username: string, ip: string): Promise<void> {
		this.tables = (await this.ctx.storage.get('tables')) || new Map();

		let existed = false;
		this.tables.forEach((table, _) => {
			if (table.has(username)) {
				const user = table.get(username);
				if (user) {
					user.ip = ip;
					user.lastActiveAt = Date.now();
					existed = true;
				}
			}
		});

		if (!existed) {
			const user = new User(username, ip);
			let table = this.tables.get('panama');
			if (!table) {
				table = new Map<string, User>();
				this.tables.set('panama', table);
			}
			table.set(username, user);
			console.log(`User ${username} joined with IP ${ip}`);
		} else {
			console.log(`User ${username} already exists, updated last active time and IP`);
		}
		await this.ctx.storage.put('tables', this.tables);
	}
	private async assignTable(tableName: string, users: User[]): Promise<void> {
		this.tables = (await this.ctx.storage.get('tables')) || new Map();
		let table = this.tables.get(tableName);
		if (!table) {
			table = new Map<string, User>();
			this.tables.set(tableName, table);
		}

		for (let user of users) {
			table.set(user.name, user);
		}
		await this.ctx.storage.put('tables', this.tables);
	}
	async getTables(): Promise<string> {
		this.tables = (await this.ctx.storage.get('tables')) || new Map();
		console.log('Tables:', this.tables);
		let pretty = JSON.stringify(Object.fromEntries(this.tables), replacer, 2);
		console.log('Pretty Tables:', pretty);
		return pretty;
	}
	async deleteTables(): Promise<void> {
		await this.ctx.storage.delete('tables');
		this.tables = new Map();
	}
	async generateTables() {
		this.tables = (await this.ctx.storage.get('tables')) || new Map();
		let users: User[] = [];
		this.tables.forEach((table, _) => {
			table.forEach((user, _) => {
				users.push(user);
			});
		});

		users = shuffleArray(users);
		this.tables = new Map();
		await this.ctx.storage.put('tables', this.tables);

		let tableIndex = 1;

		while (users.length > 0) {
			if (users.length == 7) {
				let tableDe7 = users.splice(0, 7);
				await this.assignTable('table-de-7', tableDe7);
				break;
			} else if (users.length == 6) {
				let tableDe6 = users.splice(0, 6);
				await this.assignTable('table-de-6', tableDe6);
				break;
			} else if (users.length == 5) {
				let tableDe5 = users.splice(0, 5);
				await this.assignTable('table-de-5', tableDe5);
				break;
			} else if (users.length == 3) {
				let tableDe3 = users.splice(0, 3);
				await this.assignTable('panama', tableDe3);
				break;
			} else if (users.length == 2) {
				let tableDe2 = users.splice(0, 2);
				await this.assignTable('panama', tableDe2);
				break;
			} else if (users.length == 1) {
				let tableDe1 = users.splice(0, 1);
				await this.assignTable('panama', tableDe1);
				break;
			}
			let tableDe4 = users.splice(0, 4);
			await this.assignTable(`table-${tableIndex}`, tableDe4);
			tableIndex++;
		}
	}
	async clearDo(): Promise<void> {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
		this.tables = new Map();
	}
	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.ctx.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		ws.send(`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`);
	}
	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		ws.close(code, 'Durable Object is closing WebSocket');
	}
}

export default {
	async fetch(request: Request, env: Env, _ctx): Promise<Response> {
		const url = new URL(request.url);
		const success = {
			status: 200,
			headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' },
		};
		const stub = env.MY_DURABLE_OBJECT.getByName('belote');
		if (!stub) {
			return new Response('Durable Object not found', { status: 500 });
		}
		switch (url.pathname) {
			case '/users/join':
				const username = url.searchParams.get('username');
				if (!username) {
					return new Response('Missing username', { status: 400 });
				}
				const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
				await stub.join(username, ip);
				return new Response('🎉 User joined!', success);
			case '/tables': {
				const tables = await stub.getTables();
				return new Response(tables, success);
			}
			case '/meltdown': {
				return stub.fetch(request);
			}
			case '/me/quit': {
				const username = url.searchParams.get('username');
				if (!username) {
					return new Response('Missing username', { status: 400 });
				}
				const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
				const moved = await stub.quit(username, ip);
				if (moved) {
					return new Response(`🎉 User ${username} left!`, success);
				} else {
					return new Response(`User ${username} not found or not authorized`, { status: 404 });
				}
			}
			case '/me/finish': {
				const username = url.searchParams.get('username');
				if (!username) {
					return new Response('Missing username', { status: 400 });
				}
				const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
				const moved = await stub.finish(username, ip);
				if (moved) {
					return new Response(`🎉 User ${username} moved!`, success);
				} else {
					return new Response(`User ${username} not found or not authorized`, { status: 404 });
				}
			}

			// NEEDS AUTH
			case '/users/delete': {
				return authenticate(request, env, async () => {
					const username = url.searchParams.get('username');
					if (!username) {
						return new Response('Missing username', { status: 400 });
					}
					const deleted = await stub.quit(username, undefined);
					if (deleted) {
						return new Response(`🎉 User ${username} deleted!`, success);
					} else {
						return new Response(`User ${username} not found`, { status: 404 });
					}
				});
			}
			case '/users/load_fixtures': {
				return authenticate(request, env, async () => {
					const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
					const fixtureUsers = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace', 'heidi', 'ivan', 'judy', 'seb'];
					for (let username of fixtureUsers) {
						await stub.join(username, ip);
					}
					return new Response('🎉 Fixture users loaded!', success);
				});
			}
			case '/users/clear': {
				return authenticate(request, env, async () => {
					await stub.clearDo();
					return new Response('🎉 All users cleared!', success);
				});
			}
			case '/tables/clear': {
				return authenticate(request, env, async () => {
					const tables = await stub.deleteTables();
					return new Response('🎉 Tables cleared', success);
				});
			}
			case '/tables/generate': {
				return authenticate(request, env, async () => {
					await stub.generateTables();
					return new Response('🎉 New tables generated', success);
				});
			}
			default:
				return new Response('not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;

async function authenticate(request: Request, env: Env, operation: () => Promise<Response>): Promise<Response> {
	const mustLoginResponse = new Response('you need to login', {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="my scope", charset="UTF-8"' },
	});

	const realUser = env.USER ?? BASIC_USER;
	const realPassword = env.PASSWORD ?? BASIC_PASS;
	const authorization = request.headers.get('Authorization');
	if (!authorization) {
		return mustLoginResponse;
	}
	const [scheme, encoded] = authorization.split(' ');

	if (!encoded || scheme !== 'Basic') {
		return new Response('malformed authorization header', {
			status: 400,
		});
	}

	const credentials = Buffer.from(encoded, 'base64').toString();
	const index = credentials.indexOf(':');
	const user = credentials.substring(0, index);
	const pass = credentials.substring(index + 1);
	if (realUser != user || realPassword != pass) {
		return mustLoginResponse;
	}

	return await operation();
}
