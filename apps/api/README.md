# @edinet/api

Cloudflare Workers 上の Hono API。drizzle 経由で D1 を読み、`apps/web` に JSON を返します。

## ローカル開発

```bash
# 1. テンプレートをコピー（ローカル）または infra/render-wrangler-config.sh を実行（デプロイ）
cp wrangler.toml.template wrangler.toml
cp .dev.vars.example .dev.vars

# 2. ローカル D1（miniflare）で起動
pnpm --filter @edinet/api dev
# → http://localhost:8787/api/health
```

環境変数: [docs/ENV.md](../../docs/ENV.md)（必須は `INTERNAL_API_KEY` のみ）

## エンドポイント

| Method | Path                          | 説明                                |
|--------|-------------------------------|--------------------------------------------|
| GET    | `/api/health`                 | ヘルスチェック                               |
| GET    | `/api/companies`              | 企業一覧（ページネーション付き）               |
| GET    | `/api/companies/:secCode`     | 企業詳細（secCode または edinetCode）     |
| GET    | `/api/summaries/:secCode`     | 時系列財務サマリー                              |
| GET    | `/api/metrics`                | スクリーナーテーブル用の最新スナップショット     |
| GET    | `/api/search?q=`              | 社名 / secCode の全文検索     |
| GET    | `/api/shareholders/:secCode`  | 大株主                         |
| GET    | `/api/manifest`               | カラムマニフェスト（UI メタデータ）              |

## web との型共有

```ts
// apps/web/lib/api.ts
import { hc } from "hono/client";
import type { AppType } from "@edinet/api";

export const api = hc<AppType>(""); // web BFF 同一オリジンプロキシ
```
