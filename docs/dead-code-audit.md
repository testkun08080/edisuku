# Dead code audit (2026-06-20)

静的解析 + コードレビューに基づく棚卸し。staging D1 の実データは `pnpm audit:staging-db` で再取得する（要 Cloudflare 認証）。

## 実施済み配線（daily-refresh）

| 項目 | 変更 |
|------|------|
| `shareholder_snapshots` | ingest 時に TSV から抽出 → `publish_to_d1` delta に含める |
| `companies.industry` / `listed_category` | `build-company-metrics.mjs` が `metrics_json` に merge → API で返却 |
| `pipeline_runs` / `daily_metrics` | daily-refresh 終了時に `emit_pipeline_meta.py` → D1 |
| `raw_files_index` / `sec_code_latest_periods` | **削除済み**（`0002_drop_legacy_tables.sql`） |

### 初回 backfill（staging / production）

daily delta は新規 ingest 分のみ。既存 corpus の大株主は 1 回限り:

```bash
# D1 export → corpus.db のあと（TSV がローカルに残る場合のみ）
pnpm db:backfill:shareholders-corpus /tmp/corpus.db /tmp/shareholder_snapshots.sql
cd apps/api && pnpm exec wrangler d1 execute edisuku-db-staging --remote --env staging --file /tmp/shareholder_snapshots.sql
```

D1 のみ export した corpus では `raw_tsv_path` が CI ローカルパスのため TSV が無く skip される。全量更新には re-ingest（`backfill.py`）が必要。

---

## 判定表

| 対象 | 区分 | 判断 |
|------|------|------|
| `getDocumentIds`, `countAll` | 死にコード | **削除済み** |
| 未使用 shadcn UI（avatar, checkbox, …） | 死にコード | **削除済み** |
| `apps/web/lib/parse-major-shareholders.ts` | 重複 | **削除済み** → `@edinet/metrics` |
| `apps/web/components/Link.tsx` | 死にコード | **削除済み** |
| `raw_files_index`, `sec_code_latest_periods` | 旧パイプライン残骸 | **テーブル DROP 済み**（`0002_drop_legacy_tables.sql`） |
| `pipeline_runs`, `daily_metrics` | daily-refresh | **書き込み実装済み**（`emit_pipeline_meta.py`） |
| `GET /api/companies`, `/api/manifest` | API 未使用 | 外部 API 想定なら維持 |
| `TableDownloadButton` | 意図的スタブ | `CSV_EXPORT_ENABLED=false` |
| `ColumnVisibilityContext` vs `getScreenerColumns` | 重複 | 将来統合候補 |
| `period_financials.raw_tsv_path` | 低価値 | D1 上は CI パス。将来 R2 キー化 |
| `documents.ordinance_code` 等 | 低利用 | ingest のみ書込、API 未参照 |

---

## 静的解析（Knip / Ruff）

```bash
pnpm audit:dead-code   # knip + ruff F401/F841
pnpm audit:staging-db  # staging D1 クエリ（要認証）
```

### Knip ハイライト（設定: `knip.json`）

- **意図的に除外**: `infra/init/*.mjs`（CLI スクリプト）、`apps/wrapper/**`
- **Web 未使用 dependency 候補**: `react-share`, `cmdk`, `shadcn`（package.json 確認後に削除可）
- **未使用 export（shadcn 再export）**: `DialogClose`, `SidebarInput` 等 — UI ライブラリの通常パターン

### Ruff（wrapper）

`F401` / `F841`: 問題なし（2026-06-20 時点）

---

## Staging D1 監査（2026-06-20 実測）

> 以下は `0002_drop_legacy_tables.sql` 適用**前**のスナップショット（参照用）。`raw_files_index` / `sec_code_latest_periods` は以降 DROP。

[Staging audit](682bdf5a-65bd-4537-86de-5c8b234d060e) が OAuth 経由で接続済み。配線 PR マージ前のスナップショット:

| 指標 | 値 | 備考 |
|------|-----|------|
| `shareholder_snapshots` | **0 行** | `/api/shareholders` が空。配線後は daily ingest + 初回 backfill が必要 |
| `company_metrics` max(updated_at) | 2026-06-18 | daily-refresh は稼働中 |
| `sec_code_latest_periods` max(updated_at) | 2026-05-15 | seed 残骸（deprecated） |
| `companies` with industry | 494 | 配線後は metrics API にも載る |
| `period_financials` CI `raw_tsv_path` | 156 行 | D1 上はローカルパス |
| `raw_files_index` / `pipeline_runs` | 1410 / 4 行 | 2026-04 頃の旧 R2/corpus-seed パイプライン由来。現 daily-refresh は未更新 |

### `raw_files_index` / `pipeline_runs` 調査（2026-06-20）

現リポジトリに INSERT コードは無い。staging サンプル:

- `raw_files_index.object_key`: `raw/annual/2026/04/E12441/S100XK2I.json`（R2 想定パス）
- `pipeline_runs.scope`: `daily-refresh`, `corpus-seed`（2026-04-26 〜 05-07）

→ 過去の別実装が書き込んだデータ。現パイプラインとは無関係。**deprecated 扱いで維持 or DROP は要相談**。

---

再実行:

```bash
bash infra/render-wrangler-config.sh --target api --env staging  # wrangler.toml 未生成時
pnpm audit:staging-db
```

監査スクリプトが取得する項目:

- 全テーブル件数
- `pipeline_runs` / `daily_metrics` の最新行
- `shareholder_snapshots` vs `company_metrics` の `updated_at` 鮮度
- `companies.industry` 件数
- `period_financials` にあって `company_metrics` に無い sec_code
- `raw_tsv_path LIKE 'data/raw/%'` 件数

---

## テスト

```bash
cd apps/wrapper && uv run pytest
pnpm turbo test --filter=@edinet/db --filter=@edinet/metrics --filter=@edinet/api
```
