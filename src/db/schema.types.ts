import { users, gameModes, tables, tablesUsers } from "./schema";

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
    name: string,
    users: User[]
};

export type FullTable = {
  table: Table;
  teams: Team[];
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
};

export type AlarmEvent = { id:string, runAt:number, repeatMs:number };

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export type TableUser = typeof tablesUsers.$inferSelect;
export type InsertTableUser = typeof tablesUsers.$inferInsert;