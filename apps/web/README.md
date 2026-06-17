# @edinet/web

Cloudflare Workers 上の Vike + React。EDINET 財務スクリーナーの UI です。

データは `lib/api.ts` の `hono/client` 経由で `@edinet/api` から取得します。

## 開発

```bash
pnpm --filter @edinet/web dev
# http://localhost:3000
```

API 呼び出しは同一オリジンの `/api/*` を使用します。ローカルでは `.dev.vars` の `API_UPSTREAM_URL` と `INTERNAL_API_KEY` で API Worker にプロキシします。remote では **service binding**（`API`）を使用します。環境変数一覧: [docs/ENV.md](../../docs/ENV.md)

## デプロイ

```bash
# 初回のみ: docs/FORK.md — infra/render-wrangler-config.sh
pnpm --filter @edinet/web deploy:staging
```
