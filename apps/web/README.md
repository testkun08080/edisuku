# @edinet/web

Cloudflare Workers 上の Vike + React。EDINET 財務スクリーナーの UI です。

データは `lib/api.ts` の `hono/client` 経由で `@edinet/api` から取得します。

## 開発

```bash
pnpm --filter @edinet/web dev
# http://localhost:3000
```

API 呼び出しは同一オリジンの `/api/*` を使用します。web Worker は `.dev.vars`（`.dev.vars.example` 参照）の `API_UPSTREAM_URL` と `INTERNAL_API_KEY` を使って API Worker にプロキシします。

## デプロイ

```bash
# 初回のみ: docs/FORK.md — infra/render-wrangler-config.sh
pnpm --filter @edinet/web deploy:staging
```
