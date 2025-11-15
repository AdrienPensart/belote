import { MyDurableObject } from './durable';
import { authenticate } from './helpers';

export interface Env {
	AUTHENTICATION: string;
	ADMIN_USER: string;
	ADMIN_PASSWORD: string;
	PLAYERS: string;
	MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
}

const success = {
	status: 200,
	headers: {
		'Content-Type': 'application/json;charset=utf-8',
		'Cache-Control': 'no-store',
	},
};
const IP_HEADER = 'CF-Connecting-IP';
export { MyDurableObject };

export default {
	async fetch(request: Request, env: Env, _ctx): Promise<Response> {
		const url = new URL(request.url);
		const internalError = new Response(`internal error`, { status: 500 });
		const unauthorizedError = new Response(`unauthorized`, { status: 401 });
		const missingUsername = new Response('missing username', { status: 400 });
		const unchanged = new Response(null, { status: 304 });
		const ip = request.headers.get(IP_HEADER) || 'unknown';
		const username = url.searchParams.get('username');

		const stub = env.MY_DURABLE_OBJECT.getByName('belote');
		if (!stub) {
			return new Response('Durable Object not found', { status: 500 });
		}
		switch (url.pathname) {
			// global and unauthenticated
			case '/public/tables': {
				const tables = await stub.getTables();
				return new Response(tables, success);
			}

			// for users
			case '/me/ready': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.setUserReadyOrNot(username, true, ip)) {
					await stub.notifyAll(`user ${username} ready!`);
				}
				return new Response('🎉 User ready!', success);
			}
			case '/me/toggleCanPlayTwoTables': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.toggleCanPlayTwoTables(username, ip)) {
					await stub.notifyAll(`user ${username} toggleCanPlayTwoTables!`);
				}
				return new Response('🎉 User ready!', success);
			}
			case '/me/toggleCanPlayTarot': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.toggleCanPlayTarot(username, ip)) {
					await stub.notifyAll(`user ${username} toggleCanPlayTarot!`);
				}
				return new Response('🎉 User ready!', success);
			}
			case '/me/join': {
				if (!username) {
					return missingUsername;
				}
				const join = await stub.join(username, ip);
				if (join) {
					await stub.notifyAll(`user ${username} joined the Meltdown`);
					return new Response('🎉 User joined!', success);
				}
				return unchanged;
			}
			case '/me/meltdown': {
				if (!username) {
					return missingUsername;
				}
				const response = stub.fetch(request);
				console.log(`user ${username} connected to Meltdown room`);
				return response;
			}
			case '/me/quit': {
				if (!username) {
					return missingUsername;
				}
				const quit = await stub.quit(username, ip);
				if (quit) {
					await stub.notifyAll(`user ${username} quit the Meltdown`);
					return new Response(`🎉 User ${username} left!`, success);
				} else {
					return new Response(`User ${username} not found or not authorized`, { status: 404 });
				}
			}
			case '/me/finish': {
				if (!username) {
					return missingUsername;
				}
				const code = await stub.finish(username, ip);
				switch (code) {
					case 401:
						return unauthorizedError;
					case 404:
						return new Response(`User ${username} not found`, { status: 404 });
					case 304:
						return unchanged;
					case 200:
						await stub.notifyAll(`user ${username} and its friends at the same table finished their game`);
						return new Response(`🎉 User ${username} moved!`, success);
					default:
						return internalError;
				}
			}

			// ADMIN with username param
			case '/admin/users/join': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const join = await stub.join(username, undefined);
					if (join) {
						await stub.notifyAll(`user ${username} joined`);
						return new Response(`🎉 User ${username} joined!`, success);
					}
					return unchanged;
				});
			}
			case '/admin/users/toggleCanPlayTarot': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const found = await stub.toggleCanPlayTarot(username);
					if (found) {
						await stub.notifyAll(`user ${username} toggleCanPlayTarot!`);
						return new Response(`🎉 User ${username} toggleCanPlayTarot!`, success);
					} else {
						return new Response(`User ${username} not found`, { status: 404 });
					}
				});
			}
			case '/admin/users/toggleCanPlayTwoTables': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const found = await stub.toggleCanPlayTwoTables(username);
					if (found) {
						await stub.notifyAll(`user ${username} toggleCanPlayTwoTables!`);
						return new Response(`🎉 User ${username} toggleCanPlayTwoTables!`, success);
					} else {
						return new Response(`User ${username} not found`, { status: 404 });
					}
				});
			}
			case '/admin/users/ready': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const found = await stub.setUserReadyOrNot(username, true, undefined);
					if (found) {
						await stub.notifyAll(`user ${username} ready`);
						return new Response(`🎉 User ${username} ready!`, success);
					} else {
						return new Response(`User ${username} not found`, { status: 404 });
					}
				});
			}
			case '/admin/users/notready': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const ready = await stub.setUserReadyOrNot(username, false, undefined);
					if (ready) {
						await stub.notifyAll(`user ${username} NOT ready`);
						return new Response(`🎉 User ${username} NOT ready!`, success);
					} else {
						return new Response(`User ${username} not found`, { status: 404 });
					}
				});
			}
			case '/admin/users/delete': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const deleted = await stub.quit(username, undefined);
					if (deleted) {
						await stub.notifyAll(`user ${username} deleted from Meltdown`);
						return new Response(`🎉 User ${username} deleted!`, success);
					} else {
						return new Response(`User ${username} not found`, { status: 404 });
					}
				});
			}
			case '/admin/users/finish': {
				return authenticate(request, env, async () => {
					if (!username) {
						return missingUsername;
					}
					const code = await stub.finish(username, undefined);
					switch (code) {
						case 404:
							return new Response(`User ${username} not found`, { status: 404 });
						case 304:
							return unchanged;
						case 200:
							await stub.notifyAll(`user ${username} finished its game`);
							return new Response(`🎉 User ${username} finished its game!`, success);
						default:
							return internalError;
					}
				});
			}

			// ADMIN without username param
			case '/admin/users': {
				return authenticate(request, env, async () => {
					const users = await stub.getUsers();
					return new Response(users, success);
				});
			}
			case '/admin/notify': {
				return authenticate(request, env, async () => {
					await stub.notifyAll('force notify all');
					return new Response(`🎉 Users notified!`, success);
				});
			}
			case '/admin/users/fixtures': {
				return authenticate(request, env, async () => {
					const players = JSON.parse(env.PLAYERS);
					for (let username of players.usernames) {
						await stub.join(username, undefined);
					}
					await stub.notifyAll('fixtures loaded');
					return new Response('🎉 Fixture users loaded!', success);
				});
			}
			case '/admin/tables/delete': {
				return authenticate(request, env, async () => {
					const table = url.searchParams.get('table');
					if (!table) {
						return new Response('missing table name', { status: 400 });
					}
					console.log(table);
					const deleted = await stub.adminDeleteTable(table);
					if (!deleted) {
						return unchanged;
					}
					await stub.notifyAll('table deleted');
					return new Response('🎉 table deleted!', success);
				});
			}
			case '/admin/tables/notready': {
				return authenticate(request, env, async () => {
					const table = url.searchParams.get('table');
					if (!table) {
						return new Response('missing table name', { status: 400 });
					}
					console.log(table);
					const notReady = await stub.adminTableNotReady(table);
					if (!notReady) {
						return unchanged;
					}
					await stub.notifyAll('table not ready');
					return new Response('🎉 table not ready!', success);
				});
			}
			case '/admin/tables/ready': {
				return authenticate(request, env, async () => {
					const table = url.searchParams.get('table');
					if (!table) {
						return new Response('missing table name', { status: 400 });
					}
					console.log(table);
					const ready = await stub.adminTableReady(table);
					if (!ready) {
						return unchanged;
					}
					await stub.notifyAll('table ready');
					return new Response('🎉 table ready!', success);
				});
			}
			case '/admin/tables/clear': {
				return authenticate(request, env, async () => {
					if (await stub.adminDeleteAllTables()) {
						await stub.notifyAll(`tables cleared`);
					}
					return new Response('🎉 Tables cleared', success);
				});
			}
			case '/admin/tables/generate': {
				return authenticate(request, env, async () => {
					if (await stub.adminGenerateTables()) {
						await stub.notifyAll(`tables generated`);
					}
					return new Response('🎉 New tables generated', success);
				});
			}
			case '/admin/tables/shuffle': {
				return authenticate(request, env, async () => {
					if (await stub.adminShuffleTables()) {
						await stub.notifyAll(`tables shuffled`);
					}
					return new Response('🎉 Tables shuffled', success);
				});
			}
			case '/admin/meltdown': {
				return authenticate(request, env, async () => {
					const response = stub.fetch(request);
					console.log('admin user connected to room');
					return response;
				});
			}
			// case '/admin/storage/delete': {
			// 	return authenticate(request, env, async () => {
			// 		await stub.clearDo();
			// 		await stub.notifyAll('users deleted');
			// 		return new Response('🎉 All users cleared!', success);
			// 	});
			// }
			default:
				return new Response('not found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
