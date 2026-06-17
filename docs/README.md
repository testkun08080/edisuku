# ドキュメント

| ドキュメント | 内容 |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 全体構造・レイヤ・依存グラフ・データフロー（**まずここ**） |
| [ENV.md](./ENV.md) | 環境変数・Secrets 一覧（必須 / 任意 / 設定場所） |
| [MANUAL_SETUP.md](./MANUAL_SETUP.md) | Docker なしの手動ローカルセットアップ |
| [FORK.md](./FORK.md) | フォーク利用者向けセットアップ・API キー・CI Secrets |

## モジュール別

| モジュール | ドキュメント | 概要 |
|---|---|---|
| `apps/api` | [modules/api.md](./modules/api.md) | Hono on Workers — REST API |
| `apps/web` | [modules/web.md](./modules/web.md) | Vike + React on Workers — UI |
| `apps/wrapper` | [modules/wrapper.md](./modules/wrapper.md) | Python — EDINET 取得・解析 |
| `packages/db` | [modules/db.md](./modules/db.md) | drizzle schema + 共通クエリ |
| `packages/metrics` | [modules/metrics.md](./modules/metrics.md) | 指標計算・flatten・大株主パース |
| `packages/types` | [modules/types.md](./modules/types.md) | API/Web 共通 TS 型 |
| `infra` | [modules/infra.md](./modules/infra.md) | Docker / デプロイ補助 |
