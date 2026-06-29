-- CI fixture: company present in companies + period_financials for metrics backfill coverage.
PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO companies (
  edinet_code, sec_code, filer_name, listed_category, industry
) VALUES (
  'E00099', '0098', 'CI Companies Only Test', '上場', '情報・通信業'
);

INSERT OR REPLACE INTO documents (
  doc_id, edinet_code, sec_code, doc_type, ordinance_code, form_code, doc_type_code,
  period_start, period_end, submit_date_time, withdrawal_status, doc_description, source_meta_json
) VALUES (
  'CI-TEST-ANNUAL-2025', 'E00099', '0098', 'annual', NULL, NULL, NULL,
  '2024-04-01', '2025-03-31', '2025-06-28T09:00:00Z', '0', '有価証券報告書', '{}'
);

INSERT OR REPLACE INTO period_financials (
  edinet_code, sec_code, doc_id, doc_type, period_start, period_end, submit_date_time, filer_name,
  summary_json, pl_json, bs_json, cf_json, raw_tsv_path
) VALUES (
  'E00099', '0098', 'CI-TEST-ANNUAL-2025', 'annual',
  '2024-04-01', '2025-03-31', '2025-06-28T09:00:00Z', 'CI Companies Only Test',
  '{"売上高":"1000000000","純資産額":"500000000","総資産額":"1000000000","自己資本利益率、経営指標等":"0.10"}',
  '{"売上高":"1000000000","営業利益":"100000000","親会社株主に帰属する当期純利益":"50000000"}',
  '{"総資産":"1000000000","純資産":"500000000","負債":"500000000"}',
  '{"営業活動によるキャッシュ・フロー":"80000000"}',
  NULL
);
