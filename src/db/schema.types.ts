import { users, gameModes, tables, tablesUsers, rounds } from './schema';

// ======================================================================
// USERS
// ======================================================================
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ======================================================================
// GAME MODES
// ======================================================================
export type GameMode = typeof gameModes.$inferSelect;
export type InsertGameMode = typeof gameModes.$inferInsert;

// ======================================================================
// TABLES
// ======================================================================
export type Table = typeof tables.$inferSelect;
export type InsertTable = typeof tables.$inferInsert;

export type Team = {
	name: string;
	users: User[];
};

export type FullTable = {
	table: Table;
	teams: Team[];
	scoreTeam1?: number;
	scoreTeam2?: number;
};

export type Stat = {
	value: string;
};

export type GameHistoryPlayer = {
	pseudo: string;
	team: string;
	winner: boolean;
};

export type GameHistory = {
	tableId: number;
	tableName: string;
	gameMode: string;
	finishedAt: number | null;
	players: GameHistoryPlayer[];
	userWon: boolean;
	team1Name: string | null;
	team2Name: string | null;
	scoreTeam1: number;
	scoreTeam2: number;
};

export type PlayerRanking = {
	rank: number;
	pseudo: string;
	gamesPlayed: number;
	wins: number;
	winRate: number;
};

export type AlarmEvent = { id: string; runAt: number; repeatMs: number };

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export type TableUser = typeof tablesUsers.$inferSelect;
export type InsertTableUser = typeof tablesUsers.$inferInsert;

// ======================================================================
// ROUNDS
// ======================================================================
export type Round = typeof rounds.$inferSelect;
export type InsertRound = typeof rounds.$inferInsert;
