---
"@edinet/api": patch
"@edinet/types": patch
"@edinet/db": patch
"@edinet/web": patch
---

Expose `dataLastUpdated` on `/api/manifest` from D1 `daily_metrics` and show it on the privacy page via SSR (no manual `brand.ts` updates after daily-refresh).
