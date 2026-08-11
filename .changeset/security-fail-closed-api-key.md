---
"@edinet/api": patch
---

Fail closed when `INTERNAL_API_KEY` is unset (including local development); always require a configured key except for `/api/health`.
