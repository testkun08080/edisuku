# 大株主データ一時インポート（edinet-wagatoushi）

歴史データ補完のため、`edinet-wagatoushi` リポジトリの `public/data/shareholders/*.json` を edisuku の `shareholder_snapshots` テーブルへ投入する**一時的なワンショット手順**です。恒常パイプライン（daily-refresh）とは独立しています。

## 前提

- [edinet-wagatoushi](https://github.com/) リポジトリをローカルに clone 済みであること
- 入力ディレクトリ（デフォルト）:
  ```
  ../edinet-wagatoushi/edinet-screener/public/data/shareholders/
  ```
- 環境変数 `WAGATOUSHI_SHAREHOLDERS_DIR` で入力パスを上書き可能
- 生成 SQL は **git にコミットしない**（`/tmp/shareholder_import/` 等）

データ規模の目安: 約 3,900 社 / 55,000 スナップショット。

## ローカルで SQL を生成

```bash
# パス確認
ls "${WAGATOUSHI_SHAREHOLDERS_DIR:-../edinet-wagatoushi/edinet-screener/public/data/shareholders}/7203.json"

# スモーク（先頭 5 ファイル）
LIMIT=5 pnpm db:import:shareholders-wagatoushi

# 全量
pnpm db:import:shareholders-wagatoushi \
  /path/to/edinet-wagatoushi/edinet-screener/public/data/shareholders \
  /tmp/shareholder_import
```

### オプション

| オプション | 説明 |
|------------|------|
| `--limit N` / `LIMIT=N` | 先頭 N ファイルのみ処理 |
| `--corpus-db PATH` | edisuku の `companies` に存在する `sec_code` のみ対象 |
| `--chunk-size N` | 1 SQL ファイルあたりの INSERT 数（デフォルト: 1000） |

出力: `/tmp/shareholder_import/shareholder_import_001.sql` 形式のチャンクファイル群。

## ローカル D1 で検証（任意）

```bash
# ローカル D1 準備済みの場合
cd apps/api
pnpm exec wrangler d1 execute edisuku-local --local --yes \
  --file /tmp/shareholder_import/shareholder_import_001.sql

pnpm exec wrangler d1 execute edisuku-local --local --yes \
  --command "SELECT COUNT(*) AS c FROM shareholder_snapshots"

# API 確認（pnpm dev 起動中）
curl -s -H "X-Internal-Api-Key: <key>" \
  "http://localhost:3000/api/shareholders/7203" | jq '.snapshots | length'
```

UI 確認時は分析ページで **書類種別を「通期」または「半期」**、表示年数を **10年** に設定してから「大株主」タブを開く（デフォルトの四半期ビューでは列が一致せず空に見える）。

## 推奨ロールアウト（staging 10% → production 全量）

全 52 チャンク（約 51,000 INSERT / 54 MB）をいきなり本番に流さず、**staging で先頭 10% 程度を試してから production に全適用**する手順。

| 段階 | 対象 | チャンク | INSERT 目安 | 所要時間目安 |
|------|------|--------|-------------|--------------|
| 1 | staging | 先頭 **5** ファイル | 約 5,000（全体の **~10%**） | 約 2〜5 分 |
| 2 | staging 検証 | API / UI / audit | — | 数分 |
| 3 | production | **全 52** ファイル | 約 51,000 | 約 15〜25 分 |

staging は 10% のまま残してもよい（本番前のスモーク用途）。staging も全量に揃えたい場合は、段階 1 のあと残り 47 チャンクを追加適用する（下記「staging 残り」参照）。

### 0. SQL 生成（未実施なら）

```bash
pnpm db:import:shareholders-wagatoushi \
  /Users/dangpee/Git/edinet-wagatoushi/edinet-screener/public/data/shareholders \
  /tmp/shareholder_import
```

### 1. staging に 10% 適用

```bash
bash infra/render-wrangler-config.sh --target api --env staging
cd apps/api

# 先頭 5 チャンクのみ（001〜005）
STAGING_CHUNKS=5
i=0
for f in /tmp/shareholder_import/shareholder_import_*.sql; do
  i=$((i + 1))
  [ "$i" -gt "$STAGING_CHUNKS" ] && break
  echo "[$i/$STAGING_CHUNKS] Applying $f"
  pnpm exec wrangler d1 execute edisuku-db-staging --remote --env staging --yes --file "$f"
done
```

件数確認:

```bash
cd ../..  # リポジトリルート
pnpm audit:staging-db
```

または直接:

```bash
cd apps/api
pnpm exec wrangler d1 execute edisuku-db-staging --remote --env staging --yes --json \
  --command "SELECT COUNT(*) AS rows, COUNT(DISTINCT sec_code) AS companies FROM shareholder_snapshots"
```

**検証ポイント**

- `rows` がおおよそ **5,000** 前後（既存行がある場合はそれに加算）
- staging API で先頭チャンクに含まれる銘柄を確認（例: **1301**）:
  ```bash
  curl -s -H "X-Internal-Api-Key: <key>" \
    "https://<staging-api>/api/shareholders/1301" | jq '.snapshots | length'
  ```
- staging Web で同銘柄の大株主タブ（**通期/半期 + 10年**）

> チャンクは `sec_code` 辞書順。先頭 5 ファイルは **1301 付近**の銘柄で、**7203 は 035 番目**のチャンク。トヨタで UI 確認したい場合は staging に `shareholder_import_035.sql` を追加で 1 本流すか、production 全適用後に本番 UI で確認する。

### 2. production に全量適用

staging で問題なければ本番へ。**全 52 チャンク**を適用する。

```bash
bash infra/render-wrangler-config.sh --target api --env production
cd apps/api

total=$(ls /tmp/shareholder_import/shareholder_import_*.sql | wc -l | tr -d ' ')
i=0
for f in /tmp/shareholder_import/shareholder_import_*.sql; do
  i=$((i + 1))
  echo "[$i/$total] Applying $f"
  pnpm exec wrangler d1 execute edisuku-db --remote --env production --yes --file "$f"
done
```

本番確認:

```bash
pnpm exec wrangler d1 execute edisuku-db --remote --env production --yes --json \
  --command "SELECT COUNT(*) AS rows, COUNT(DISTINCT sec_code) AS companies FROM shareholder_snapshots"
```

`companies` がおおよそ **3,900**、`rows` が **51,000** 前後になっていることを確認。

### staging 残り（任意）

staging も本番と同じ全量に揃える場合、006 以降を適用:

```bash
cd apps/api
i=0
for f in /tmp/shareholder_import/shareholder_import_*.sql; do
  i=$((i + 1))
  [ "$i" -le 5 ] && continue   # 既に適用済みの 10% をスキップ
  echo "[$i] Applying $f"
  pnpm exec wrangler d1 execute edisuku-db-staging --remote --env staging --yes --file "$f"
done
```

## staging への適用（全量・一括）

段階的ロールアウトではなく staging に一度で全量入れる場合:

1. SQL を全量生成（上記）
2. wrangler 設定:
   ```bash
   bash infra/render-wrangler-config.sh --target api --env staging
   ```
3. チャンクを順次適用:
   ```bash
   cd apps/api
   for f in /tmp/shareholder_import/shareholder_import_*.sql; do
     echo "Applying $f"
     pnpm exec wrangler d1 execute edisuku-db-staging --remote --env staging --yes --file "$f"
   done
   ```
4. 件数確認:
   ```bash
   pnpm audit:staging-db
   ```
   `shareholder_snapshots distinct sec_code` が数千件規模になっていることを確認。
5. staging Web で銘柄（例: 7203）の大株主タブを通期/半期 + 10年で確認。

## production への適用（全量・一括）

段階的ロールアウトではなく production に一度で全量入れる場合（**staging 10% 検証後を推奨**）:

```bash
bash infra/render-wrangler-config.sh --target api --env production
cd apps/api
for f in /tmp/shareholder_import/shareholder_import_*.sql; do
  pnpm exec wrangler d1 execute edisuku-db --remote --env production --yes --file "$f"
done
```

## 注意事項

- リモート投入時の `Ok to proceed?` 確認は **`--yes`（`-y`）** でスキップ（52 チャンクを手動で回すとき必須）
- `INSERT OR REPLACE` のため、同じ SQL を再実行しても idempotent
- 同一 `(sec_code, period_end)` に複数 doc がある場合、**docID 辞書順最大**の1件を採用
- ratio は 0〜1 の小数（ingest 経路と同じ）
- daily-refresh の corpus backfill（TSV 再パース）は D1 上では TSV 不在のため no-op になりがち。本手順はその補完用
- 恒常運用は引き続き daily ingest + delta で新規分を更新

## 関連

- スクリプト: `infra/init/import-shareholders-from-wagatoushi.mjs`
- コマンド: `pnpm db:import:shareholders-wagatoushi`
- 既存 backfill（TSV あり corpus）: `pnpm db:backfill:shareholders-corpus`
