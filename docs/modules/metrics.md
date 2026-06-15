# packages/metrics — 指標計算・スクリーナー列定義

`period_financials` の JSON からスクリーナー用の指標行を組み立てる共有 TypeScript パッケージ。API・Web・infra の backfill スクリプトが同じロジックを参照する。

パッケージ名: `@edinet/metrics`

## ファイル構成

```
packages/metrics/
├── src/
│   ├── metricsFromPeriods.ts   期間データ → CompanyMetricsRow
│   ├── flattenMetricsRow.ts    DB 行 ↔ フラット列
│   ├── columns.ts              screener_columns.json を読み込み
│   ├── screener_columns.json   スクリーナー列定義（単一ソース）
│   ├── piotroski.ts            Piotroski F-Score
│   ├── consecutiveDiv.ts       連続増配年数
│   ├── parseShareholders.ts    大株主 JSON パース
│   └── helpers.ts              日付比較など
└── vitest.config.ts
```

## 主要エクスポート

| 関数 | 用途 |
|---|---|
| `metricsFromPeriods` | SQLite/D1 の期間 JSON から指標を計算 |
| `flattenMetricsRow` | `company_metrics` テーブル向けに列をフラット化 |
| `getScreenerColumns` | UI/API manifest 用の列メタデータ |
| `computePiotroskiFScore` | Piotroski スコア |
| `parseMajorShareholdersFromRaw` | 株主 JSON → API 形式 |

## backfill との関係

```bash
# D1 corpus から company_metrics SQL を生成
pnpm db:backfill:metrics -- /path/to/corpus.db /tmp/company_metrics.sql
```

`infra/init/build-company-metrics.mjs` が `@edinet/metrics` を import し、`company_metrics` への `INSERT OR REPLACE` を出力する。

## 開発

```bash
pnpm --filter @edinet/metrics test
pnpm --filter @edinet/metrics typecheck
```
