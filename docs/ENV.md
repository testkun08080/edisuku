# 環境変数リファレンス

環境変数・Worker binding・GitHub Secrets の一覧。**設定場所ごとに必須 / 任意を分けて記載**しています。

## クイック参照

| コンテキスト | 必須 | 任意 |
|---|---|---|
| ローカル UI 確認（Docker / `pnpm dev`） | `INTERNAL_API_KEY`（api + web 同一）、`API_UPSTREAM_URL`（web のみ） | `PUBLIC_ENV__*`（`.env`） |
| Cloudflare staging / production | `INTERNAL_API_KEY`（secret）、D1 binding、web → api **service binding** | KV、OGP/Analytics/Sentry、R2 |
| GitHub Actions デプロイ | `CLOUDFLARE_*`、`D1_*_ID`、`KV_*_ID`、`STAGING_WEB_URL` / `PROD_WEB_URL` | `INTERNAL_API_KEY`（記録用）、`D1_*_NAME` |
| EDINET 日次取り込み（CI / wrapper） | `EDINET_API_KEY` | `EDINET_REQUEST_DELAY` |

## 設定ファイルの役割

| ファイル | 用途 | git 管理 |
|---|---|---|
| `apps/api/.dev.vars` | api Worker のローカル secret / vars | いいえ（`.dev.vars.example` をコピー） |
| `apps/web/.dev.vars` | web Worker のローカル secret / vars | いいえ |
| `apps/web/.env` | Vite **ビルド時**のクライアント向け `PUBLIC_ENV__*` / `VITE_*` | いいえ（`.env.example` 参照） |
| `.internal-api-key` | 本番 `INTERNAL_API_KEY` のローカルメモ → `apply-internal-api-key.sh` | いいえ |
| `apps/wrapper/.env` | wrapper 用 `EDINET_API_KEY` 等 | いいえ |
| `apps/api/wrangler.toml` | api の binding / vars（`render-wrangler-config.sh` で生成） | いいえ |
| `apps/web/wrangler.jsonc` | web の binding / vars（同上） | いいえ |

**ローカルでは `API_UPSTREAM_URL` を設定する。Cloudflare では不要**（web → api は service binding `API`）。

---

## apps/api（Hono Worker）

### Secret（必須・本番 / staging）

| 変数 | 説明 |
|---|---|
| `INTERNAL_API_KEY` | web BFF が付与する `X-Internal-Api-Key`。`/api/health` 以外は必須。ローカルは `dev-local-key` で可 |

設定: ローカル `apps/api/.dev.vars` / remote `wrangler secret put INTERNAL_API_KEY --env <staging|production>`

### wrangler vars（テンプレートから自動注入）

| 変数 | 必須 | 説明 |
|---|---|---|
| `CORS_ORIGIN` | はい | ブラウザの Origin。ローカル `http://localhost:3000`、remote は `STAGING_WEB_URL` / `PROD_WEB_URL` |
| `API_VERSION` | — | レスポンス用バージョン文字列 |
| `NODE_ENV` | — | `development`（ローカル）/ `production`（remote） |

### Bindings（wrangler.toml、環境変数ではない）

| Binding | 必須 | 説明 |
|---|---|---|
| `EDISUKU_DB` | はい | D1。未設定時はデータ系 API が 500 |
| `EDISUKU_CACHE` | いいえ | KV。`/api/metrics` のスナップショットキャッシュ |
| `EDISUKU_DATA` | いいえ | R2。バックアップ等（現状ワークフロー未使用） |

---

## apps/web（Vike Worker）

### Secret（必須・本番 / staging）

| 変数 | 説明 |
|---|---|
| `INTERNAL_API_KEY` | api と **同一値**。BFF が upstream に付与 |

### ローカル専用（`.dev.vars`）

| 変数 | 必須 | 説明 |
|---|---|---|
| `API_UPSTREAM_URL` | ローカルでははい | 例: `http://127.0.0.1:8787`。設定時は service binding より HTTP を優先。Docker Compose は `http://api:8787` |

**Cloudflare では設定しない**（`wrangler.jsonc` の `services[].binding: API` を使用）。

### Bindings

| Binding | 必須（remote） | 説明 |
|---|---|---|
| `API` | はい | service binding → `edisuku-api-staging` / `edisuku-api` |
| `ASSETS` | はい | 静的アセット（wrangler 自動） |

### wrangler vars（remote）

| 変数 | 必須 | 説明 |
|---|---|---|
| `PUBLIC_ENV__SITE_URL` | 推奨 | サーバー側 sitemap 等。`render-wrangler-config.sh` が `STAGING_WEB_URL` / `PROD_WEB_URL` から注入 |

### ビルド時（`.env` または CI の `env:`）— すべて任意

クライアントバンドルに焼き込まれる（`import.meta.env.PUBLIC_ENV__*`）。未設定でもアプリは動作する。

| 変数 | 説明 | 未設定時 |
|---|---|---|
| `PUBLIC_ENV__SITE_URL` | OGP / canonical URL | `https://edisuku.com` |
| `PUBLIC_ENV__GITHUB_REPO` | フッター等のリポジトリリンク | 上流リポジトリ URL |
| `PUBLIC_ENV__GOOGLE_ANALYTICS` | GA4 測定 ID | 計測なし（コンソール警告） |
| `PUBLIC_ENV__SENTRY_DSN` | Sentry DSN | エラー報告なし |
| `PUBLIC_ENV__CONTACT_FORM_URL` | お問い合わせフォーム URL | 公式デフォルト |
| `VITE_SCREENER_MODE` | `all`（全件取得）/ `server`（サーバー側ページング） | `all` |

フォークで Analytics 等を有効にする場合、**デプロイ前の `pnpm build` 時**に `.env` を置くか、GitHub Actions の build ステップに `env:` を追加してください。wrangler vars だけではクライアント側 `PUBLIC_ENV__*` は反映されません。

---

## apps/wrapper（Python）

| 変数 | 必須 | 説明 | デフォルト |
|---|---|---|---|
| `EDINET_API_KEY` | 取り込み時はい | [EDINET API](https://disclosure.edinet-fsa.go.jp/) のキー | — |
| `EDINET_REQUEST_DELAY` | いいえ | リクエスト間隔（秒） | `3.0` |

設定: `apps/wrapper/.env`（`cp .env.example .env`）またはコマンドライン `--api-key`。

---

## GitHub Secrets（CI）

### デプロイ（`.github/workflows/deploy.yml`）— 必須

| Secret | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers / D1 デプロイ |
| `CLOUDFLARE_ACCOUNT_ID` | 同上 |
| `D1_STAGING_ID` | `render-wrangler-config.sh` → staging D1 `database_id` |
| `D1_PRODUCTION_ID` | 同上（production デプロイ時） |
| `KV_STAGING_ID` | staging KV namespace id |
| `KV_PRODUCTION_ID` | production KV namespace id |
| `STAGING_WEB_URL` | staging の公開 Web URL（`CORS_ORIGIN` / `PUBLIC_ENV__SITE_URL` に注入） |
| `PROD_WEB_URL` | production の公開 Web URL（カスタムドメイン可） |

デプロイは **Actions の `workflow_dispatch`**（手動）。`main` への push だけでは自動デプロイされません。

### 日次取り込み（`.github/workflows/daily-refresh.yml`）

| Secret | 必須 | 用途 |
|---|---|---|
| 上記 `CLOUDFLARE_*` / `D1_*_ID` / `KV_*_ID` | はい | D1 への delta 適用・metrics rebuild |
| `EDINET_API_KEY` | はい | EDINET 取得 |
| `D1_STAGING_NAME` | いいえ | D1 データベース名（未設定: `edisuku-db-staging`） |
| `D1_PRODUCTION_NAME` | いいえ | 同上（未設定: `edisuku-db`） |

**トリガー**: 現状は `workflow_dispatch`（手動）。`schedule`（コメントアウト済み: 毎日 05:10 JST）を有効化すれば cron 実行も可。

**提出日**: `target_date` 未指定時は **昨日 JST**（`ingest_daily.py` と同じ）。

**処理の流れ**: EDINET 取得 → D1 delta 適用 → `company_metrics` 全件 rebuild → KV `screener:metrics:v2` 無効化。

**UI のデータ最終更新日**: D1 反映後、`apps/web/lib/brand.ts` の `DATA_LAST_UPDATED`（`YYYY-MM-DD`）を **手動で更新** してください。プライバシーページ等の「データ最終更新日」表示に使われます（環境変数ではなくコード内定数）。

### 記録用（ランタイムには使わない）

| Secret | 説明 |
|---|---|
| `INTERNAL_API_KEY` | 任意。`apply-internal-api-key.sh` 後のメモ用。**Worker の secret は wrangler で別途登録** |

### `render-wrangler-config.sh` 用の export（ローカル手動デプロイ）

GitHub Secret と同じ名前をシェルで export して `bash infra/render-wrangler-config.sh` を実行します。追加で `WORKERS_SUBDOMAIN` は URL 組み立てのメモ用（スクリプトは読みません）。

---

## 不要・使われていないもの

| 名前 | 理由 |
|---|---|
| `API_UPSTREAM_URL`（Cloudflare） | remote は service binding を使用 |
| `INTERNAL_API_KEY` を GitHub Secret にだけ登録 | ランタイムは wrangler secret。GH Secret だけでは Worker に届かない |
| `DB_PATH`（`infra/compose.yml`） | コード未参照。api はローカル D1 を使用 |
| API の公開 URL を Secret に登録 | web → api は service binding。ブラウザ向け URL は `STAGING_WEB_URL` / `PROD_WEB_URL` のみ |

---

## 環境別チェックリスト

### ローカル（最速: Docker Compose）

```bash
docker compose -f infra/compose.yml up
```

- api: `apps/api/.dev.vars` → `INTERNAL_API_KEY=dev-local-key`（compose が example からコピー）
- web: `infra/init/web.dev.vars.docker` をマウント（`API_UPSTREAM_URL=http://api:8787`）
- `.env` は不要（スクリーナー・OGP のデフォルトで動作）

### ローカル（ホスト: `pnpm dev`）

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.dev.vars.example apps/web/.dev.vars
```

### Cloudflare staging / production

1. `render-wrangler-config.sh`（D1 / KV / Web URL）
2. `apply-internal-api-key.sh`（`INTERNAL_API_KEY` を api + web に登録）
3. 任意: ビルド時 `.env` で `PUBLIC_ENV__*`
4. Actions から `deploy` workflow を手動実行

詳細手順: [FORK.md](./FORK.md)

---

## 関連ドキュメント

- [FORK.md](./FORK.md) — Cloudflare セットアップ手順
- [MANUAL_SETUP.md](./MANUAL_SETUP.md) — Docker なしローカル開発
- [modules/api.md](./modules/api.md) / [modules/web.md](./modules/web.md) — モジュール詳細
