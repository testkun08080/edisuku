# fixtures

リポジトリに同梱する参照用スナップショット。作業中の再生成結果は gitignore の `data/` に置く。

## `company-enrichment.csv`

上場企業の設立日（と、同じ枠で後から足す属性）を出典つきで保持する。

| 列 | 内容 |
| --- | --- |
| `edinet_code` / `sec_code` / `filer_name` | EDINET 側 |
| `field` | 最初は `date_of_establishment` |
| `value` / `precision` | ISO 日付、または年・月。`precision` は `date` / `month` / `year` |
| `source` | `gbiz`（公式）/ `wikidata` / `wikipedia` / `web_search` |
| `source_url` / `source_qid` / `query` | 出典。検索埋めはここを見て判別する |
| `retrieved_at` / `notes` / `error` | 取得時刻と補足 |

`source=gbiz` がある社は検索結果で上書きしない。読み出しは gBiz を優先し、空なら検索値。

再生成（`apps/wrapper` で）:

```bash
uv run python scripts/enrich_establishment_dates.py
# 任意: 手元の gBiz スナップショットを seed
uv run python scripts/enrich_establishment_dates.py --gbiz-csv path/to/gbiz-listed.csv
cp data/company-enrichment.csv fixtures/company-enrichment.csv
```

出典は [CREDITS.md](../../../CREDITS.md) を参照。
