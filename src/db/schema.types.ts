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

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export type TableUser = typeof tablesUsers.$inferSelect;
export type InsertTableUser = typeof tablesUsers.$inferInsert;