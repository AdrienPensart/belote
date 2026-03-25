CREATE TABLE `rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_id` integer NOT NULL,
	`contract_team` text NOT NULL,
	`contract_value` integer,
	`coinche_level` integer DEFAULT 1 NOT NULL,
	`points_team1_raw` integer NOT NULL,
	`points_team2_raw` integer NOT NULL,
	`belote_team1` integer DEFAULT false NOT NULL,
	`belote_team2` integer DEFAULT false NOT NULL,
	`capot` text,
	`score_team1` integer NOT NULL,
	`score_team2` integer NOT NULL,
	`contract_success` integer NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tables` ADD `points_limit` integer DEFAULT 1001 NOT NULL;--> statement-breakpoint
ALTER TABLE `tables` ADD `scoring_mode` text DEFAULT 'belote' NOT NULL;