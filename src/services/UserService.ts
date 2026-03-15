import { User } from '../db/schema.types';
import { and, eq, isNull, or } from "drizzle-orm";
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { lower, users } from "../db/schema"; // your schema file
import { v4 as uuidv4 } from 'uuid';
import { compare,hash } from "bcrypt-ts";
const saltRounds = 10;

export class UserService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>) {
        this.db = db;
    }
    async createAccount(request: Request): Promise<Response> {
        const body: {pseudo: string, password: string, email: string} = await request.json();
        const pseudo = body.pseudo;
        const password = body.password;
        const email =  body.email;
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.pseudo), pseudo.toLowerCase()));
        const userResultMail = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.email), email.toLowerCase()));
        if (userResult[0] || userResultMail[0]) {
            return new Response('existing user', {
                status: 401,
            });
        }

        let newToken = uuidv4();
        const tokenValidity = new Date();
        tokenValidity.setDate(tokenValidity.getDate() + 1);

        await this.db
        .insert(users)
        .values({
            pseudo,
            email,
            password: await hash(password, saltRounds),               // store plain password only for testing!
            ready: false,
            admin: false,
            token: newToken,
            tokenValidity: tokenValidity.getTime()
        })
        .returning();
    
        return new Response(Buffer.from(newToken).toString('base64'), {
            status: 200,
        });
    }
    async passwordChange(request: Request, pseudo: string, admin: boolean): Promise<Response> {
        const badPasswordReponse = new Response('bad password', {
            status: 403,
        });
        
        const body: {oldPassword: string, newPassword: string} = await request.json();

        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.pseudo), pseudo.toLowerCase())).get();
        if (!userResult) {
            return new Response('User not found', {
                status: 404,
            });
        }

        if (!admin && !await compare(body.oldPassword,userResult!.password!!)) {
            return badPasswordReponse;
        }

        await this.db.update(users)
            .set({ password: await hash(body.newPassword, saltRounds) })
            .where(eq(users.id, userResult!.id));
        
        return new Response(userResult!.token, {
            status: 200,
        });
    }
    async authenticate(request: Request): Promise<User | undefined> {
        const body: {email: string, password: string} = await request.json();
        const email = body.email;
        const password = body.password;
        const userResult = await this.db
            .select()
            .from(users)
            .where(
                or(
                    eq(lower(users.email), email.toLowerCase()),
                    eq(lower(users.pseudo), email.toLowerCase())
                )
            ).get();
        if (!userResult || !await compare(password, userResult.password!!)) {
            return undefined;
        }

        let newToken = uuidv4();
        userResult.token = newToken;

        const tokenValidity = new Date();
        tokenValidity.setDate(tokenValidity.getDate() + 1);

        await this.db.update(users)
            .set({ token: newToken, tokenValidity: tokenValidity.getTime() })
            .where(eq(users.id, userResult.id));
    
        return userResult;
    }
    async validateToken(requestToken: string | undefined, admin: boolean = false): Promise<User | Response> {
        if (!requestToken) {
            return new Response('you need to login (no token provided)', {
                status: 401,
            });
        }
        
        const token = Buffer.from(requestToken, 'base64').toString();
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.token, token)).get();
        
        if (!userResult) {
            return new Response(`user not found with token ${token}`, {
                status: 401,
            });
        }

        if (!userResult.tokenValidity) {
            return new Response('invalid token', {
                status: 401,
            });
        }

        if (admin && !userResult.admin) {
            return new Response('you are not admin', {
                status: 403,
            });
        }

        const now = new Date();
        const validity = new Date();
        validity.setTime(userResult.tokenValidity);
        if (isNaN(validity.getTime()) || validity.getTime() < now.getTime()) {
            return new Response('you need to login (bad validity)', {
                status: 401,
            });
        }

        const tokenValidity = new Date();
        tokenValidity.setDate(tokenValidity.getDate() + 1);
        await this.db.update(users)
            .set({ tokenValidity: tokenValidity.getTime() })
            .where(eq(users.id, userResult.id));
        
        return {
            ...userResult,
            token: null,
            password: null
        };
    }

    public async changeUserState(request: Request, pseudo: string) {
        const body: {ready: boolean | undefined, canPlayTarot: boolean | undefined, canPlayTwoTables: boolean | undefined} = await request.json();
        const user = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.pseudo), pseudo.toLowerCase())).get();
            if (user) {
                await this.db.update(users)
                .set({ ready: body.ready ?? user.ready, canPlayTarot: body.canPlayTarot ?? user.canPlayTarot, canPlayTwoTables: body.canPlayTwoTables?? user.canPlayTwoTables })
                .where(eq(users.id, user.id));
            }
        
    }

    public async quit(pseudo: string): Promise<number | undefined> {
        const user = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.pseudo), pseudo.toLowerCase())).get();
        if (user) {
            const tokenValidity = new Date();
            tokenValidity.setDate(tokenValidity.getDate() - 1);
            await this.db.update(users)
                .set({ tokenValidity: tokenValidity.getTime()})
                .where(eq(users.id, user.id));
            return user.id;
        }
    }

    async genMissingTokens() {
        const missingTokenAdminUsers = await this.db
            .select()
            .from(users)
            .where(and(eq(users.admin, true), isNull(users.token)));
        
        for await (const user of missingTokenAdminUsers) {
                        let newToken = uuidv4();
                        const tokenValidity = new Date();
                        tokenValidity.setDate(tokenValidity.getDate() + 1);
        
                        await this.db.update(users)
                        .set({ token: newToken, tokenValidity: tokenValidity.getTime() })
                        .where(eq(users.id, user.id));
        }

        for await (const user of await this.adminGetFullUserList()) {
            console.log(JSON.stringify(user));
        }
    }

    async getUserList() {
		return await this.db
            .select({
                pseudo: users.pseudo,
                tokenValidity: users.tokenValidity
            })
            .from(users).all();
	}

    async adminGetFullUserList() {
        return await this.db
            .select()
            .from(users)
            .all();
    }

    async adminCreateUser(request: Request) {
        const body: { pseudo?: string; email?: string; password?: string; admin?: boolean; ready?: boolean; canPlayTarot?: boolean; canPlayTwoTables?: boolean } = await request.json();
        if (!body.pseudo || !body.email || !body.password) {
            return new Response('missing required fields', { status: 400 });
        }

        const existingPseudo = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.pseudo), body.pseudo.toLowerCase()))
            .get();
        if (existingPseudo) {
            return new Response('existing user', { status: 400 });
        }

        const existingEmail = await this.db
            .select()
            .from(users)
            .where(eq(lower(users.email), body.email.toLowerCase()))
            .get();
        if (existingEmail) {
            return new Response('existing email', { status: 400 });
        }

        await this.db
            .insert(users)
            .values({
                pseudo: body.pseudo,
                email: body.email,
                password: await hash(body.password, saltRounds),
                ready: body.ready ?? false,
                admin: body.admin ?? false,
                canPlayTarot: body.canPlayTarot ?? false,
                canPlayTwoTables: body.canPlayTwoTables ?? false,
                token: null,
                tokenValidity: null,
                lastActiveAt: null
            })
            .returning();

        return new Response(JSON.stringify({ message: 'user created' }), { status: 200 });
    }

    async adminUpdateUser(request: Request, userId: number) {
        const body: { pseudo?: string; email?: string; admin?: boolean; ready?: boolean; canPlayTarot?: boolean; canPlayTwoTables?: boolean; newPassword?: string } = await request.json();
        const user = await this.db.select().from(users).where(eq(users.id, userId)).get();
        if (!user) {
            return new Response('user not found', { status: 404 });
        }

        if (body.pseudo && body.pseudo.toLowerCase() !== user.pseudo.toLowerCase()) {
            const existingPseudo = await this.db
                .select()
                .from(users)
                .where(eq(lower(users.pseudo), body.pseudo.toLowerCase()))
                .get();
            if (existingPseudo) {
                return new Response('existing user', { status: 400 });
            }
        }

        if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
            const existingEmail = await this.db
                .select()
                .from(users)
                .where(eq(lower(users.email), body.email.toLowerCase()))
                .get();
            if (existingEmail) {
                return new Response('existing email', { status: 400 });
            }
        }

        const updates: any = {};
        if (body.pseudo !== undefined) updates.pseudo = body.pseudo;
        if (body.email !== undefined) updates.email = body.email;
        if (body.admin !== undefined) updates.admin = body.admin;
        if (body.ready !== undefined) updates.ready = body.ready;
        if (body.canPlayTarot !== undefined) updates.canPlayTarot = body.canPlayTarot;
        if (body.canPlayTwoTables !== undefined) updates.canPlayTwoTables = body.canPlayTwoTables;
        if (body.newPassword) {
            updates.password = await hash(body.newPassword, saltRounds);
        }

        if (Object.keys(updates).length === 0) {
            return new Response(JSON.stringify({ message: 'nothing to update' }), { status: 200 });
        }

        await this.db.update(users).set(updates).where(eq(users.id, user.id));

        return new Response(JSON.stringify({ message: 'user updated' }), { status: 200 });
    }

    async adminDeleteUser(userId: number) {
        const user = await this.db.select().from(users).where(eq(users.id, userId)).get();
        if (!user) {
            return new Response('user not found', { status: 404 });
        }
        await this.db.delete(users).where(eq(users.id, userId));
        return new Response(JSON.stringify({ message: 'user deleted' }), { status: 200 });
    }
}
