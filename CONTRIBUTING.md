# コントリビューションガイド

ありがとうございます！このプロジェクトは EDINET の財務データを誰でも触れる形にすることを目指しています。

AI エージェント向け: [AGENTS.md](./AGENTS.md)

## 開発環境

| 要件 | 推奨バージョン |
|---|---|
| Node.js | 22 |
| pnpm | 9.12+ |
| uv (Python) | latest |
| Docker | 25+ |
| Cloudflare account | 無料枠で動作 |

### 初回セットアップ

```bash
git clone https://github.com/testkun08080/edisuku.git
cd edisuku
pnpm install
cd apps/wrapper && uv sync && cd ../..

# 最速で動くサンプルを起動
docker compose -f infra/compose.yml up
# http://localhost:3000

# Docker なしでホスト直接セットアップする場合
# → docs/MANUAL_SETUP.md
```

### 自分の Cloudflare へデプロイ

```bash
npx wrangler login
# D1/KV 作成、wrangler 設定、GitHub Secrets — 手順は docs/FORK_SETUP.md
```

詳細は [docs/FORK_SETUP.md](./docs/FORK_SETUP.md)（手順ナビ） / [docs/FORK.md](./docs/FORK.md)（CI 向け）を参照。

### CI/CD で必要な Secrets

一覧（必須 / 任意の区別）は [docs/ENV.md](./docs/ENV.md) を参照。初回設定は [FORK.md](./docs/FORK.md) の手順 2.6:

| 種類 | 名前 | 用途 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Workers / D1 デプロイ |
| Secret | `D1_STAGING_ID` / `D1_PRODUCTION_ID` | wrangler テンプレート生成 |
| Secret | `KV_STAGING_ID` / `KV_PRODUCTION_ID` | 同上 |
| Secret | `STAGING_WEB_URL` / `PROD_WEB_URL` | CORS・OGP 用の公開 Web URL |
| Secret | `EDINET_API_KEY` | 日次取り込み（daily-refresh）のみ |
| Secret | `INTERNAL_API_KEY` | 任意・記録用（ランタイムは wrangler secret） |

## ブランチ運用

- `main` — 常にデプロイ可能
- `feat/*`, `fix/*`, `docs/*`, `chore/*` — 機能/修正/ドキュメント/雑務
- PR は `main` 向けに作成

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) に従ってください。

```
<type>(<scope>): <subject>

[optional body]
```

- `type`: feat / fix / docs / chore / refactor / test / ci / perf
- `scope`: api / web / wrapper / db / types / infra など (任意)

例:
- `feat(api): add /api/metrics endpoint`
- `fix(web): correct ROE display when equity is 0`

## プルリクエスト

- 1 PR = 1 トピック
- `pnpm biome check .` と `pnpm -r typecheck` がグリーンであること
- 変更がランタイムに影響する場合は changeset を追加: `pnpm changeset`
- ユーザー体験に影響する変更は PR 説明にスクリーンショット添付

## Lint / フォーマット

- TypeScript: [Biome](https://biomejs.dev/) — `pnpm lint:fix`
- Python: [Ruff](https://docs.astral.sh/ruff/) — `cd apps/wrapper && uv run ruff check --fix .`
- pre-commit に [lefthook](https://github.com/evilmartians/lefthook) を使用 — `pnpm lefthook install` (任意)

## テスト

```bash
pnpm turbo test                          # TypeScript
cd apps/wrapper && uv run pytest         # Python
```

## 開発を始める前のお願い

- 大きな変更は事前に Issue で議論してください
- データソース (EDINET) の利用規約を尊重してください
- 機密情報 (API キー、wrangler 上の database_id 等) をコミットに含めないでください

## 行動規範

[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) に従ってください。

## 質問・サポート

- バグ報告: [Issues](https://github.com/testkun08080/edisuku/issues)
- 機能要望: Issue + `enhancement` label
- セキュリティ: [SECURITY.md](./SECURITY.md)
