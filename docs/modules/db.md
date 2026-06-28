# packages/db — drizzle schema + 共通クエリ

D1 / SQLite 共通のスキーマ定義とクエリ層。**スキーマの正本**。

パッケージ名: `@edinet/db`

## ファイル構成

```
packages/db/
├── src/
│   ├── schema.ts      drizzle テーブル定義 + 型 export
│   ├── queries.ts     型安全なクエリ関数
│   └── index.ts       schema + queries の re-export
├── migrations/
│   ├── 0000_init.sql  drizzle-kit 生成 SQL（apps/wrapper も読む）
│   ├── 0001_company_metrics.sql  company_metrics / shareholder_snapshots
│   └── meta/          drizzle-kit のスナップショット
└── drizzle.config.ts  dialect: sqlite, driver: d1-http
```

## テーブル (schema.ts)

| テーブル | 主キー | 用途 |
|---|---|---|
| `companies` | edinet_code | 企業マスタ |
| `documents` | doc_id | 提出書類メタ |
| `period_financials` | (edinet_code, period_end, doc_type) | 期ごとの財務 JSON (summary/pl/bs/cf) |
| `company_metrics` | sec_code | スクリーナー用指標スナップショット |
| `shareholder_snapshots` | (sec_code, period_end) | 大株主時系列 |
| `raw_files_index` | file_id | R2 上の生ファイル索引 |
| `pipeline_runs` | run_id | 取り込みジョブ記録 |
| `daily_metrics` | snapshot_date | 日次集計カウント |
| `sec_code_latest_periods` | sec_code | **deprecated** — `company_metrics` で代替。seed 残骸のみ |

型は `$inferSelect` から導出して export（`Company`, `Document`, `PeriodFinancial` ...）。

## クエリ (queries.ts)

| 関数 | 用途 |
|---|---|
| `listCompanies(db, {limit, offset, industry})` | 企業一覧 |
| `getCompanyBySecCode` / `getCompanyByEdinetCode` | 単一企業 |
| `getSummaryBySecCode(db, secCode)` | 時系列財務（period_end 降順） |
| `getCompanyMetrics` / `getAllCompanyMetrics` / `queryCompanyMetrics` | スクリーナー指標 |
| `getShareholdersBySecCode(db, secCode)` | 大株主スナップショット |
| `searchCompanies(db, q, limit)` | 名称・証券コード LIKE 検索 |
| `countCompanies` / `countCompanyMetrics` | 件数 |

`DB` 型 = `DrizzleD1Database<typeof schema>`。`apps/api` がこれを import して D1 を叩く。

## マイグレーション

```bash
# schema.ts を変更したら再生成
pnpm --filter @edinet/db db:generate     # migrations/NNNN_*.sql を生成

# ローカル SQLite に適用
pnpm --filter @edinet/db db:migrate:local

# D1 へ適用（apps/api 経由）
pnpm --filter @edinet/api db:migrate:staging
pnpm --filter @edinet/api db:migrate:production
```

`migrations/0000_init.sql` と `0001_company_metrics.sql` は Python (`apps/wrapper/src/edinet_wrapper/db.py`) も読むため、スキーマ変更時は生成物を必ずコミットする。

## 設計上のポイント

- schema.ts を単一の正本とし、D1・ローカル SQLite・Python の 3 者が同じ DDL を共有する。
- D1 にトリガがない等の差分は drizzle が吸収する。
- `sec_code_latest_periods` は daily-refresh で更新されない。新規コードは `company_metrics` を参照すること。
