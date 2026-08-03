ALTER TABLE `companies` ADD COLUMN `corporate_number` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `filer_name_en` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `filer_name_kana` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `address` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `head_office_address` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `phone` text;--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `representative` text;--> statement-breakpoint
CREATE TABLE `officer_snapshots` (
	`sec_code` text NOT NULL,
	`period_end` text NOT NULL,
	`doc_id` text,
	`entries_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`sec_code`, `period_end`)
);
--> statement-breakpoint
CREATE INDEX `idx_of_sec_code` ON `officer_snapshots` (`sec_code`);
