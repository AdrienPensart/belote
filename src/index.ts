import { MyDurableObject } from './durable';
import { User } from './db/schema.types';
export interface Env {
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
		const stub = env.MY_DURABLE_OBJECT.getByName('belote');
		if (!stub) {
			return new Response(JSON.stringify({ message: 'Durable Object not found' }), { status: 500 });
		}
		if (url.pathname==='/auth') {
			let response = await stub.authenticate(request);
			await stub.notifyAll(`user connected!`);
			return response;
		}
		if (url.pathname==='/createAccount') {
			let response = stub.createAccount(request);
			await stub.notifyAll(`user connected!`);
			return response;
		}
		if (url.pathname.indexOf('favicon') !== -1) {
			return new Response(JSON.stringify({ message: `url ${url} not found` }), { status: 404 });
		}
		let adminAuth = url.pathname.indexOf("/admin/") !== -1;
		const authorization = request.headers.get('Authorization') ?? new URL(request.url).searchParams.get('auth_token')?.trim();
		let userOrResponse = await stub.validateToken(authorization,adminAuth);
		if (userOrResponse instanceof Response) {
			return userOrResponse;
		}
		let user : User = userOrResponse;
		switch (url.pathname) {
			case '/socket': {
				try{
					let response = await stub.fetch(request);
					return response;
				} catch(e) {
					console.log(e);
				}
				
			}
			case '/me': {
				return new Response(JSON.stringify(user));
			}
			case '/passwordChange': {
				return await stub.passwordChange(request, user.pseudo,false);
			}
			case '/user/stats': {
				return new Response(JSON.stringify(await stub.getStats(user)));
			}
			case '/tables': {
				const tables = await stub.getTables();
				return new Response(JSON.stringify(tables), success);
			}
			case '/user/changeUserState': {
				await stub.changeUserState(request,user.pseudo)
				await stub.notifyAll(`user ${user.pseudo} toggleUserState!`);
				return new Response(JSON.stringify({ message: `🎉 User changed state !` }), success);
			}
			case '/user/quit': {
				await stub.quit(user.pseudo);
				await stub.notifyAll(`user ${user.pseudo} disconnected`);
				return new Response(JSON.stringify({ message: `🎉 User ${user.pseudo} disconnected!` }), success);
			}
			case '/user/finish': {
				const winningTeam = url.searchParams.get('winningTeam');
				if (!winningTeam) {
					return new Response(JSON.stringify({ message: 'missing winningTeam' }), { status: 400 });
				}
				if (!url.searchParams.get('tableId')) {
					return new Response(JSON.stringify({ message: 'missing tableId' }), { status: 400 });
				}
				await stub.finish(parseInt(url.searchParams.get('tableId')!!), winningTeam, user.pseudo);
				return new Response('ok', { status: 200 });
			}
			case '/alarm' :{
				return new Response(JSON.stringify({secondsLeft : await stub.timeLeftUntilAlarm()}), { status: 200 });
			}
			case '/admin/alarm/add': {
				await stub.addTimer(request);
				await stub.notifyAll(`Set alarm`);
				return new Response('ok', { status: 200 });
			}
			case '/admin/alarm/delete': {
				await stub.removeTimer();
				await stub.notifyAll(`Removed alarm`);
			}
			case '/admin/users': {
				return new Response(JSON.stringify(await stub.getUserList()), { status: 200 });
			}
			case '/admin/users/toggleUserState': {
				const pseudo = url.searchParams.get('pseudo');
				if (!pseudo) {
					return new Response(JSON.stringify({ message: 'missing pseudo' }), { status: 400 });
				}
				await stub.changeUserState(request, pseudo);
				await stub.notifyAll(`User ${pseudo} changed state`);
				return new Response(JSON.stringify({ message: `🎉 User changed state!` }), success);
			}
			case '/admin/users/passwordChange':
				const pseudo = url.searchParams.get('pseudo');
				if (!pseudo) {
					return new Response(JSON.stringify({ message: 'missing pseudo' }), { status: 400 });
				}
				return await stub.passwordChange(request, pseudo, true);
			case '/admin/users/finish': {
				if (!url.searchParams.get('tableId')) {
					return new Response(JSON.stringify({ message: 'missing tableId' }), { status: 400 });
				}
				const winningTeam = url.searchParams.get('winningTeam');
				if (!winningTeam) {
					return new Response(JSON.stringify({ message: 'missing winningTeam' }), { status: 400 });
				}
				await stub.finish(parseInt(url.searchParams.get('tableId')!!), winningTeam, undefined);
				await stub.notifyAll(`table finished`);
				return new Response('ok', { status: 200 });
			}
			case '/admin/users/quit': {
				const pseudo = url.searchParams.get('pseudo');
				if (!pseudo) {
					return new Response(JSON.stringify({ message: 'missing pseudo' }), { status: 400 });
				}
				await stub.notifyAll(`user ${pseudo} disconnected`);
				await stub.quit(pseudo);
				return new Response('ok', { status: 200 });
			}
			case '/admin/tables/changeReadyState': {
				await stub.changeReadyState(request);
				await stub.notifyAll(`tables ready`);
				return new Response(JSON.stringify({ message: `🎉 Tables ready` }), success);
			}
			case '/admin/tables/delete': {
				if (!url.searchParams.get('tableId')) {
					return new Response(JSON.stringify({ message: 'missing tableId' }), { status: 400 });
				}
				await stub.deleteTable(parseInt(url.searchParams.get('tableId')!!));
				await stub.notifyAll(`table deleted`);
				return new Response(JSON.stringify({ message: `🎉 Table deleted` }), success);
			}
			case '/admin/tables/clear': {
				await stub.adminDeleteAllTables()
				await stub.notifyAll(`tables cleared`);
				return new Response(JSON.stringify({ message: `🎉 Tables cleared` }), success);
			}
			case '/admin/tables/generate': {
				await stub.adminGenerateTables()
				await stub.notifyAll(`tables generated`);
				return new Response(JSON.stringify({ message: `🎉 New tables generated` }), success);
			}
			case '/admin/tables/shuffle': {
				await stub.adminShuffleTables();
				await stub.notifyAll(`tables shuffled`);
				return new Response(JSON.stringify({ message: `🎉 New tables reshuffled` }), success);
			}
			case '/admin/notify': {
				await stub.notifyAll('force notify all');
				return new Response(JSON.stringify({ message: `🎉 Users notified!` }), success);
			}
			default:
				return new Response(JSON.stringify({ message: `url ${url} not found` }), { status: 404 });
		}
	}
} satisfies ExportedHandler<Env>;
