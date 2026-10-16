# クレジット

本プロジェクトは、以下の第三者オープンソースソフトウェアを利用または参照しています。

---

## SakanaAI / edinet2dataset

データ取り込みパイプライン（`apps/wrapper`）は
[SakanaAI/edinet2dataset](https://github.com/SakanaAI/edinet2dataset) を参考にしています。

```
Copyright 2024 Sakana AI

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## EDINET（金融庁）

財務データは金融庁 EDINET から取得しています。

出典: [EDINET閲覧（提出）サイト](https://disclosure.edinet-fsa.go.jp/)、[公共データ利用規約 PDL1.0](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)

本プロジェクトのデータは EDINET 開示情報をもとに加工したものです。

---

## gBizINFO（経済産業省）

任意の法人概要スナップショット（`--gbiz-csv`）は
[gBizINFO](https://info.gbiz.go.jp/) の公開情報をもとに加工できる。

出典: [gBizINFO](https://info.gbiz.go.jp/)、[公共データ利用規約 PDL1.0](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0)

---

## Wikidata / Wikipedia

上場企業の欠けた設立日を埋める enrichment（`apps/wrapper/fixtures/company-enrichment.csv`）は
[Wikidata](https://www.wikidata.org/)（P571 / P3225）と
[日本語 Wikipedia](https://ja.wikipedia.org/) の公開情報を参照する。
検索で入れた行は `source=wikidata` / `wikipedia` / `web_search` と URL が付く。

出典: [Wikidata](https://www.wikidata.org/)、[Wikipedia](https://ja.wikipedia.org/)、
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
