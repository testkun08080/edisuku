# infra — ローカル開発・デプロイ補助

Docker Compose スタックとデプロイ補助スクリプト。Docker なしの手動セットアップは [MANUAL_SETUP.md](../MANUAL_SETUP.md)。Cloudflare へのデプロイは [FORK.md](../FORK.md)。

## ファイル構成

```
infra/
├── compose.yml              dev: db-init + api + web (+ wrapper profile=ingest)
├── compose.prod.yml         本番相当イメージのスモークテスト
├── render-wrangler-config.sh  wrangler テンプレート → 実体（ID/URL 注入）
├── apply-internal-api-key.sh  INTERNAL_API_KEY を Cloudflare secret に登録
├── init/
│   ├── seed-local-d1.sql           11 社サンプル（コミット済み）
│   ├── company_metrics.sql         スクリーナー指標（コミット済み）
│   ├── shareholder_snapshots.sql   大株主（コミット済み）
│   ├── prepare-local-d1.sh         ローカル D1 へ初回投入
│   ├── dev-local.sh                ホスト `pnpm dev` 用（.dev.vars 補正 + D1 + turbo）
│   ├── web.dev.vars.docker         Compose 専用（API_UPSTREAM_URL=http://api:8787）
│   ├── regenerate-sample.sh        メンテナ向け再生成（`pnpm sample:regenerate`）
│   └── fetch-sample-data.sh        wrapper 用 SQLite（`data/edinet.db`、任意）
```

## compose.yml（開発）

```bash
mkdir -p data          # ボリュームマウント先（gitignore 済）
docker compose -f infra/compose.yml up
# → web  http://localhost:3000
# → api  http://localhost:8787
```

| service | 役割 |
|---|---|
| `db-init` | （任意）wrapper 用にローカルで `data/edinet.db` を生成。API はローカル D1 を使用 |
| `api` | `prepare-local-d1.sh` で同梱 SQL をローカル D1 に初回投入 → `pnpm dev` |
| `web` | `web.dev.vars.docker` をマウント（`API_UPSTREAM_URL=http://api:8787`）。`api-proxy` は URL 設定時は binding より HTTP を優先 |
| `wrapper` | `profiles: [ingest]`。通常は起動せず手動取り込み用 |

```bash
# EDINET 取り込みを手動実行
docker compose -f infra/compose.yml --profile ingest run wrapper
```

各 Dockerfile は `dev` / `builder` / `production` のマルチステージ。compose.yml は `target: dev`、compose.prod.yml は `target: production`。

## フォーク利用者向けデプロイ

Cloudflare リソースの作成・wrangler 設定・GitHub Secrets は [FORK.md](../FORK.md) の wrangler CLI 手順を参照。

| スクリプト | 用途 |
|---|---|
| `infra/render-wrangler-config.sh` | `wrangler.{toml,jsonc}.template` に ID/URL を注入（`--target api\|web\|all`、デフォルト `all`） |
| `infra/apply-internal-api-key.sh` | `.internal-api-key` を Cloudflare secret に登録 |
| `.internal-api-key.example` | 本番用キーのサンプル（プレースホルダ） |

### GitHub Secrets（CI）

| 種類 | 名前 |
|---|---|
| Secret | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `EDINET_API_KEY` |
| Secret | `D1_STAGING_ID`, `D1_PRODUCTION_ID`, `KV_STAGING_ID`, `KV_PRODUCTION_ID` |
| Secret | `STAGING_WEB_URL`, `PROD_WEB_URL` |
| Secret | `INTERNAL_API_KEY`（任意・記録用。ランタイムは Worker secret） |

## fetch-sample-data.sh

ローカルで `0000_init.sql` + `seed-local-d1.sql` から `data/edinet.db` を生成します。外部ダウンロードは行いません。

## Cloudflare リソース命名（edisuku-*）

| 種類 | ローカル | staging | production | Worker binding |
|------|----------|---------|------------|----------------|
| API Worker | `edisuku-api` | `edisuku-api-staging` | `edisuku-api` | — |
| Web Worker | `edisuku-web` | `edisuku-web-staging` | `edisuku-web` | — |
| Web → API | — | service `API` → `edisuku-api-staging` | service `API` → `edisuku-api` | `API`（web のみ） |
| D1 | `edisuku-local` | `edisuku-db-staging` | `edisuku-db` | `EDISUKU_DB`（API のみ） |
| KV | — | `EDISUKU_CACHE` | `EDISUKU_CACHE` | `EDISUKU_CACHE`（任意） |
| R2 | — | — | `edisuku-data` | `EDISUKU_DATA`（任意） |

workers.dev URL 例: `https://edisuku-web.<subdomain>.workers.dev`

Web Worker は API プロキシのみのため D1 binding は持ちません。

npm パッケージ名（`@edinet/api` 等）や DB カラム `edinet_code` は EDINET データ仕様のため変更しません。

## wrangler 設定の扱い

- `*.template` のみ git 管理（placeholder 入り）
- 実体 `wrangler.toml` / `wrangler.jsonc` は `.gitignore`（公式 ID 誤コミット防止）
- ローカル開発は template コピーまたは `render-wrangler-config.sh` で生成
