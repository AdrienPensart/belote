import {
	GameMode,
	Table,
	User,
	FullTable,
	Team,
	Stat,
	GameHistory,
	GameHistoryPlayer,
	PlayerRanking,
	Round,
	InsertRound,
} from '../db/schema.types';
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users, tables, tablesUsers, gameModes, rounds } from '../db/schema'; // your schema file
import { and, eq, sql, asc } from 'drizzle-orm';
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
	public async addUserToTable(user: User, tableId: number) {
		await this.addUserToTableWithTeamName(user, tableId, TEAMS[0], false);
	}
	public async quit(userId: number | undefined) {
		if (userId) {
			await this.db
				.delete(tablesUsers)
				.where(and(eq(tablesUsers.tableId, (await this.getPanamaTable()).table.id), eq(tablesUsers.userId, userId)));
		}
	}
	private async addUserToTableWithTeamName(user: User, tableId: number, teamName: string, forceAssign: boolean) {
		const currentUserTables = await this.getCurrentTablesFromUser(user);
		if (forceAssign || currentUserTables.length == 0) {
			await this.db
				.insert(tablesUsers)
				.values({
					tableId: tableId,
					userId: user.id,
					team: teamName,
				})
				.returning();
		}
	}

	public async removeDisconnectedUsers() {
		let tables = await this.getTables();
		let panamaTable = tables.filter((table) => table.table.panama)[0];
		const usersOnPanamaTable = panamaTable.teams[0].users;
		for (const user of usersOnPanamaTable) {
			const dbUser = await this.db.select().from(users).where(eq(users.id, user.id)).get();
			if (dbUser && dbUser.tokenValidity != null && dbUser.tokenValidity < Date.now()) {
				await this.quit(dbUser.id);
			}
		}
	}

	public async createManualTable(pseudos: string[], gameMode: GameMode) {
		let tables = await this.getTables();
		const usedTableNames = tables.map((fullTable) => fullTable.table.name);
		var nextTableAvailable = 1;
		while (usedTableNames.filter((tableName) => tableName.startsWith(`Table ${nextTableAvailable} `)).length > 0) {
			nextTableAvailable++;
		}
		let users = tables
			.find((tableWithUsers) => tableWithUsers.table.panama)!!
			.teams[0].users.filter((user) => pseudos.indexOf(user.pseudo) !== -1);
		if (users.length !== 4) {
			throw 'Cannot create table since users are not fully in panama';
		}
		let teams: Team[] = [
			{
				name: 'red',
				users: [users[0], users[1]],
			},
			{
				name: 'black',
				users: [users[2], users[3]],
			},
		];
		await this.createTable(`Table ${nextTableAvailable} (${gameMode.name})`, gameMode.id, teams);
	}

	public async getGameModes(): Promise<GameMode[]> {
		return await this.db.select().from(gameModes).all()!!;
	}
	public async getCurrentTablesFromUser(user: User): Promise<Table[]> {
		return (
			await this.db
				.select({
					table: tables,
				})
				.from(tablesUsers)
				.innerJoin(tables, eq(tables.id, tablesUsers.tableId))
				.where(and(eq(tablesUsers.userId, user.id), sql`${tables.finishedAt} IS NULL`))
		).map((elem) => elem.table);
	}
	public async createTable(tableName: string, gameModeId: number, teams: Team[]): Promise<Table> {
		const newTable: Table = await this.db
			.insert(tables)
			.values({
				name: tableName,
				gamemodeId: gameModeId,
				createdAt: Date.now(),
			})
			.returning()
			.get();
		for (const team of teams) {
			for (const user of team.users) {
				await this.db
					.delete(tablesUsers)
					.where(and(eq(tablesUsers.tableId, (await this.getPanamaTable()).table.id), eq(tablesUsers.userId, user.id)));
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
				tablesUsers: tablesUsers,
			})
			.from(tables)
			.leftJoin(tablesUsers, eq(tablesUsers.tableId, tables.id))
			.leftJoin(users, eq(tablesUsers.userId, users.id))
			.where(sql`${tables.finishedAt} IS NULL`);
		const map = new Map<number, FullTable>();

		for (const row of rows) {
			const table = row.table;
			const user = row.user;
			const tablesUsers = row.tablesUsers;

			if (!map.has(table.id)) {
				const teams: Team[] = [];
				if (table.panama) {
					teams.push({
						name: TEAMS[0],
						users: [],
					});
				}
				map.set(table.id, {
					table,
					teams: teams,
				});
			}

			if (user) {
				let currentTeam = map.get(table.id)!.teams.find((team) => team.name === tablesUsers!!.team);
				if (!currentTeam) {
					currentTeam = {
						name: tablesUsers!!.team!!,
						users: [],
					};
					map.get(table.id)!.teams.push(currentTeam);
				}
				currentTeam?.users.push({
					...user,
					token: null,
					password: null,
				});
			}
		}

		const result = [...map.values()];

		for (const ft of result) {
			if (!ft.table.panama) {
				const scoreRows = await this.db
					.select({ s1: sql<number>`COALESCE(SUM(${rounds.scoreTeam1}), 0)`, s2: sql<number>`COALESCE(SUM(${rounds.scoreTeam2}), 0)` })
					.from(rounds)
					.where(eq(rounds.tableId, ft.table.id))
					.all();
				ft.scoreTeam1 = scoreRows[0]?.s1 ?? 0;
				ft.scoreTeam2 = scoreRows[0]?.s2 ?? 0;
			}
		}

		return result;
	}

	public async swapPeople(pseudos: string[]) {
		let tables = await this.getTables();
		let teamPlayerOne;
		let teamPlayerTwo;
		let userIdPlayerOne: number = 0;
		let userIdPlayerTwo: number = 0;
		let tableIdPlayerOne: number = 0;
		let tableIdPlayerTwo: number = 0;
		for (const fullTable of tables) {
			for (const team of fullTable.teams) {
				for (const user of team.users) {
					if (user.pseudo === pseudos[0]) {
						teamPlayerOne = team.name;
						userIdPlayerOne = user.id;
						tableIdPlayerOne = fullTable.table.id;
					}
					if (user.pseudo === pseudos[1]) {
						teamPlayerTwo = team.name;
						userIdPlayerTwo = user.id;
						tableIdPlayerTwo = fullTable.table.id;
					}
				}
			}
		}
		if (teamPlayerOne && teamPlayerTwo) {
			await this.db
				.update(tablesUsers)
				.set({ team: teamPlayerTwo, tableId: tableIdPlayerTwo })
				.where(and(eq(tablesUsers.tableId, tableIdPlayerOne), eq(tablesUsers.userId, userIdPlayerOne)));
			await this.db
				.update(tablesUsers)
				.set({ team: teamPlayerOne, tableId: tableIdPlayerOne })
				.where(and(eq(tablesUsers.tableId, tableIdPlayerTwo), eq(tablesUsers.userId, userIdPlayerTwo)));
		}
	}

	public async changeReadyState(request: Request) {
		const body: { ready: boolean; tableId: number } = await request.json();
		let tables = await this.getTables();
		for (const fullTable of tables) {
			if (fullTable.table.id == body.tableId) {
				for (const team of fullTable.teams) {
					for (const user of team.users) {
						await this.db.update(users).set({ ready: body.ready }).where(eq(users.id, user.id));
					}
				}
			}
		}
	}

	public async previewTables(): Promise<{ newTables: FullTable[]; remainingPanamaUsers: User[] }> {
		const tables = await this.getTables();
		const tablesCopy: FullTable[] = JSON.parse(JSON.stringify(tables));
		const gameModes = await this.getGameModes();
		await generateFullTables(tablesCopy, gameModes);
		const panama = tablesCopy.find((ft) => ft.table.panama);
		const remainingPanamaUsers = panama ? panama.teams[0].users.filter((u) => u.ready) : [];
		return { newTables: tablesCopy.filter((ft) => ft.table.id === -1), remainingPanamaUsers };
	}

	public async generateTables() {
		let tables = await this.getTables();
		let gameModes = await this.getGameModes();
		await generateFullTables(tables, gameModes);
		for (const fullTable of tables) {
			if (fullTable.table.id === -1) {
				await this.createTable(fullTable.table.name, fullTable.table.gamemodeId, fullTable.teams);
			}
		}
	}

	public async isUserOnTable(tableId: number, pseudo: string): Promise<boolean> {
		const fullTables = await this.getTables();
		const table = fullTables.find((ft) => ft.table.id === tableId);
		if (!table) return false;
		for (const team of table.teams) {
			if (team.users.some((u) => u.pseudo === pseudo)) return true;
		}
		return false;
	}

	public async getRounds(tableId: number): Promise<Round[]> {
		return await this.db.select().from(rounds).where(eq(rounds.tableId, tableId)).orderBy(asc(rounds.id)).all();
	}

	public async getFinishedTables(): Promise<{ table: Table; teams: Team[]; scoreTeam1: number; scoreTeam2: number }[]> {
		return this.getAllTables(true);
	}

	public async getAllTables(
		finishedOnly: boolean = false,
	): Promise<{ table: Table; teams: Team[]; scoreTeam1: number; scoreTeam2: number }[]> {
		const condition = finishedOnly ? and(sql`${tables.finishedAt} IS NOT NULL`, eq(tables.panama, false)) : eq(tables.panama, false);
		const rows = await this.db
			.select({
				table: tables,
				user: users,
				tablesUsers: tablesUsers,
			})
			.from(tables)
			.leftJoin(tablesUsers, eq(tablesUsers.tableId, tables.id))
			.leftJoin(users, eq(tablesUsers.userId, users.id))
			.where(condition);

		const map = new Map<number, { table: Table; teams: Team[] }>();
		for (const row of rows) {
			if (!map.has(row.table.id)) {
				map.set(row.table.id, { table: row.table, teams: [] });
			}
			if (row.user && row.tablesUsers) {
				let team = map.get(row.table.id)!.teams.find((t) => t.name === row.tablesUsers!.team);
				if (!team) {
					team = { name: row.tablesUsers.team!, users: [] };
					map.get(row.table.id)!.teams.push(team);
				}
				team.users.push({ ...row.user, token: null, password: null });
			}
		}

		const result = [];
		for (const entry of map.values()) {
			const roundRows = await this.db
				.select({ s1: sql<number>`COALESCE(SUM(${rounds.scoreTeam1}), 0)`, s2: sql<number>`COALESCE(SUM(${rounds.scoreTeam2}), 0)` })
				.from(rounds)
				.where(eq(rounds.tableId, entry.table.id))
				.all();
			result.push({
				...entry,
				scoreTeam1: roundRows[0]?.s1 ?? 0,
				scoreTeam2: roundRows[0]?.s2 ?? 0,
			});
		}
		return result;
	}

	public async addRound(tableId: number, data: InsertRound): Promise<Round> {
		return await this.db
			.insert(rounds)
			.values({ ...data, tableId })
			.returning()
			.get();
	}

	public async deleteRound(tableId: number, roundId: number): Promise<void> {
		await this.db.delete(rounds).where(and(eq(rounds.id, roundId), eq(rounds.tableId, tableId)));
	}

	public async updateTableSettings(tableId: number, pointsLimit: number, scoringMode: string): Promise<void> {
		await this.db.update(tables).set({ pointsLimit, scoringMode }).where(eq(tables.id, tableId));
	}

	public async getTableById(tableId: number): Promise<FullTable | undefined> {
		const fullTables = await this.getTables();
		return fullTables.find((ft) => ft.table.id === tableId);
	}

	public async finish(tableId: number, winningTeam: string, pseudo: string | undefined) {
		const fullTables = await this.getTables();
		const table = fullTables.filter((fullTable) => fullTable.table.id == tableId)[0];
		if (pseudo) {
			if (!(await this.isUserOnTable(tableId, pseudo))) {
				return;
			}
		}
		await this.db.update(tables).set({ finishedAt: Date.now() }).where(eq(tables.id, tableId));
		await this.db
			.update(tablesUsers)
			.set({ winner: true })
			.where(and(eq(tablesUsers.tableId, tableId), eq(tablesUsers.team, winningTeam)));

		for (const team of table.teams) {
			for (const player of team.users) {
				await this.addUserToTable(player, (await this.getPanamaTable()).table.id);
				await this.db.update(users).set({ ready: false }).where(eq(users.id, player.id));
			}
		}
	}
	public async deleteTable(tableId: number) {
		const fullTables = await this.getTables();
		const table = fullTables.filter((fullTable) => fullTable.table.id == tableId)[0];
		await this.db.delete(tablesUsers).where(and(eq(tablesUsers.tableId, tableId)));
		await this.db.delete(tables).where(and(eq(tables.id, tableId)));

		for (const team of table.teams) {
			for (const player of team.users) {
				await this.addUserToTable(player, (await this.getPanamaTable()).table.id);
			}
		}
	}

	public async getStats(user: User): Promise<Stat[]> {
		const stats: Stat[] = [];
		const dbGameModes = await this.db.select().from(gameModes).all();
		for (const gameMode of dbGameModes.filter((elem) => elem.name !== 'Panama')) {
			if (gameMode.name !== 'Tarot') {
				const bestWinningPartner: { partnerPseudo: string; gamesTogether: number; winPercentage: number }[] = await this.db.all(sql`
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
                        AND tu2.user_id != tu1.user_id and tables.finished_at IS NOT NULL and tables.gamemode_id = ${gameMode.id}
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
						value: `${gameMode.name} : Ton meilleur partenaire ${bestWinningPartner[0].partnerPseudo} joué ${bestWinningPartner[0].gamesTogether} fois ${bestWinningPartner[0].winPercentage * 100}% win`,
					});
				}
				const mostPlayedPartner: { partnerPseudo: string; gamesTogether: number }[] = await this.db.all(sql`
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
						value: `${gameMode.name} : Tu a joué le plus souvent avec ${mostPlayedPartner[0].partnerPseudo} ${mostPlayedPartner[0].gamesTogether} fois`,
					});
				}
			}
			const gamesPlayed: { games: number }[] = await this.db.all(sql`
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
				value: `${gameMode.name} : Tu a joué ${gamesPlayed[0].games} fois`,
			});
		}
		return stats;
	}

	public async getRankings(): Promise<PlayerRanking[]> {
		const rows: { pseudo: string; gamesPlayed: number; wins: number }[] = await this.db.all(sql`
			SELECT
				u.pseudo,
				COUNT(*) AS gamesPlayed,
				SUM(CASE WHEN tu.winner = 1 THEN 1 ELSE 0 END) AS wins
			FROM tables_users tu
			JOIN users u ON u.id = tu.user_id
			JOIN tables t ON t.id = tu.table_id
			WHERE t.finished_at IS NOT NULL AND t.panama = false
			GROUP BY tu.user_id
			ORDER BY wins DESC, gamesPlayed ASC
		`);
		return rows.map((row, index) => ({
			rank: index + 1,
			pseudo: row.pseudo,
			gamesPlayed: row.gamesPlayed,
			wins: row.wins,
			winRate: row.gamesPlayed > 0 ? Math.round((row.wins / row.gamesPlayed) * 100) : 0,
		}));
	}

	public async getHistory(user: User, limit: number = 50): Promise<GameHistory[]> {
		const rows: {
			tableId: number;
			tableName: string;
			gameModeName: string;
			odescriptyPseudo: string;
			odescriptyTeam: string;
			odescriptyWinner: number;
			userWinner: number;
		}[] = await this.db.all(sql`
            SELECT
                t.id as tableId,
                t.name as tableName,
                gm.name as gameModeName,
                u.pseudo as playerPseudo,
                tu.team as playerTeam,
                tu.winner as playerWinner,
                (SELECT tu2.winner FROM tables_users tu2 WHERE tu2.table_id = t.id AND tu2.user_id = ${user.id}) as userWinner,
                COALESCE((SELECT SUM(r.score_team1) FROM rounds r WHERE r.table_id = t.id), 0) as scoreTeam1,
                COALESCE((SELECT SUM(r.score_team2) FROM rounds r WHERE r.table_id = t.id), 0) as scoreTeam2,
                t.finished_at as finishedAt
            FROM tables t
            JOIN gamesModes gm ON gm.id = t.gamemode_id
            JOIN tables_users tu ON tu.table_id = t.id
            JOIN users u ON u.id = tu.user_id
            WHERE t.finished_at IS NOT NULL
            AND t.panama = false
            AND t.id IN (
                SELECT table_id FROM tables_users WHERE user_id = ${user.id}
            )
            ORDER BY t.id DESC
            LIMIT ${limit * 10}
        `);

		const historyMap = new Map<number, GameHistory>();

		for (const row of rows) {
			if (!historyMap.has(row.tableId)) {
				historyMap.set(row.tableId, {
					tableId: row.tableId,
					tableName: row.tableName,
					gameMode: row.gameModeName,
					finishedAt: (row as any).finishedAt ?? null,
					players: [],
					userWon: row.userWinner === 1,
					team1Name: null,
					team2Name: null,
					scoreTeam1: (row as any).scoreTeam1 || 0,
					scoreTeam2: (row as any).scoreTeam2 || 0,
				});
			}

			const history = historyMap.get(row.tableId)!;
			const playerTeam = (row as any).playerTeam;
			if (playerTeam && !history.team1Name) {
				history.team1Name = playerTeam;
			} else if (playerTeam && playerTeam !== history.team1Name && !history.team2Name) {
				history.team2Name = playerTeam;
			}
			history.players.push({
				pseudo: (row as any).playerPseudo,
				team: playerTeam,
				winner: (row as any).playerWinner === 1,
			});
		}

		return [...historyMap.values()].slice(0, limit);
	}
}
