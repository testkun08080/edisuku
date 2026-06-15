# edisuku

[![ci](https://github.com/testkun08080/edisuku/actions/workflows/ci.yml/badge.svg)](https://github.com/testkun08080/edisuku/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

リポジトリ名 **edisuku** — EDINET から有価証券報告書を取得・解析し、Web スクリーナーで可視化する **オープンソース** の財務データプラットフォーム。Cloudflare Workers の無料枠で動作する。

## 30 分でフォークから自分のデプロイまで

```bash
# 1. fork & clone (5 min)
gh repo fork <owner>/edisuku --clone
cd edisuku

# 2. ローカルでサンプル UI を確認 (5 min)
docker compose -f infra/compose.yml up
# → http://localhost:3000
# Docker なし: docs/MANUAL_SETUP.md

# 3. 自分の Cloudflare アカウントへセットアップ (10 min)
pnpm install
npx wrangler login
# → docs/FORK.md の wrangler CLI 手順（D1/KV 作成、render-wrangler-config.sh）
cp .internal-api-key.example .internal-api-key   # 編集して自分の秘密に
bash infra/apply-internal-api-key.sh             # Cloudflare に登録

# 4. push → GitHub Actions が自動デプロイ (10 min)
git push
# → https://edisuku-api-staging.<your-subdomain>.workers.dev
# → https://edisuku-web-staging.<your-subdomain>.workers.dev
```

## アーキテクチャ

```
EDINET API
  ↓
apps/wrapper (Python: 取得・解析)
  ↓ SQLite delta
Cloudflare D1
  ↓ drizzle
apps/api (Hono on Workers)
  ↓ hono/client (型安全)
apps/web (Vike + React on Workers)
  ↓
ユーザー
```

## モノレポ構成

```
apps/
  api/        Hono on Workers (REST API)
  web/        Vike + React on Workers (UI)
  wrapper/    Python: EDINET 取得・解析
packages/
  db/         drizzle schema + 共通クエリ
  metrics/    指標計算・flatten・大株主パース（単一ソース）
  types/      API/Web 共通 TS 型
infra/
  compose.yml              ローカル開発
  compose.prod.yml         本番相当スモーク
  render-wrangler-config.sh  wrangler テンプレート生成
docs/
  ARCHITECTURE.md     全体構造・データフロー
```

## ローカル開発

| 方法 | 手順 |
|---|---|
| Docker Compose（推奨・最速） | `docker compose -f infra/compose.yml up` → http://localhost:3000 |
| ホスト直接 | [docs/MANUAL_SETUP.md](./docs/MANUAL_SETUP.md) |

11 社分のサンプル DB（seed + 指標 + 大株主）は `infra/init/*.sql` に同梱済み。初回起動時にローカル D1 へ投入され、毎回の再生成は不要です。

## 開発コマンド

```bash
pnpm dev                       # 全 apps を並列起動 (turbo) — 手動セットアップ後
pnpm lint                      # biome check
pnpm typecheck                 # 全 workspace で tsc --noEmit
pnpm test                      # turbo test
pnpm changeset                 # changeset 作成
pnpm sample:regenerate         # サンプル SQL 再生成（メンテナ向け）
```

Python:

```bash
cd apps/wrapper
uv sync
uv run pytest
uv run python scripts/ingest_daily.py --help
```

## 環境変数

| 変数名 | 用途 | 必要箇所 |
|---|---|---|
| `EDINET_API_KEY` | EDINET API キー | wrapper |
| `CLOUDFLARE_API_TOKEN` | Workers / D1 デプロイ | CI |
| `CLOUDFLARE_ACCOUNT_ID` | 同上 | CI |
| `INTERNAL_API_KEY` | API 認証（web BFF → api） | 自分で設定（[docs/FORK.md](./docs/FORK.md)） |
| `API_UPSTREAM_URL` | web がプロキシする API の URL | web Worker secret（`render-wrangler-config.sh` / `apply-internal-api-key.sh`） |
| `WORKERS_SUBDOMAIN` | workers.dev のサブドメイン | GitHub Secret（CI デプロイ用） |
| `PUBLIC_ENV__SENTRY_DSN` | Sentry DSN (任意) | web |

## ドキュメント

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 全体構造・依存グラフ・データフロー
- [docs/modules/](./docs/modules/) — モジュール別ドキュメント (api / web / wrapper / db / metrics / types / infra)
- [docs/MANUAL_SETUP.md](./docs/MANUAL_SETUP.md) — Docker なしの手動ローカルセットアップ
- [docs/FORK.md](./docs/FORK.md) — フォーク利用者向けセットアップ・セキュリティ
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 開発フロー
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md) — 脆弱性報告

## ライセンス

[MIT](./LICENSE)

## クレジット

- 財務データ: [EDINET](https://disclosure.edinet-fsa.go.jp/)（金融庁）— [公共データ利用規約 PDL1.0](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0) に基づき利用・加工
- データ取得パイプライン参照: [SakanaAI/edinet2dataset](https://github.com/SakanaAI/edinet2dataset)（Apache 2.0）— 詳細は [CREDITS.md](./CREDITS.md)
- ホスティング: [Cloudflare Workers](https://workers.cloudflare.com/)
