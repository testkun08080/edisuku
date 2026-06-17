# フォーク・クローン利用者ガイド

このリポジトリをフォークして自分の Cloudflare アカウントで動かす手順です。**API キーは自動生成しません。** サンプルをコピーして、自分で値を決めて設定してください。

## 1. ローカルで UI を確認

サンプルキー `dev-local-key` は **開発専用** です（本番では使わない）。

```bash
# サンプルをコピー（任意 — compose でも自動コピーされます）
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.dev.vars.example apps/web/.dev.vars

docker compose -f infra/compose.yml up
# → http://localhost:3000
```

Docker を使わずホストでセットアップする場合は [MANUAL_SETUP.md](./MANUAL_SETUP.md) を参照。

## 2. Cloudflare リソースの作成（wrangler CLI）

```bash
pnpm install
npx wrangler login
```

`workers.dev` のサブドメインを控えておきます（例: `https://my-worker.acme.workers.dev` なら `acme`）。

### 2.1 D1 データベース

```bash
cd apps/api
npx wrangler d1 create edisuku-db-staging   # database_id をメモ
npx wrangler d1 create edisuku-db           # database_id をメモ
cd ../..
```

### 2.2 wrangler 設定の生成

KV namespace 作成には `wrangler.toml` が必要なため、**仮 KV ID で一度 render → KV 作成 → 本番 ID で再 render** します。

```bash
export WORKERS_SUBDOMAIN=acme   # 自分のサブドメインに置き換え
export STAGING_D1_ID=<staging の database_id>
export PROD_D1_ID=<production の database_id>
export STAGING_KV_ID=00000000-0000-0000-0000-000000000001
export PROD_KV_ID=00000000-0000-0000-0000-000000000002
export STAGING_WEB_URL="https://edisuku-web-staging.${WORKERS_SUBDOMAIN}.workers.dev"
export PROD_WEB_URL="https://edisuku-web.${WORKERS_SUBDOMAIN}.workers.dev"
# カスタムドメイン利用時は PROD_WEB_URL を本番ドメインに（例: https://edisuku.com）

bash infra/render-wrangler-config.sh
```

### 2.3 KV namespace

```bash
cd apps/api
npx wrangler kv namespace create EDISUKU_CACHE --env staging    # id をメモ
npx wrangler kv namespace create EDISUKU_CACHE --env production # id をメモ
cd ../..
```

取得した KV ID で再度 render します。

```bash
export STAGING_KV_ID=<staging KV id>
export PROD_KV_ID=<production KV id>
# STAGING_D1_ID / PROD_D1_ID / URL 系は 2.2 と同じ値のまま
bash infra/render-wrangler-config.sh
```

### 2.4 R2（任意）

```bash
npx wrangler r2 bucket create edisuku-data
```

### 2.5 リモート D1 にスキーマ投入

```bash
for db in edisuku-db-staging edisuku-db; do
  npx wrangler d1 execute "$db" --remote --file packages/db/migrations/0000_init.sql
  npx wrangler d1 execute "$db" --remote --file packages/db/migrations/0001_company_metrics.sql
done
```

### 2.6 GitHub Secrets（CI デプロイ用）

`gh` が使える場合:

```bash
gh secret set CLOUDFLARE_API_TOKEN      # Cloudflare ダッシュボードで発行
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set D1_STAGING_ID --body "$STAGING_D1_ID"
gh secret set D1_PRODUCTION_ID --body "$PROD_D1_ID"
gh secret set KV_STAGING_ID --body "$STAGING_KV_ID"
gh secret set KV_PRODUCTION_ID --body "$PROD_KV_ID"
gh secret set STAGING_WEB_URL --body "$STAGING_WEB_URL"
gh secret set PROD_WEB_URL --body "$PROD_WEB_URL"
# EDINET 日次取り込みを使う場合
gh secret set EDINET_API_KEY
```

## 3. INTERNAL_API_KEY を自分で設定（本番必須）

api Worker と web Worker で **同じ値** にします。

### 手順

```bash
# 1) サンプルをコピーして、プレースホルダを自分の秘密文字列に置き換える
cp .internal-api-key.example .internal-api-key
$EDITOR .internal-api-key
# 例: my-fork-secret-8f3a...  （your-internal-api-key-change-me は使わない）

# 2) Cloudflare に登録（staging + production、api + web）
bash infra/apply-internal-api-key.sh

# 3) 任意 — GitHub に同じ値を記録（CI 用メモ。ランタイムは Worker secret）
gh secret set INTERNAL_API_KEY --body "$(grep -v '^#' .internal-api-key | head -1)"
```

### 1 環境だけ手動で登録する場合

```bash
# staging の例（production も同様に --env production）
printf '%s' 'あなたの秘密文字列' | (cd apps/api && wrangler secret put INTERNAL_API_KEY --env staging)
printf '%s' 'あなたの秘密文字列' | (cd apps/web && wrangler secret put INTERNAL_API_KEY --env staging)
```

### 認証の流れ

```
ブラウザ → web Worker (/api/*)
         → BFF が X-Internal-Api-Key を付与
         → api Worker（不一致なら 401）
```

## 4. デプロイ

### GitHub Actions（推奨）

```bash
git push
```

[deploy ワークフロー](../.github/workflows/deploy.yml) が Worker をデプロイします。**main への push は staging のみ**。production は Actions の `workflow_dispatch` から選択してください。デプロイ**前**に手順 3 を完了してください。

### wrangler CLI から直接

```bash
pnpm deploy:api:staging
pnpm deploy:web:staging
# production
pnpm deploy:api:production
pnpm deploy:web:production
```

## 環境ごとの設定まとめ

| 環境 | ファイル / コマンド | サンプル値 |
|------|---------------------|------------|
| ローカル | `apps/api/.dev.vars` | `INTERNAL_API_KEY=dev-local-key` |
| ローカル | `apps/web/.dev.vars` | 同上 + `API_UPSTREAM_URL=http://127.0.0.1:8787` |
| Cloudflare | `.internal-api-key` → `apply-internal-api-key.sh` | **自分で決める**（example はプレースホルダのみ） |

## GitHub Secrets（CI）

| Secret | 誰が設定するか |
|--------|----------------|
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | あなた |
| `D1_*` / `KV_*` | あなた（手順 2.6） |
| `STAGING_WEB_URL` / `PROD_WEB_URL` | あなた（手順 2.6。カスタムドメイン可） |
| `INTERNAL_API_KEY` | **あなた**（任意・記録用） |
| `EDINET_API_KEY` | あなた（daily-refresh 用） |

web → api の接続は `wrangler.jsonc.template` の **service binding**（`API` → `edisuku-api-staging` / `edisuku-api`）で行います。API の公開 URL を GitHub Secret に登録する必要はありません。

Worker URL（手順 2.2 で export した値を Secret に登録）:

```
$STAGING_WEB_URL
$PROD_WEB_URL
```

## トラブルシュート

| 症状 | 確認 |
|------|------|
| スクリーナーが空 | `apply-internal-api-key.sh` 実行済みか、api/web でキーが同一か |
| `proxy_misconfigured` (503) | web に service binding `API` が設定されているか、`INTERNAL_API_KEY` が api/web で同一か（`bash infra/apply-internal-api-key.sh`） |
| web の `/api/*` が Cloudflare「Page not found」 | `*.workers.dev` では `/api/*` や BFF 用パス・ヘッダーがブロックされる。`lib/api.ts` は `/screener?_q=metrics?...` 経由で `api-proxy` が upstream `/api/...` へ転送する |
| API が 401 | キー不一致。プレースホルダ `your-internal-api-key-change-me` のままではないか |
| `apply-internal-api-key.sh` が失敗 | `.internal-api-key` を編集したか |

## 関連ドキュメント

- [infra モジュール](./modules/infra.md)
- [api モジュール](./modules/api.md)
- [web モジュール](./modules/web.md)
