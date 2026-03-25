UPDATE `tables` SET `finished_at` = `created_at` WHERE `finished` = 1 AND `finished_at` IS NULL;--> statement-breakpoint
ALTER TABLE `tables` DROP COLUMN `finished`;