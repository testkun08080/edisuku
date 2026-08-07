# Cloudflare セットアップ（手順ナビ）

フォーク後、**staging と production** を Cloudflare に載せるためのガイドです。  
`render-wrangler-config.sh` は使わず、**リソースを 1 つ作る → 設定ファイルに書く → 確認** を繰り返します。

CI 向けの一括設定（`render-wrangler-config.sh` + GitHub Secrets のみ）は [FORK.md](./FORK.md) §2 を参照してください。

## 完成イメージ

| 種類 | staging | production | 設定ファイル |
|------|---------|------------|--------------|
| D1 | `edisuku-db-staging` | `edisuku-db` | `apps/api/wrangler.toml` |
| KV | `EDISUKU_CACHE` | `EDISUKU_CACHE` | 同上（namespace は環境ごとに別 ID） |
| API Worker | `edisuku-api-staging` | `edisuku-api` | 同上（`deploy` で作成） |
| Web Worker | `edisuku-web-staging` | `edisuku-web` | `apps/web/wrangler.jsonc` |

公開 URL（workers.dev の例）:

| 環境 | Web | API |
|------|-----|-----|
| staging | `https://edisuku-web-staging.<subdomain>.workers.dev` | `https://edisuku-api-staging.<subdomain>.workers.dev` |
| production | `https://edisuku-web.<subdomain>.workers.dev` | `https://edisuku-api.<subdomain>.workers.dev` |

`<subdomain>` は Cloudflare ダッシュボードの Workers サブドメインです。  
production でカスタムドメインを使う場合は後述のステップ 4 を参照してください。

---

## ステップ 0 — 準備

```bash
pnpm install
npx wrangler login
npx wrangler whoami
```

メモ用:

| 変数名 | staging | production |
|--------|---------|------------|
| D1 `database_id` | `STAGING_D1_ID` | `PROD_D1_ID` |
| KV namespace `id` | `STAGING_KV_ID` | `PROD_KV_ID` |
| Web 公開 URL | `STAGING_WEB_URL` | `PROD_WEB_URL` |

---

## ステップ 1 — D1 を 2 つ作る

```bash
cd apps/api
npx wrangler d1 create edisuku-db-staging
npx wrangler d1 create edisuku-db
cd ../..
```

それぞれの **`database_id`** をメモします。

確認:

```bash
npx wrangler d1 list | grep edisuku-db
```

---

## ステップ 2 — API 用 `wrangler.toml` を用意

### 2a. テンプレートをコピー

```bash
cp apps/api/wrangler.toml.template apps/api/wrangler.toml
```

### 2b. staging セクションを編集

`[env.staging]` 内の 3 か所:

```toml
[env.staging.vars]
CORS_ORIGIN = "https://edisuku-web-staging.<subdomain>.workers.dev"

[[env.staging.d1_databases]]
binding = "EDISUKU_DB"
database_name = "edisuku-db-staging"
database_id = "<STAGING_D1_ID>"

[[env.staging.kv_namespaces]]
binding = "EDISUKU_CACHE"
id = "00000000-0000-0000-0000-000000000001"   # ダミー（次ステップで差し替え）
```

`STAGING_WEB_URL` として URL をメモしておきます。

### 2c. production セクションを編集

```toml
[env.production.vars]
CORS_ORIGIN = "https://edisuku-web.<subdomain>.workers.dev"
# カスタムドメインの場合: CORS_ORIGIN = "https://your-domain.com"

[[env.production.d1_databases]]
binding = "EDISUKU_DB"
database_name = "edisuku-db"
database_id = "<PROD_D1_ID>"

[[env.production.kv_namespaces]]
binding = "EDISUKU_CACHE"
id = "00000000-0000-0000-0000-000000000002"   # ダミー（次ステップで差し替え）
```

`PROD_WEB_URL` として `CORS_ORIGIN` と同じ URL をメモします。

確認:

```bash
grep -E 'database_id|CORS_ORIGIN' apps/api/wrangler.toml
```

---

## ステップ 3 — KV namespace を環境ごとに作る

`wrangler.toml` がある状態で実行します。

```bash
cd apps/api
npx wrangler kv namespace create EDISUKU_CACHE --env staging
npx wrangler kv namespace create EDISUKU_CACHE --env production
cd ../..
```

出力の **`id`** をそれぞれメモし、`wrangler.toml` に反映します。

```toml
[[env.staging.kv_namespaces]]
binding = "EDISUKU_CACHE"
id = "<STAGING_KV_ID>"

[[env.production.kv_namespaces]]
binding = "EDISUKU_CACHE"
id = "<PROD_KV_ID>"
```

確認:

```bash
npx wrangler kv namespace list
```

---

## ステップ 4 — Web 用 `wrangler.jsonc` を用意

### 4a. テンプレートをコピー

```bash
cp apps/web/wrangler.jsonc.template apps/web/wrangler.jsonc
```

### 4b. staging

```jsonc
"staging": {
  "name": "edisuku-web-staging",
  "services": [{ "binding": "API", "service": "edisuku-api-staging" }],
  "vars": {
    "PUBLIC_ENV__SITE_URL": "https://edisuku-web-staging.<subdomain>.workers.dev"
  }
}
```

### 4c. production

`PUBLIC_ENV__SITE_URL` を `PROD_WEB_URL` に合わせます。

```jsonc
"production": {
  "name": "edisuku-web",
  "services": [{ "binding": "API", "service": "edisuku-api" }],
  "vars": {
    "PUBLIC_ENV__SITE_URL": "https://edisuku-web.<subdomain>.workers.dev"
  }
}
```

**カスタムドメインを使う場合** — テンプレートの `routes`（`edisuku.com`）を自分のドメインに書き換えるか、使わない場合は `routes` ブロックを削除してください。`zone_name` は Cloudflare に登録済みのゾーン名と一致させます。

確認:

```bash
grep -E 'SITE_URL|edisuku-api' apps/web/wrangler.jsonc
```

---

## ステップ 5 — 両方の D1 にスキーマを入れる

```bash
for db in edisuku-db-staging edisuku-db; do
  npx wrangler d1 execute "$db" --remote \
    --file packages/db/migrations/0000_init.sql
  npx wrangler d1 execute "$db" --remote \
    --file packages/db/migrations/0001_company_metrics.sql
  npx wrangler d1 execute "$db" --remote \
    --file packages/db/migrations/0003_company_profile.sql
done
```

確認:

```bash
cd apps/api
npx wrangler d1 execute edisuku-db-staging --remote --env staging \
  --command "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'"
npx wrangler d1 execute edisuku-db --remote --env production \
  --command "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'"
cd ../..
```

テーブルがあれば OK（行数 0 でも正常）。

---

## ステップ 6 — INTERNAL_API_KEY を登録

api と web、**staging と production の 4 か所**で同じ秘密文字列にします。

```bash
cp .internal-api-key.example .internal-api-key
# プレースホルダを自分の文字列に変更

bash infra/apply-internal-api-key.sh
```

手動で 1 環境だけ登録する例は [FORK.md](./FORK.md) §3 を参照。

---

## ステップ 7 — staging をデプロイ

**API → Web の順**（service binding のため）。

```bash
pnpm deploy:api:staging
pnpm deploy:web:staging
```

確認:

```bash
curl -s "https://edisuku-api-staging.<subdomain>.workers.dev/api/health"
open "https://edisuku-web-staging.<subdomain>.workers.dev"
```

---

## ステップ 8 — production をデプロイ

```bash
pnpm deploy:api:production
pnpm deploy:web:production
```

確認:

```bash
curl -s "https://edisuku-api.<subdomain>.workers.dev/api/health"
open "https://edisuku-web.<subdomain>.workers.dev"
```

GitHub Actions を使う場合は Actions → **deploy** → `staging` または `production` を選択（手動トリガーのみ）。

---

## ステップ 9 — GitHub Secrets（CI を使う場合）

ローカル `pnpm deploy:*` だけならスキップ可。CI（deploy / daily-refresh）を使う場合:

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set D1_STAGING_ID --body "<STAGING_D1_ID>"
gh secret set D1_PRODUCTION_ID --body "<PROD_D1_ID>"
gh secret set KV_STAGING_ID --body "<STAGING_KV_ID>"
gh secret set KV_PRODUCTION_ID --body "<PROD_KV_ID>"
gh secret set STAGING_WEB_URL --body "<STAGING_WEB_URL>"
gh secret set PROD_WEB_URL --body "<PROD_WEB_URL>"
gh secret set EDINET_API_KEY   # daily-refresh 用
```

CI のデプロイは `render-wrangler-config.sh` で wrangler 設定を生成します。手元の `wrangler.toml` / `wrangler.jsonc` と **同じ ID・URL** を Secrets に入れてください。

| Workflow | 用途 |
|----------|------|
| **deploy** | Worker のコードデプロイ（手動） |
| **daily-refresh** | EDINET 取り込み → D1 更新（手動。cron はデフォルト無効） |

---

## ステップ 10 — データ投入（任意）

スキーマのみではスクリーナーは空です。

- Actions → **daily-refresh** → `environment: staging` または `production`
- `EDINET_API_KEY` が必要

取り込み成功後、プライバシーページのデータ最終更新日は D1 から自動反映されます（[ENV.md](./ENV.md)）。

---

## チェックリスト

```
[ ] 0. wrangler login
[ ] 1. D1 ×2（edisuku-db-staging, edisuku-db）
[ ] 2. wrangler.toml — staging + production（D1 ID, CORS, KV ダミー）
[ ] 3. KV ×2 → wrangler.toml に本番 ID 反映
[ ] 4. wrangler.jsonc — staging + production の SITE_URL（必要なら routes 編集）
[ ] 5. 両 D1 に migrations 0000 + 0001
[ ] 6. INTERNAL_API_KEY（apply-internal-api-key.sh）
[ ] 7. deploy staging（api → web）
[ ] 8. deploy production（api → web）
[ ] 9. (任意) GitHub Secrets
[ ] 10. (任意) daily-refresh
```

---

## トラブルシュート

| 症状 | 確認 |
|------|------|
| KV 作成失敗 | `wrangler.toml` の `[env.staging]` / `[env.production]` があるか |
| スクリーナーが空 | データ未投入なら正常 |
| 503 `proxy_misconfigured` | API デプロイ済みか、`INTERNAL_API_KEY` が api/web で同一か |
| CORS エラー | 各環境の `CORS_ORIGIN` と Web の公開 URL が一致しているか |
| production のカスタムドメインが効かない | `wrangler.jsonc` の `routes` / ゾーン設定 |
| GHA 後に設定ずれ | Secrets の ID/URL が手元の設定と一致しているか |

---

## 関連ドキュメント

- [FORK.md](./FORK.md) — 概要・`render-wrangler-config.sh` による CI 向け一括設定
- [ENV.md](./ENV.md) — 環境変数・Secrets 一覧
- [modules/infra.md](./modules/infra.md) — リソース命名
