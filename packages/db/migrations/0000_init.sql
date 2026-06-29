CREATE TABLE `companies` (
	`edinet_code` text PRIMARY KEY NOT NULL,
	`sec_code` text,
	`filer_name` text NOT NULL,
	`listed_category` text,
	`industry` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`snapshot_date` text PRIMARY KEY NOT NULL,
	`company_count` integer NOT NULL,
	`document_count` integer NOT NULL,
	`period_financial_count` integer NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`doc_id` text PRIMARY KEY NOT NULL,
	`edinet_code` text NOT NULL,
	`sec_code` text,
	`doc_type` text NOT NULL,
	`ordinance_code` text,
	`form_code` text,
	`doc_type_code` text,
	`period_start` text,
	`period_end` text,
	`submit_date_time` text,
	`withdrawal_status` text,
	`doc_description` text,
	`source_meta_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`edinet_code`) REFERENCES `companies`(`edinet_code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_submit_date` ON `documents` (`submit_date_time`);--> statement-breakpoint
CREATE INDEX `idx_documents_doc_type` ON `documents` (`doc_type`,`submit_date_time`);--> statement-breakpoint
CREATE TABLE `period_financials` (
	`edinet_code` text NOT NULL,
	`sec_code` text,
	`doc_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`period_start` text,
	`period_end` text NOT NULL,
	`submit_date_time` text,
	`filer_name` text NOT NULL,
	`summary_json` text NOT NULL,
	`pl_json` text NOT NULL,
	`bs_json` text NOT NULL,
	`cf_json` text NOT NULL,
	`raw_tsv_path` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`edinet_code`, `period_end`, `doc_type`),
	FOREIGN KEY (`edinet_code`) REFERENCES `companies`(`edinet_code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doc_id`) REFERENCES `documents`(`doc_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_period_financials_sec_period` ON `period_financials` (`sec_code`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_period_financials_submit_date` ON `period_financials` (`submit_date_time`);--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`target_date` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`finished_at` text,
	`fetched_documents` integer DEFAULT 0 NOT NULL,
	`ingested_documents` integer DEFAULT 0 NOT NULL,
	`skipped_documents` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`notes` text
);