import { sql, SQL } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

// ======================================================================
// USERS TABLE
// ======================================================================
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	pseudo: text('pseudo').notNull().unique(),
	email: text('email').notNull().unique(),
	password: text('password'),
	ready: integer('ready', { mode: 'boolean' }).notNull().default(false),
	admin: integer('admin', { mode: 'boolean' }).notNull().default(false),
	canPlayTarot: integer('canPlayTarot', { mode: 'boolean' }).notNull().default(false),
	canPlayTwoTables: integer('canPlayTwoTables', { mode: 'boolean' }).notNull().default(false),

	token: text('token').unique(),
	tokenValidity: integer('tokenValidity'),
});

// ======================================================================
// GAME MODES TABLE
// ======================================================================
export const gameModes = sqliteTable('gamesModes', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	name: text('name').notNull(),
});

// ======================================================================
// TABLES TABLE
// ======================================================================
export const tables = sqliteTable('tables', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	name: text('name').notNull(),
	panama: integer('panama', { mode: 'boolean' }).notNull().default(false),
	pointsLimit: integer('points_limit').notNull().default(1001),
	scoringMode: text('scoring_mode').notNull().default('belote'),
	createdAt: integer('created_at'),
	finishedAt: integer('finished_at'),

	gamemodeId: integer('gamemode_id')
		.notNull()
		.references(() => gameModes.id, { onDelete: 'cascade' }),
});

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export const tablesUsers = sqliteTable(
	'tables_users',
	{
		tableId: integer('table_id')
			.notNull()
			.references(() => tables.id, { onDelete: 'cascade' }),

		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		winner: integer('winner', { mode: 'boolean' }).notNull().default(false),
		team: text('team'),
	},
	(t: any) => [primaryKey({ columns: [t.tableId, t.userId] })],
);

// ======================================================================
// ROUNDS TABLE
// ======================================================================
export const rounds = sqliteTable('rounds', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	tableId: integer('table_id')
		.notNull()
		.references(() => tables.id, { onDelete: 'cascade' }),

	contractTeam: text('contract_team').notNull(),
	contractValue: integer('contract_value'),
	coincheLevel: integer('coinche_level').notNull().default(1),
	pointsTeam1Raw: integer('points_team1_raw').notNull(),
	pointsTeam2Raw: integer('points_team2_raw').notNull(),
	beloteTeam1: integer('belote_team1', { mode: 'boolean' }).notNull().default(false),
	beloteTeam2: integer('belote_team2', { mode: 'boolean' }).notNull().default(false),
	capot: text('capot'),
	scoreTeam1: integer('score_team1').notNull(),
	scoreTeam2: integer('score_team2').notNull(),
	contractSuccess: integer('contract_success', { mode: 'boolean' }).notNull(),
});

export function lower(email: AnySQLiteColumn): SQL {
	return sql`lower(${email})`;
}
