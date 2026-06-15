# @edinet/web

Vike + React on Cloudflare Workers. UI for the EDINET financial screener.

Data is fetched from `@edinet/api` via `hono/client` in `lib/api.ts`.

## Dev

```bash
pnpm --filter @edinet/web dev
# http://localhost:3000
```

API calls use same-origin `/api/*`; the web Worker proxies to the API Worker using `API_UPSTREAM_URL` and `INTERNAL_API_KEY` from `.dev.vars` (see `.dev.vars.example`).

## Deploy

```bash
# one-time: see docs/FORK.md — infra/render-wrangler-config.sh
pnpm --filter @edinet/web deploy:staging
```
