import { DurableObject } from 'cloudflare:workers';
import { replacer, shuffleArray } from './helpers';
import { User, UserAndTable, setReadyOrNot, setIp, setActivity, setNotReady, toggleCanPlayTarot, toggleCanPlayTwoTables } from './user';

type Sessions = Map<WebSocket, { [key: string]: string }>;
const DEFAULT_TABLE = 'panama';
type Table = Map<string, User>;
type Tables = Map<string, Table>;

export class MyDurableObject extends DurableObject<Env> {
	sessions: Sessions;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Map<WebSocket, { [key: string]: string }>();
	}
	async finish(username: string, ip?: string): Promise<number> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return 304;
		}

		let panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
		let foundUserTable: UserAndTable | undefined;

		outerLoop: for (const [tableName, users] of tables) {
			innerLoop: for (const [_, user] of users) {
				if (user.name != username) {
					continue innerLoop;
				}
				if (ip !== undefined && ip != user.ip) {
					return 401;
				}

				console.log(`user ${user.name} found on table ${tableName}`);
				foundUserTable = new UserAndTable(tableName, user);

				if (tableName != DEFAULT_TABLE) {
					setNotReady(user);
					users.delete(username);
					panamaTable.set(username, user);
				}
				break outerLoop;
			}
		}

		if (!foundUserTable) {
			return 404;
		}

		// don't move panama players
		if (foundUserTable.table == DEFAULT_TABLE) {
			await this.ctx.storage.put('tables', tables);
			return 200;
		}

		let oldTable = tables.get(foundUserTable.table);
		if (oldTable) {
			for (let user of oldTable.values()) {
				setNotReady(user);
				panamaTable.set(user.name, user);
			}
			tables.set(DEFAULT_TABLE, panamaTable);
			tables.delete(foundUserTable.table);
		}
		await this.ctx.storage.put('tables', tables);
		return 200;
	}
	async quit(username: string, ip?: string): Promise<number> {
		let code = await this.finish(username, ip);
		if (code != 200) {
			return code;
		}

		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		let panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
		panamaTable.delete(username);
		await this.ctx.storage.put('tables', tables);
		return 200;
	}
	findUserAndTable(tables: Tables, searchedUsername: string, ip?: string): [Table, User] | undefined{
		outerLoop: for (const [tableName, users] of tables) {
			innerLoop: for (const [username, user] of users) {
				if (username != searchedUsername) {
					continue innerLoop;
				}
				if (ip !== undefined && ip != user.ip) {
					continue innerLoop;
				}
				console.log(`user ${user.name} found on table ${tableName}`);
				return [tables.get(tableName)!, user];
			}
		}
		return undefined;
	}
	async toggleCanPlayTarot(searchedUsername: string, ip?: string): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		let foundResult = this.findUserAndTable(tables, searchedUsername,ip);

		let found = !!foundResult;
		if (foundResult) {
			toggleCanPlayTarot(foundResult[1]);
			if (ip !== undefined) {
				setActivity(foundResult[1]);
			}
			await this.ctx.storage.put('tables', tables);
		}
		return found;
	}
	async toggleCanPlayTwoTables(searchedUsername: string, ip?: string): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		let foundResult = this.findUserAndTable(tables, searchedUsername,ip);

		let found = !!foundResult;
		if (foundResult) {
			toggleCanPlayTwoTables(foundResult[1]);
			if (ip !== undefined) {
				setActivity(foundResult[1]);
			}
			await this.ctx.storage.put('tables', tables);
		}
		return found;
	}
	async setUserReadyOrNot(searchedUsername: string, ready: boolean, ip?: string): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		let foundResult = this.findUserAndTable(tables, searchedUsername,ip);

		let found = !!foundResult;
		if (foundResult) {
			setReadyOrNot(foundResult[1], ready);
			if (ip !== undefined) {
				setActivity(foundResult[1]);
			}
			await this.ctx.storage.put('tables', tables);
		}
		return found;
	}
	async join(newUsername: string, ip: string | undefined): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();

		let existed = false;
		outerLoop: for (const [tableName, users] of tables) {
			innerLoop: for (const [username, user] of users) {
				if (username != newUsername) {
					continue innerLoop;
				}
				if (ip) {
					setIp(user, ip);
				}
				existed = true;
				break outerLoop;
			}
		}

		if (!existed) {
			const user = new User(newUsername, ip);
			let table = tables.get(DEFAULT_TABLE);
			if (!table) {
				table = new Map<string, User>();
				tables.set(DEFAULT_TABLE, table);
			}
			table.set(newUsername, user);
			console.log(`User ${newUsername} joined with IP ${ip}`);
		} else {
			console.log(`User ${newUsername} already exists, updated last active time and maybe IP`);
		}
		await this.ctx.storage.put('tables', tables);
		return !existed;
	}

	// for admin exclusively
	async adminTableReady(tableName: string): Promise<boolean> {
		const tables: Tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		const table = tables.get(tableName);
		if (!table) {
			console.log(`table ${tableName} not found`);
			return false;
		}

		let ready = false;
		for (const [username, user] of table) {
			console.log(`setting table ${tableName} ready for user ${username}`);
			if (!user.ready) {
				setReadyOrNot(user, true);
				ready = true;
			}
		}
		if (ready) {
			await this.ctx.storage.put('tables', tables);
		}
		return ready;
	}
	async adminTableNotReady(tableName: string): Promise<boolean> {
		const tables: Tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		const table = tables.get(tableName);
		if (!table) {
			console.log(`table ${tableName} not found`);
			return false;
		}

		let notReady = false;
		for (const [username, user] of table) {
			console.log(`setting table ${tableName} not ready for user ${username}`);
			if (user.ready) {
				setReadyOrNot(user, false);
				notReady = true;
			}
		}
		if (notReady) {
			await this.ctx.storage.put('tables', tables);
		}
		return notReady;
	}
	async adminGenerateTables(): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		let panamaTable = tables.get(DEFAULT_TABLE);
		if (!panamaTable) {
			panamaTable = new Map();
		}

		let readyUsers: User[] = [];
		for (const [username, user] of panamaTable) {
			if (user.ready) {
				readyUsers.push(user);
				panamaTable.delete(username);
			}
		}

		this.affectTables(tables, shuffleArray(readyUsers), 1);
		await this.ctx.storage.put('tables', tables);
		return true;
	}
	
	affectTables(tables: Tables, users: User[], currentTable:number): void  {
		if (users.length === 0) {
			return;
		}
		var currentTableSize = users.length < 8 ? users.length : (users.length%4) + 4;
		const assignTable = function (tableName: string, users: User[]) {
			let table = tables.get(tableName);
			if (!table) {
				table = new Map<string, User>();
				tables.set(tableName, table);
			}
			for (let user of users) {
				table.set(user.name, user);
			}
		};
		let playersSelected: User[] = [];
		if (currentTableSize <= 3) {
			playersSelected = users;
		} else {
			if (currentTableSize == 5) {
				let tarotPlayers = users.filter((user) => user.canPlayTarot);
				if (tarotPlayers.length >= 5) {
					playersSelected = tarotPlayers.splice(0,5);
				} else {
					// Le pauvre gars seul qui va aller au panama
					playersSelected.push(users[users.length -1]);
				}
			} else {
				if (currentTableSize == 7) {
					let usersThanCanPlayTwoTables = users.filter((user) => user.canPlayTwoTables);
					if (usersThanCanPlayTwoTables.length > 0 ) {
						playersSelected = [usersThanCanPlayTwoTables[0],...users.filter((user) => user.name !== usersThanCanPlayTwoTables[0].name).slice(0,6)];
					} else {
						// 3 pauvres gars seul qui va aller au panama
						playersSelected.push(...users.slice(0,3));
					}
				} else {
					playersSelected = users.splice(0,currentTableSize);
				}
				
			}
		}

		if (playersSelected.length < 4) {
			assignTable(DEFAULT_TABLE,playersSelected);
		} else {
			assignTable(`Table ${currentTable}`,playersSelected);
		}
		
		this.affectTables(tables, users.filter((user) => !playersSelected.find((userSelected) => userSelected.name === user.name)), currentTable+1);
	}

	async adminShuffleTables(): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		let panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();

		// move all ready to panama
		for (const [tableName, table] of tables) {
			if (tableName == DEFAULT_TABLE) {
				continue;
			}
			for (const [username, user] of table) {
				table.delete(username);
				panamaTable.set(username, user);
			}
			tables.delete(tableName);
		}

		await this.ctx.storage.put('tables', tables);

		// regenerate
		return await this.adminGenerateTables();
	}
	async adminDeleteAllTables(): Promise<boolean> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}
		await this.ctx.storage.delete('tables');
		return true;
	}
	async adminDeleteTable(tableName: string): Promise<boolean> {
		if (tableName == DEFAULT_TABLE) {
			return false;
		}
		const tables: Tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		if (tables.size == 0) {
			return false;
		}

		const table = tables.get(tableName);
		if (!table) {
			return false;
		}

		const panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
		for (const [username, user] of table) {
			panamaTable.set(username, user);
		}

		tables.delete(tableName);
		await this.ctx.storage.put('tables', tables);
		return true;
	}

	// no modifying
	async getTables(): Promise<string> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		let pretty = JSON.stringify(Object.fromEntries(tables), replacer, 2);
		return pretty;
	}
	async getUsers(): Promise<string> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		const allUsers: User[] = [];
		for (const [_, users] of tables) {
			allUsers.push(...users.values());
		}
		let pretty = JSON.stringify(allUsers, replacer, 2);
		return pretty;
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
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
	// async clearDo(): Promise<void> {
	// 	await this.ctx.storage.deleteAlarm();
	// 	await this.ctx.storage.deleteAll();
	// }
}
