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
│   ├── 0002_drop_legacy_tables.sql  DROP raw_files_index / sec_code_latest_periods
│   ├── 0003_company_profile.sql  companies プロフィール列 / officer_snapshots
│   └── meta/          drizzle-kit のスナップショット
└── drizzle.config.ts  dialect: sqlite, driver: d1-http
```

## テーブル (schema.ts)

| テーブル | 主キー | 用途 |
|---|---|---|
| `companies` | edinet_code | 企業マスタ（プロフィール列含む・現在値） |
| `documents` | doc_id | 提出書類メタ |
| `period_financials` | (edinet_code, period_end, doc_type) | 期ごとの財務 JSON (summary/pl/bs/cf) |
| `company_metrics` | sec_code | スクリーナー用指標スナップショット |
| `shareholder_snapshots` | (sec_code, period_end) | 大株主時系列 |
| `officer_snapshots` | (sec_code, period_end) | 役員（氏名・役職・生年月日）時系列 |
| `pipeline_runs` | run_id | 日次取り込みジョブ記録（daily-refresh 終了時に書込） |
| `daily_metrics` | snapshot_date | コーパス全体件数の日次スナップショット（提出日キー） |

型は `$inferSelect` から導出して export（`Company`, `Document`, `PeriodFinancial`, `OfficerSnapshot` ...）。

### `companies` プロフィール列（0003）

| 列 | 意味 | 主なソース |
|---|---|---|
| `corporate_number` | 法人番号 (JCN) | EDINET コードリスト |
| `filer_name_en` | 提出者名（英字） | コードリスト |
| `filer_name_kana` | 提出者名（ヨミ） | コードリスト |
| `address` | 所在地 | コードリスト |
| `head_office_address` | 本店の所在の場所 | 有報カバー META |
| `phone` | 電話番号 | カバー META |
| `representative` | 代表者の役職氏名 | カバー META |

現在値のみ保持（履歴は持たない）。取得パイプラインは [wrapper.md — company-profile](./wrapper.md#company-profile)。

### `officer_snapshots`（0003）

| 列 | 意味 |
|---|---|
| `sec_code` / `period_end` | 複合 PK（大株主と同型） |
| `doc_id` | 元書類 |
| `entries_json` | `OfficerEntry[]`（`name`, `title`, `birthDate`, `roleGroup`） |
| `updated_at` | delta export 用 |

有報（annual）ingest 時のみ更新。パースは wrapper `officers.py` / metrics `parseOfficers.ts`。

## クエリ (queries.ts)

| 関数 | 用途 |
|---|---|
| `listCompanies(db, {limit, offset, industry})` | 企業一覧 |
| `getCompanyBySecCode` / `getCompanyByEdinetCode` | 単一企業 |
| `getSummaryBySecCode(db, secCode)` | 時系列財務（period_end 降順） |
| `getCompanyMetrics` / `getAllCompanyMetrics` / `queryCompanyMetrics` | スクリーナー指標 |
| `getShareholdersBySecCode(db, secCode)` | 大株主スナップショット |
| `getOfficersBySecCode(db, secCode)` | 役員スナップショット |
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

`migrations/0000_init.sql`〜`0003_company_profile.sql` は Python (`apps/wrapper/src/edinet_wrapper/db.py`) も読むため、スキーマ変更時は生成物を必ずコミットする。既存 DB の legacy テーブル削除は `0002_drop_legacy_tables.sql`、企業プロフィール列追加は `0003_company_profile.sql` を `pnpm db:migrate:staging` / `production` で適用する。

`apps/api` の wrangler は `migrations_dir = "../../packages/db/migrations"` を参照し、`--env staging|production` 付きで apply する（`package.json` の `db:migrate:*`）。リモート DB を以前 `d1 execute --file` だけで初期化している場合、`d1_migrations` 履歴が空だと 0000 から再実行して失敗する。そのときは適用済みタグ（0000〜0002 等）を `d1_migrations` に baseline してから `migrations apply` し、未適用の `0003` だけ流す。

## 設計上のポイント

- schema.ts を単一の正本とし、D1・ローカル SQLite・Python の 3 者が同じ DDL を共有する。
- D1 にトリガがない等の差分は drizzle が吸収する。
- `pipeline_runs` / `daily_metrics` は `emit_pipeline_meta.py` 経由で daily-refresh 終了時に D1 へ書込む。
- プロフィールは `companies` 現在値、役員は期次スナップショット（`shareholder_snapshots` と同パターン）。
