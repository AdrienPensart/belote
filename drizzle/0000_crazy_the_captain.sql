CREATE TABLE `gamesModes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`finished` integer DEFAULT false NOT NULL,
	`panama` integer DEFAULT false NOT NULL,
	`gamemode_id` integer NOT NULL,
	FOREIGN KEY (`gamemode_id`) REFERENCES `gamesModes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tables_users` (
	`table_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`winner` integer DEFAULT false NOT NULL,
	`team` text,
	PRIMARY KEY(`table_id`, `user_id`),
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pseudo` text NOT NULL,
	`password` text,
	`ready` integer DEFAULT false NOT NULL,
	`admin` integer DEFAULT false NOT NULL,
	`canPlayTarot` integer DEFAULT false NOT NULL,
	`canPlayTwoTables` integer DEFAULT false NOT NULL,
	`token` text,
	`tokenValidity` integer,
	`lastActiveAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_pseudo_unique` ON `users` (`pseudo`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_token_unique` ON `users` (`token`);