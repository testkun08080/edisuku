# fixtures

リポジトリに同梱する参照用スナップショット。作業中の再生成結果は gitignore の `data/` に置く。

## `company-enrichment.csv`

上場企業の設立日を出典つきで保持する。EDINET コードリストの `上場区分=上場`（3,824 社、2026-08-15 取得）を対象に、gBiz は上書きせず空欄だけ埋めた。

取得時点の被覆: **3,154 / 3,824（82.5%）**。内訳は Wikidata 2,812、Wikipedia 323、Web 19。精度は日 2,451 / 月 256 / 年 447。まだ空の 670 社は `company-enrichment-missing.csv`。

| 列 | 内容 |
| --- | --- |
| `edinet_code` / `sec_code` / `filer_name` | EDINET 側 |
| `field` | 最初は `date_of_establishment` |
| `value` / `precision` | ISO 日付、または年・月。`precision` は `date` / `month` / `year` |
| `source` | `gbiz`（公式）/ `wikidata` / `wikipedia` / `web_search` |
| `source_url` / `source_qid` / `query` | 出典。検索埋めはここを見て判別する |
| `retrieved_at` / `notes` / `error` | 取得時刻と補足 |

`source=gbiz` がある社は検索結果で上書きしない。読み出しは gBiz を優先し、空なら検索値。手元に gBiz スナップショットがあれば `--gbiz-csv` で公式日を seed できる。

再生成（`apps/wrapper` で）:

```bash
uv run python scripts/enrich_establishment_dates.py --wikipedia-sitelinks-only
uv run python scripts/enrich_establishment_dates.py --gbiz-csv path/to/gbiz-listed.csv
cp data/company-enrichment.csv fixtures/company-enrichment.csv
```

出典は [CREDITS.md](../../../CREDITS.md) を参照。
