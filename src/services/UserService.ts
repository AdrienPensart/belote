import { User, UserForFront } from '../db/schema.types';
import { eq } from "drizzle-orm";
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users } from "../db/schema"; // your schema file
import { v4 as uuidv4 } from 'uuid';
import { compare,hash } from "bcrypt-ts";
const saltRounds = 10;

export class UserService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>) {
        this.db = db;
    }
    async createAccount(request: Request): Promise<Response> {
        const body: {pseudo: string, password: string} = await request.json();
        const pseudo = body.pseudo;
        const password = body.password;
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo));

        if (userResult[0]) {
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
            password: await hash(password, saltRounds),               // store plain password only for testing!
            ready: false,
            admin: false,
            token: newToken,
            tokenValidity: tokenValidity.getTime(),
            lastActiveAt: new Date().getTime()
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
            .where(eq(users.pseudo, pseudo)).get();
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
        const body: {pseudo: string, password: string} = await request.json();
        const pseudo = body.pseudo;
        const password = body.password;
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo)).get();

        if (!userResult || !await compare(password,userResult.password!!)) {
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
    async validateToken(requestToken: string | undefined, admin: Boolean = false): Promise<User | Response> {
        const mustLoginResponse = new Response('you need to login', {
            status: 401,
        });
    
        if (!requestToken) {
            return mustLoginResponse;
        }
        
        const token = Buffer.from(requestToken, 'base64').toString();
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.token, token)).get();
        
        if (!userResult || !userResult.tokenValidity) {
            return mustLoginResponse;
        }
        if (admin && !userResult.admin) {
            return new Response('you are not admin', {
                status: 403,
            });;
        }
        const now = new Date();
        const validity = new Date();
        validity.setTime(userResult.tokenValidity);
        if (isNaN(validity.getTime()) || validity.getTime() < now.getTime()) {
            return mustLoginResponse;
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
            .where(eq(users.pseudo, pseudo)).get();
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
            .where(eq(users.pseudo, pseudo)).get();
        if (user) {
            const tokenValidity = new Date();
            tokenValidity.setDate(tokenValidity.getDate() - 1);
            await this.db.update(users)
                .set({ tokenValidity: tokenValidity.getTime()})
                .where(eq(users.id, user.id));
            return user.id;
        }
    }
    async getUserList() {
		return await this.db
            .select({
                pseudo: users.pseudo,
                lastActiveAt: users.lastActiveAt,
                tokenValidity: users.tokenValidity
            })
            .from(users).all();
	}
}
