# AGENTS.md

Cursor / Copilot / Claude など AI エージェント向けの運用ガイド。
EDINET 財務スクリーナー（Cloudflare Workers）のモノレポで、**最小 diff・既存パターン踏襲・秘密の非コミット**を守って作業する。

## Commands

CI（`.github/workflows/ci.yml`）と一致する検証コマンド:

```bash
pnpm install --frozen-lockfile
pnpm biome check apps/api packages/db packages/types packages/metrics apps/web/lib
pnpm turbo typecheck
pnpm turbo test
cd apps/wrapper && uv sync --frozen && uv run ruff check . && uv run ruff format --check . && uv run pytest
```

ローカル開発:

```bash
docker compose -f infra/compose.yml up   # 最速ローカル確認 → http://localhost:3000
pnpm dev                                 # ホスト直接開発（infra/init/dev-local.sh）
```

手動修正（lefthook は check のみ）:

```bash
pnpm lint:fix
cd apps/wrapper && uv run ruff check --fix . && uv run ruff format .
```

## Tech Stack

| 層            | 採用                                  |
| ------------- | ------------------------------------- |
| Node.js       | 22+                                   |
| pnpm          | 9.12                                  |
| Python        | 3.12（`ruff.toml` の target-version） |
| React         | 19                                    |
| API           | Hono on Cloudflare Workers            |
| UI            | Vike + React + shadcn/ui              |
| ORM / DB      | drizzle + Cloudflare D1               |
| ビルド        | Turborepo                             |
| Lint / Format | Biome (TS) / Ruff (Py)                |
| pre-commit    | lefthook                              |

## Project Structure

```
apps/
  api/        Hono on Workers（REST API）
  web/        Vike + React on Workers（UI + BFF プロキシ）
  wrapper/    Python（EDINET 取得・解析、uv 管理、pnpm workspace 外）
packages/
  db/         drizzle schema + 共通クエリ
  metrics/    指標計算・flatten・大株主パース（単一ソース）
  types/      API/Web 共通 TS 型
infra/
  compose.yml              ローカル開発
  compose.prod.yml         本番相当スモーク
  init/                    サンプル DB 取得・D1 シード
  render-wrangler-config.sh  wrangler テンプレート生成
```

## Architecture

```
EDINET API
  → apps/wrapper (Python: 取得・解析・指標計算)
  → Cloudflare D1
  → apps/api (Hono on Workers: REST API)
  → apps/web (Vike + React on Workers: UI)
```

指標・フィルタ定義は `packages/metrics` を単一ソースとする。API と Web の両方から参照する。

## Code Style

- 関係ないリファクタを混ぜない
- コメントは非自明な業務ロジックのみ
- TS: Biome / Py: Ruff（ルート `ruff.toml`）

型安全 API クライアントの慣習:

```typescript
// API 型は apps/api で export → web は hc<AppType> で参照
import type { AppType } from "@edinet/api";
import { hc } from "hono/client";

export const api = hc<AppType>(apiBaseUrl);
```

## Testing

```bash
pnpm turbo test                          # Vitest: packages/db, packages/metrics, apps/api
cd apps/wrapper && uv run pytest         # Python
```

変更に意味のあるテストのみ追加する。自明なテストは不要。

## Git Workflow

- [Conventional Commits](https://www.conventionalcommits.org/): `feat(api):`, `fix(web):` など
- 1 PR = 1 トピック
- ランタイム影響あり → `pnpm changeset`
- lock ファイル（`pnpm-lock.yaml`, `apps/wrapper/uv.lock`）はコミットする

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md)。

## Boundaries

### Always

- `packages/metrics` を指標・フィルタ定義の単一ソースとして扱う
- wrangler 設定は `.template` を編集し、`infra/render-wrangler-config.sh` で生成する
- フォーク・デプロイ手順は [docs/FORK.md](./docs/FORK.md) を参照する

### Ask first

- D1 マイグレーションの追加・変更
- `.github/workflows/` の変更
- 新しい npm / PyPI 依存の追加

### Never

- コミット: `.env`, `.dev.vars`, `.internal-api-key`, 生成済み `apps/api/wrangler.toml`, `apps/web/wrangler.jsonc`
- `git add -f` で上記を強制追加
- 本番 Cloudflare ID / API キー / Sentry DSN / GA ID のハードコード
- `node_modules/`, `dist/`, `.wrangler/`, `data/` のコミット

## Reference

### API エンドポイント

| Method | Path                         |
| ------ | ---------------------------- |
| GET    | `/api/health`                |
| GET    | `/api/companies`             |
| GET    | `/api/companies/:secCode`    |
| GET    | `/api/summaries/:secCode`    |
| GET    | `/api/metrics`               |
| GET    | `/api/metrics/query`         |
| GET    | `/api/search?q=`             |
| GET    | `/api/shareholders/:secCode` |
| GET    | `/api/manifest`              |

### Web グローバル状態 (`apps/web`)

- `ColumnVisibilityContext` — テーブルカラム表示切替
- `FavoritesContext` — お気に入り (localStorage)
- `FilterContext` — フィルタ状態
- `RecentCompaniesContext` — 閲覧履歴

### CI/CD

| ワークフロー        | 役割                                         |
| ------------------- | -------------------------------------------- |
| `ci.yml`            | PR / push 時に lint + typecheck + test       |
| `deploy.yml`        | `workflow_dispatch` で staging/production デプロイ |
| `daily-refresh.yml` | 日次 EDINET 取り込み → D1 → company_metrics rebuild → KV 無効化 |
| `release.yml`       | changesets による version bump とタグ付け    |

### ドキュメント

- [CONTRIBUTING.md](./CONTRIBUTING.md) — 人間向けコントリビューション手順
- [docs/ENV.md](./docs/ENV.md) — 環境変数・Secrets 一覧
- [docs/FORK.md](./docs/FORK.md) — フォーク利用者の Cloudflare セットアップ
- [docs/MANUAL_SETUP.md](./docs/MANUAL_SETUP.md) — Docker なしのローカル開発
- [SECURITY.md](./SECURITY.md) — 脆弱性報告
