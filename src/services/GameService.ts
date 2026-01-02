import { GameMode, Table, User, FullTable, Team, Stat } from '../db/schema.types';
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users, tables, tablesUsers, gameModes } from "../db/schema"; // your schema file
import { and, eq, sql } from 'drizzle-orm';
import { generateFullTables, TEAMS } from '../table';




export class GameService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>) {
          this.db = db;
    }
    public async getPanamaTable(): Promise<FullTable> {
        let tables = await this.getTables();
        return tables.find((tableWithUsers) => tableWithUsers.table.panama)!!; 
    }
    public async addUserToTable(user:User, tableId: number) {
        await this.addUserToTableWithTeamName(user,tableId, TEAMS[0], false);
    }
    public async quit(userId: number | undefined) {
        if (userId) {
            await this.db
            .delete(tablesUsers)
            .where(
                and(
                    eq(tablesUsers.tableId, (await this.getPanamaTable()).table.id),
                    eq(tablesUsers.userId, userId)
                )
            )
        }
    }
    private async addUserToTableWithTeamName(user:User, tableId: number, teamName: string,forceAssign : boolean) {
        const currentUserTables = await this.getCurrentTablesFromUser(user);
        if (forceAssign || currentUserTables.length == 0) {
            await this.db
            .insert(tablesUsers)
            .values({
                tableId: tableId,
                userId: user.id,
                team: teamName
            })
            .returning();
        }
    }
    public async getGameModes() : Promise<GameMode[]> {
        return await this.db
        .select()
        .from(gameModes).all()!!;
    }
    public async getCurrentTablesFromUser(user:User) : Promise<Table[] > {
        return (await this.db
        .select({
            table: tables,
        })
        .from(tablesUsers)
        .innerJoin(tables, eq(tables.id, tablesUsers.tableId))
        .where(
            and(
                eq(tablesUsers.userId, user.id),
                eq(tables.finished, false),
            )
        )).map((elem) => elem.table);
    }
    public async createTable(tableName: string, gameModeId: number, teams: Team[]): Promise<Table> {
        const newTable: Table = await this.db
            .insert(tables)
            .values({
                name: tableName,
                gamemodeId: gameModeId
            })
            .returning().get();
        for (const team of teams) {
            for (const user of team.users) {
                await this.db.delete(tablesUsers).where(and(
                    eq(tablesUsers.tableId, (await this.getPanamaTable()).table.id),
                    eq(tablesUsers.userId,user.id)
                ));
                await this.addUserToTableWithTeamName(user, newTable!!.id, team.name, true);
            }
        }
        return newTable;
    }

    public async getTables(): Promise<FullTable[]> {
        const rows = await this.db
        .select({
            table: tables,
            user: users,
            tablesUsers: tablesUsers
        })
        .from(tables)
        .leftJoin(tablesUsers, eq(tablesUsers.tableId, tables.id))
        .leftJoin(users, eq(tablesUsers.userId, users.id))
        .where(eq(tables.finished, false));
        const map = new Map<number, FullTable>();

        for (const row of rows) {
            const table = row.table;
            const user = row.user;
            const tablesUsers = row.tablesUsers

            if (!map.has(table.id)) {
                const teams: Team[] = [];
                if (table.panama) {
                    teams.push({
                        name: TEAMS[0],
                        users: []
                    })
                }
                map.set(table.id, {
                    table,
                    teams: teams
                });
            }

            if (user) {
                let currentTeam = map.get(table.id)!.teams.find((team) => team.name === tablesUsers!!.team);
                if (!currentTeam) {
                    currentTeam = {
                        name: tablesUsers!!.team!!,
                        users: []
                    };
                    map.get(table.id)!.teams.push(currentTeam);
                }
                currentTeam?.users.push({
                    ...user,
                    token: null,
                    password: null
                });
            }
        }

        return [...map.values()];
    }

    public async changeReadyState(request: Request) {
        const body: {ready: boolean, tableId: number} = await request.json();
        let tables = await this.getTables();
        for (const fullTable of tables) {
            if (fullTable.table.id == body.tableId) {
                for (const team of fullTable.teams) {
                    for (const user of team.users) {
                        await this.db.update(users)
                            .set({ ready: body.ready })
                            .where(eq(users.id, user.id));
                    }
                }
            }
        }
        
    }

    public async generateTables() {
        let tables = await this.getTables();
        let gameModes = await this.getGameModes();
        await generateFullTables(tables,gameModes);
        for (const fullTable of tables) {
            if (fullTable.table.id === -1) {
                await this.createTable(fullTable.table.name,fullTable.table.gamemodeId, fullTable.teams);
            }
        }
        
    }

    public async finish(tableId: number, winningTeam: string, pseudo: string | undefined) {
        const fullTables = await this.getTables();
        const table = fullTables.filter((fullTable) => fullTable.table.id == tableId)[0];
        if (pseudo) {
            let hasPseudo = false;
            for (const team of table.teams) {
                if (team.users.filter((user) => user.pseudo === pseudo).length > 0) {
                    hasPseudo = true;
                }
            }
            if (!hasPseudo) {
                return;
            }
        }
        await this.db.update(tables)
            .set({ finished: true })
            .where(eq(tables.id, tableId));
        await this.db.update(tablesUsers)
            .set({ winner: true })
            .where(and(eq(tablesUsers.tableId, tableId),eq(tablesUsers.team, winningTeam)));
        
        for (const team of table.teams) {
            for (const player of team.users) {
                await this.addUserToTable(player, ((await this.getPanamaTable()).table.id));
                await this.db.update(users)
                    .set({ ready: false })
                    .where(eq(users.id, player.id));
            }
        }
    }
    public async deleteTable(tableId: number) {
        const fullTables = await this.getTables();
        const table = fullTables.filter((fullTable) => fullTable.table.id == tableId)[0];
        await this.db
            .delete(tablesUsers)
            .where(
                and(
                    eq(tablesUsers.tableId, tableId)
                )
            );
        await this.db
            .delete(tables)
            .where(
                and(
                    eq(tables.id, tableId)
                )
            );
        
        for (const team of table.teams) {
            for (const player of team.users) {
                await this.addUserToTable(player, ((await this.getPanamaTable()).table.id));
            }
        }
    }
    

    public async getStats(user: User) : Promise<Stat[]> {
        const stats : Stat[] = [];
        const dbGameModes = await this.db.select().from(gameModes).all();
        for (const gameMode of dbGameModes.filter((elem) => elem.name !== 'Panama')) {
            if (gameMode.name !== 'Tarot') {
                const bestWinningPartner: {partnerPseudo: string, gamesTogether: number, winPercentage: number}[] = await this.db.all(sql`
                        WITH partner_stats AS (
                        SELECT
                        tu2.user_id AS partnerId,
                        COUNT(DISTINCT tu2.table_id) AS gamesTogether,
                        SUM(
                            CASE 
                            WHEN tu1.winner = 1 AND tu2.winner = 1 
                            THEN 1 ELSE 0 
                            END
                        ) AS winsTogether
                        FROM tables_users tu1
                        JOIN tables_users tu2
                        ON tu1.table_id = tu2.table_id
                        JOIN tables tables
                        ON tu1.table_id = tables.id
                        WHERE tu1.user_id = ${user.id}
                        AND tu2.user_id != tu1.user_id and tables.finished = true and tables.gamemode_id = ${gameMode.id}
                        GROUP BY tu2.user_id
                    )
                    SELECT 
                        p.partnerId,
                        u.pseudo AS partnerPseudo,
                        p.gamesTogether,
                        p.winsTogether,
                        (CAST(p.winsTogether AS FLOAT) / p.gamesTogether) AS winPercentage
                    FROM partner_stats p
                    JOIN users u ON u.id = p.partnerId
                    ORDER BY winPercentage DESC, gamesTogether DESC
                    LIMIT 1;
                `);
                if (bestWinningPartner && bestWinningPartner[0]) {
                    stats.push({
                        value: `${gameMode.name} : Ton meilleur partenaire ${bestWinningPartner[0].partnerPseudo} joué ${bestWinningPartner[0].gamesTogether} fois ${bestWinningPartner[0].winPercentage*100}% win`
                    });
                }
                const mostPlayedPartner: {partnerPseudo: string, gamesTogether: number}[] = await this.db.all(sql`
                        SELECT 
                        users.pseudo AS partnerPseudo,
                        COUNT(*) AS gamesTogether
                        FROM tables_users tu1
                        JOIN tables_users tu2
                            ON tu1.table_id = tu2.table_id
                        JOIN users users
                            ON users.id = tu2.user_id
                        JOIN tables tables
                        ON tu1.table_id = tables.id
                        WHERE tu1.user_id = ${user.id}
                        AND tu2.user_id != tu1.user_id
                        and tables.gamemode_id = ${gameMode.id}
                        GROUP BY tu2.user_id
                        ORDER BY gamesTogether DESC
                        LIMIT 1;
                    `);
                if (mostPlayedPartner && mostPlayedPartner[0]) {
                    stats.push({
                    value: `${gameMode.name} : Tu a joué le plus souvent avec ${mostPlayedPartner[0].partnerPseudo} ${mostPlayedPartner[0].gamesTogether} fois`
                    });
                }
            }
            const gamesPlayed : {games: number}[] = await this.db.all(sql`
                SELECT 
                COUNT(*) AS games
                FROM tables_users tu1
                JOIN tables tables
                ON tu1.table_id = tables.id
                WHERE tu1.user_id = ${user.id}
                and tables.gamemode_id = ${gameMode.id}
                LIMIT 1;
            `);
            stats.push({
                value: `${gameMode.name} : Tu a joué ${gamesPlayed[0].games} fois`
            });
            
        }    
        return stats;
    }
}
