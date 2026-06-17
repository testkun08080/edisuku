# apps/wrapper — Python EDINET 取得・解析

EDINET からデータを取得・パースし、ローカル SQLite に書き、差分を D1 へ送る。`uv` 管理で **pnpm workspace 外**。

パッケージ名: `edinet-wrapper` (Python)

## ファイル構成

```
apps/wrapper/
├── src/edinet_wrapper/
│   ├── downloader.py        EDINET API クライアント（リトライ・rate limit）
│   ├── parser.py            TSV → Polars → FinancialData
│   ├── ingest.py            日次/バックフィル ingest の共有ロジック
│   ├── element_id_table.py  XBRL element ID → 日本語ラベル辞書 (BS/PL/CF/SUMMARY)
│   ├── schema.py            Metadata / Result / FinancialData データモデル
│   └── db.py                SQLite UPSERT + updated_at ベースの delta export
├── scripts/
│   ├── ingest_daily.py      当日提出分を取得 → ローカル SQLite
│   ├── publish_to_d1.py     SQLite 差分 → D1 用 SQL ファイル
│   └── backfill.py          過去 N 年バルク取り込み
├── tests/
│   └── test_ingest.py       ingest ヘルパのユニットテスト
├── pyproject.toml           deps + pytest 設定
└── Dockerfile
```

## ingest フロー

1. `Downloader.get_results(date, date)` で EDINET 提出一覧を取得
2. 既知 `doc_id`（`--known-docs`）と doc_type（annual / quarterly / semiannual / large_holding）でフィルタ
3. TSV ダウンロード → `parse_tsv` → `db.upsert_*`
4. `publish_to_d1.py` が `updated_at` 差分を D1 用 SQL に変換
5. GitHub Actions `daily-refresh.yml` が日次で上記 + `company_metrics` rebuild（`companies` テーブル起点）を実行

指標計算（ROE / Piotroski 等）は **`packages/metrics`** が担当。wrapper は生の period_financials を D1 に載せる。

### db.py

- `open_db(path)` / `apply_schema(conn)` — `packages/db/migrations/0000_init.sql` を読んで初期化
- `upsert_company / upsert_document / upsert_period_financial`
- `export_inserts_after(conn, since_ts)` — `updated_at >= since` の行を `INSERT OR REPLACE` 文として yield（publish_to_d1 が利用）

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

# 過去 N 年
uv run python scripts/backfill.py --years 5 --output data/edinet.db
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
