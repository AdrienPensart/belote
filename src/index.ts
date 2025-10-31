/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { DurableObject } from "cloudflare:workers";

export interface Env {
  MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
}

// export class MyDurableObject extends DurableObject {
//   constructor(ctx, env) {
//     // Required, as we're extending the base class.
//     super(ctx, env);
//   }
//   async sayHello() {
//     let result = this.ctx.storage.sql
//       .exec("SELECT 'Hello, World!' as greeting")
//       .one();
//     return result.greeting;
//   }
// }
export class MyDurableObject extends DurableObject<Env> {
	value!: number;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)

		ctx.blockConcurrencyWhile(async () => {
			// After initialization, future reads do not need to access storage.
			this.value = (await ctx.storage.get("value")) || 0;
		});
	}

	async sayHello():Promise<string> {
		// let result = this.ctx.storage.sql
		// 	.exec("SELECT 'Hello, World!' as greeting")
		// 	.one();
		// 	return result.greeting;
		return "crunch";
	}

	async getCounterValue() {
		return this.value;
	}

	async incCounterValue() {
		this.value += 1;
	}

	async clearDo(): Promise<void> {
		await this.ctx.storage.deleteAlarm();

		// This will delete all the storage associated with this Durable Object instance
		// This will also delete the Durable Object instance itself
		await this.ctx.storage.deleteAll();
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		switch (url.pathname) {
			case '/message':
				const pathname = new URL(request.url).pathname;
				console.log(pathname);
				
				const stub = env.MY_DURABLE_OBJECT.getByName(pathname);
				const greeting = await stub.sayHello();
				return new Response(`Hello, ${greeting}!`);
			case '/inc':
				
			case '/random':
				return new Response(crypto.randomUUID());
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
