import {
  sqliteTable,
  text,
  integer,
  primaryKey
} from "drizzle-orm/sqlite-core";

// ======================================================================
// USERS TABLE
// ======================================================================
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  pseudo: text("pseudo").notNull().unique(),
  password: text("password"),
  ready: integer("ready", { mode: "boolean" })
    .notNull()
    .default(false),
  admin: integer("admin", { mode: "boolean" })
    .notNull()
    .default(false),
  canPlayTarot: integer("canPlayTarot", { mode: "boolean" })
    .notNull()
    .default(false),
  canPlayTwoTables: integer("canPlayTwoTables", { mode: "boolean" })
    .notNull()
    .default(false),

  token: text("token").unique(),
  tokenValidity: integer("tokenValidity"),

  lastActiveAt: integer("lastActiveAt"),
});

// ======================================================================
// GAME MODES TABLE
// ======================================================================
export const gameModes = sqliteTable("gamesModes", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  name: text("name").notNull()
});

// ======================================================================
// TABLES TABLE
// ======================================================================
export const tables = sqliteTable("tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  name: text("name").notNull(),
  finished: integer("finished", { mode: "boolean" })
    .notNull()
    .default(false),
  panama: integer("panama", { mode: "boolean" })
    .notNull()
    .default(false),

  gamemodeId: integer("gamemode_id")
    .notNull()
    .references(() => gameModes.id, { onDelete: "cascade" })
});

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export const tablesUsers = sqliteTable(
  "tables_users",
  {
    tableId: integer("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    winner: integer("winner", { mode: "boolean" })
      .notNull()
      .default(false),
    team: text("team"),
  },
  (t: any) => ({
    pk: primaryKey({ columns: [t.tableId, t.userId] })
  })
);
