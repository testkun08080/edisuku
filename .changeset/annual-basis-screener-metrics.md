---
"@edinet/metrics": patch
"@edinet/web": patch
"@edinet/api": patch
---

Fix screener metrics to use a single reporting basis. Semi-annual filings carry the fiscal year end as `periodEnd`, so `sorted.at(-1)` was picking 6-month figures and presenting them as full-year for ~82% of companies, breaking sort and filter. Period selection now falls back annual → semi-annual → quarterly and records the chosen kind as `reportKind`, with the screener defaulting to annual-only.

Also fixes the backfill's `LIMIT 6` window (which starved `consecutiveDivIncreases`/`piotroskiFScore` to ~99% null), removes `roic`/`netCash`/`netCashRatio`/`PBR` from the UI as underivable from EDINET data (values retained in `metrics_json`), drops the fabricated ¥2,500 share-price fallback in `dividendYield`, and bumps `METRICS_SCHEMA_VERSION` to `v3`.
