# apps/wrapper — Python EDINET 取得・解析

EDINET からデータを取得・パースし、ローカル SQLite に書き、差分を D1 へ送る。`uv` 管理で **pnpm workspace 外**。

パッケージ名: `edinet-wrapper` (Python)

## ファイル構成

```
apps/wrapper/
├── src/edinet_wrapper/
│   ├── downloader.py        EDINET API クライアント（リトライ・rate limit）+ コードリスト
│   ├── parser.py            TSV → Polars → FinancialData（META 含む）
│   ├── ingest.py            日次/バックフィル ingest の共有ロジック
│   ├── officers.py          有報「役員の状況」TSV パース
│   ├── element_id_table.py  XBRL element ID → 日本語ラベル辞書 (META/BS/PL/CF/SUMMARY)
│   ├── schema.py            Metadata / Result / FinancialData データモデル
│   ├── db.py                SQLite UPSERT + updated_at ベースの delta export
│   ├── enrichment.py        出典つき設立日（gBiz 優先、検索は空欄のみ）
│   └── establishment_lookup.py  Wikidata / Wikipedia / Web 検索
├── scripts/
│   ├── ingest_daily.py      当日提出分を取得 → ローカル SQLite
│   ├── publish_to_d1.py     SQLite 差分 → D1 用 SQL ファイル
│   ├── emit_pipeline_meta.py  pipeline_runs / daily_metrics 用 SQL 出力
│   ├── backfill.py          過去 N 年バルク取り込み
│   └── enrich_establishment_dates.py  上場企業の設立日を出典つきで埋める
├── tests/
│   ├── test_ingest.py
│   ├── test_cover_profile.py
│   ├── test_officers.py
│   ├── test_enrichment.py
│   └── test_establishment_lookup.py
├── pyproject.toml           deps + pytest 設定
└── Dockerfile
```

## ingest フロー（全体）

1. `Downloader.get_results(date, date)` で EDINET 提出一覧を取得
2. 既知 `doc_id`（`--known-docs`）と doc_type（annual / quarterly / semiannual / large_holding）でフィルタ
3. **コードリスト**から企業マスタ項目を取得し `upsert_company`（documents より先。FK のため）
4. TSV ダウンロード → `parse_tsv` → 財務 / カバー META / 大株主 / 役員を `db.upsert_*`
5. `publish_to_d1.py` が `updated_at` 差分を D1 用 SQL に変換（`companies` / `documents` / `period_financials` / `shareholder_snapshots` / `officer_snapshots`）
6. GitHub Actions `daily-refresh.yml` が日次で上記 + `company_metrics` rebuild + `emit_pipeline_meta.py` を実行

指標計算（ROE / Piotroski 等）は **`packages/metrics`** が担当。wrapper は生の period_financials を D1 に載せる。役員パースの TypeScript 正本は `packages/metrics/src/parseOfficers.ts`（Python `officers.py` と同ロジック）。

### db.py

- `open_db(path)` / `apply_schema(conn)` — `0000`〜`0003` を必要に応じて適用（`officer_snapshots` 未作成なら `0003_company_profile.sql`）
- `upsert_company` / `upsert_document` / `upsert_period_financial` / `upsert_shareholder_snapshot` / `upsert_officer_snapshot`
- `export_inserts_after(conn, since_ts)` — `updated_at >= since` の行を `INSERT OR REPLACE` として yield

`upsert_company` のプロフィール列は `COALESCE(excluded.*, companies.*)`。ingest が `NULL` を渡しても既存値を消さない。

---

## 企業プロフィール・役員データ

<a id="company-profile"></a>

migration `0003_company_profile.sql` で追加。スキーマ正本は [db.md](./db.md)。API は [api.md](./api.md)、UI フラグは [ENV.md](../ENV.md) / [web.md](./web.md)。

### 保存先とソース

| 保存先 | 列 / JSON | 取得元 | 対象 doc_type | 備考 |
|---|---|---|---|---|
| `companies` | `corporate_number` | EDINET コードリスト「提出者法人番号」 | 全 ingest 対象 | JCN |
| `companies` | `filer_name_en` | コードリスト「提出者名（英字）」 | 同上 | |
| `companies` | `filer_name_kana` | コードリスト「提出者名（ヨミ）」 | 同上 | |
| `companies` | `address` | コードリスト「所在地」 | 同上 | マスタ上の所在地 |
| `companies` | `representative` | 有報カバー META「代表者の役職氏名」 | annual / semiannual | XBRL → JP ラベル経由 |
| `companies` | `head_office_address` | カバー META「本店の所在の場所」 | annual / semiannual | 注記付き文字列もあり得る |
| `companies` | `phone` | カバー META「電話番号」 | annual / semiannual | |
| `officer_snapshots` | `entries_json` | 有報 TSV「役員の状況」 | **annual のみ** | 期ごとスナップショット |

上場区分・業種（`listed_category` / `industry`）も従来どおりコードリストから取得する。

`companies` は **現在値マスタ**（最新 ingest で上書き更新）。役員は `shareholder_snapshots` と同型で **`(sec_code, period_end)` ごと**に残す。

### コードリスト（`_company_meta`）

`Downloader.edinet_code_info`（提出者コードリスト）を `ＥＤＩＮＥＴコード` で引き、次の列を読む（`ingest.py`）:

- `上場区分` → `listed_category`
- `提出者業種` → `industry`
- `提出者法人番号` → `corporate_number`
- `提出者名（英字）` → `filer_name_en`
- `提出者名（ヨミ）` → `filer_name_kana`
- `所在地` → `address`

行が無い場合はすべて `None`。

### カバー META（`cover_profile_from_meta`）

`parse_tsv` が `element_id_table.META` で XBRL element ID を日本語キーに変換した `parsed.meta` から抽出する。

| XBRL element ID（抜粋） | META 日本語キー | DB 列 |
|---|---|---|
| `TitleAndNameOfRepresentativeCoverPage` | 代表者の役職氏名 | `representative` |
| `AddressOfRegisteredHeadquarterCoverPage` | 本店の所在の場所 | `head_office_address` |
| `TelephoneNumberAddressOfRegisteredHeadquarterCoverPage` | 電話番号 | `phone` |

- 対象: `doc_type in ("annual", "semiannual")`。四半期などはカバー抽出をスキップし `NULL` を渡す（COALESCE で既存維持）。
- 注記（「（注）」等）は除去しない。原文のまま保存する。

### 役員パース（`officers.py`）

有価証券報告書 TSV の「役員の状況」から氏名・役職・生年月日を取る。

**ロールグループ**

| roleGroup | 要素 ID プレフィックス（概念） |
|---|---|
| `directors` | `…InformationAboutDirectorsAndCorporateAuditors`（取締役・監査役） |
| `executive` | `…InformationAboutExecutiveDirectors`（執行役） |

対象フィールド: `Name` / `OfficialTitleOrPosition` / `DateOfBirth`。

**ルール**

- `コンテキストID` に `Member` を含む行のみ（個人行）
- element ID に `Proposal` を含む行は除外（株主提案など）
- 役職・生年月日が `－` のときは `null`
- 氏名が空のエントリは捨てる
- **annual かつ `sec_code` あり**のときだけ `upsert_officer_snapshot`
- エントリが 1 件以上のときだけ UPSERT（空配列では書かない）

**`entries_json` の形**（API / `@edinet/types` の `OfficerEntry` と同型）:

```json
[
  {
    "name": "山田太郎",
    "title": "代表取締役社長",
    "birthDate": "1960-01-15",
    "roleGroup": "directors"
  }
]
```

TypeScript 側の同等実装: `packages/metrics/src/parseOfficers.ts`（フィクスチャ `packages/metrics/fixtures/officers-wagatoushi-sample.rows.json`）。

### ingest 内の処理順序（1 書類）

```
get_results → filter
  → _company_meta（コードリスト）
  → upsert_company（コードリスト項目のみ）   ← documents より先（FK）
  → upsert_document
  → download TSV → parse_tsv
  → cover_profile_from_meta（annual/semiannual）
  → upsert_company（カバーで代表者・本店・電話を上書き可能）
  → upsert_period_financial
  → shareholder_snapshots（annual/semiannual）
  → officer_snapshots（annual のみ）
```

### D1 への載せ方

日次パイプラインではローカル SQLite の `updated_at` 差分にプロフィール列・`officer_snapshots` が含まれる。既存リモート DB にスキーマが無い場合は先に migration `0003` を適用する（手順は [db.md](./db.md)）。

既存企業への過去分バックフィルは、当該期間の annual TSV を再 ingest するか、同等の UPSERT SQL を流す必要がある（スキーマ適用だけでは列・テーブルは空のまま）。

### テスト

| ファイル | 内容 |
|---|---|
| `tests/test_cover_profile.py` | カバー META 抽出（注記保持含む） |
| `tests/test_officers.py` | 役員 TSV パース / API JSON 形 |
| `tests/test_ingest.py` | FK 順（company → document）、カバーの companies 反映 |
| `tests/test_enrichment.py` | 設立日パース、gBiz 優先、CSV 入出力 |
| `tests/test_establishment_lookup.py` | Wikipedia / Web 抽出 |

---

## スクリプト

```bash
# 日次取り込み
EDINET_API_KEY=... uv run python scripts/ingest_daily.py \
    --date 2026-05-25 --output data/edinet.db \
    --known-docs /tmp/known.json

# D1 用 delta SQL 生成（CF 認証不要）
uv run python scripts/publish_to_d1.py \
    --source data/edinet.db --since 2026-05-24T00:00:00 --output /tmp/delta.sql

# D1 へ反映（リポジトリルートから）
wrangler d1 execute edisuku-db --remote --file /tmp/delta.sql

# 日次メタ（pipeline_runs / daily_metrics）
uv run python scripts/emit_pipeline_meta.py \
    --target-date 2026-05-25 --scope daily-refresh-staging --run-id local-1 \
    --status success --started-at 2026-05-26T00:00:00 --finished-at 2026-05-26T00:30:00 \
    --fetched 10 --ingested 8 --skipped 2 --errors 0 \
    --company-count 4000 --document-count 50000 --period-financial-count 35000 \
    --output /tmp/pipeline_meta.sql

# 過去 N 年
uv run python scripts/backfill.py --years 5 --output data/edinet.db

# 上場企業の設立日（出典つき）。作業出力は data/、スナップショットは fixtures/
uv run python scripts/enrich_establishment_dates.py
uv run python scripts/enrich_establishment_dates.py --gbiz-csv path/to/gbiz-listed.csv
```

## 開発

```bash
cd apps/wrapper
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## 設計上のポイント

- スキーマ正本は `packages/db`（drizzle）。Python は生成 SQL を読むだけで TS に依存しない。
- ローカル SQLite は ephemeral。状態は D1 が持ち、差分は `updated_at` で抽出する一方通行。
- スクリーナーカラム定義は `packages/metrics/src/screener_columns.json` が正本。
- 企業プロフィールの「マスタ現在値」と役員の「期次スナップショット」を分離する（大株主と同じパターン）。
- 設立日は D1 にまだ載せず、`company-enrichment.csv` に出典（`gbiz` / `wikidata` / `wikipedia` / `web_search`）つきで置く。gBiz がある行は検索で上書きしない。
