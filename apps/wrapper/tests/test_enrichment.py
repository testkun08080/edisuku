"""Establishment-date parsing, gBiz-wins merge, and lookup extractors."""

from __future__ import annotations

from pathlib import Path

from edinet_wrapper.enrichment import (
    FIELD_ESTABLISHMENT,
    SOURCE_GBIZ,
    SOURCE_WIKIDATA,
    EnrichmentRow,
    ListedCompany,
    companies_needing_establishment,
    extract_wikipedia_establishment,
    gbiz_blocks,
    load_enrichment_csv,
    parse_establishment_text,
    parse_wikidata_time,
    seed_gbiz_establishment,
    upsert_search_row,
    write_enrichment_csv,
)
from edinet_wrapper.establishment_lookup import date_hit_from_wikipedia


def _row(**overrides: str) -> EnrichmentRow:
    base = EnrichmentRow(
        edinet_code="E00012",
        sec_code="1301",
        filer_name="株式会社極洋",
        field=FIELD_ESTABLISHMENT,
        value="1937-08-27",
        precision="date",
        source=SOURCE_GBIZ,
        source_url="https://info.gbiz.go.jp/",
    )
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def test_parse_iso_and_japanese_dates():
    assert parse_establishment_text("1937-08-27") == ("1937-08-27", "date")
    assert parse_establishment_text("1937-08-27T00:00:00Z") == ("1937-08-27", "date")
    assert parse_establishment_text("1937年8月27日") == ("1937-08-27", "date")
    assert parse_establishment_text("１９３７年８月") == ("1937-08", "month")
    assert parse_establishment_text("1937年") == ("1937", "year")
    assert parse_establishment_text("昭和12年8月27日") == ("1937-08-27", "date")
    assert parse_establishment_text("令和元年5月1日") == ("2019-05-01", "date")
    assert parse_establishment_text("{{開始年月日|1937|8|27}}") == ("1937-08-27", "date")
    assert parse_establishment_text("not a date") is None
    assert parse_establishment_text("0999年1月1日") is None


def test_wikidata_precision_year_only():
    assert parse_wikidata_time("+1937-01-01T00:00:00Z", 9) == ("1937", "year")
    assert parse_wikidata_time("+1937-08-01T00:00:00Z", 10) == ("1937-08", "month")
    assert parse_wikidata_time("+1937-08-27T00:00:00Z", 11) == ("1937-08-27", "date")


def test_wikipedia_infobox_establishment():
    wikitext = """{{基礎情報 会社
|社名 = トヨタ自動車
|設立 = 1937年8月28日
}}
"""
    assert extract_wikipedia_establishment(wikitext) == ("1937-08-28", "date")
    hit = date_hit_from_wikipedia("トヨタ自動車", wikitext)
    assert hit is not None
    assert hit.value == "1937-08-28"
    assert "wikipedia.org" in hit.source_url


def test_gbiz_blocks_search_upsert():
    rows = [_row()]
    assert gbiz_blocks(rows, "E00012", FIELD_ESTABLISHMENT)
    added = upsert_search_row(
        rows,
        _row(
            source=SOURCE_WIKIDATA,
            value="1880-01-01",
            source_url="https://www.wikidata.org/wiki/Q1",
        ),
    )
    assert added is False
    assert len(rows) == 1


def test_search_fills_empty_only_once():
    rows: list[EnrichmentRow] = []
    first = _row(
        source=SOURCE_WIKIDATA, value="1943-03-31", source_url="https://www.wikidata.org/wiki/Q1"
    )
    assert upsert_search_row(rows, first) is True
    second = _row(
        source="wikipedia",
        value="1943-04-01",
        source_url="https://ja.wikipedia.org/wiki/x",
    )
    assert upsert_search_row(rows, second) is False
    assert rows[0].value == "1943-03-31"


def test_seed_gbiz_and_need_list(tmp_path: Path):
    companies = [
        ListedCompany("E00012", "1301", "株式会社極洋", "1010401033225"),
        ListedCompany("E00014", "1332", "株式会社ニッスイ", "1010001016860"),
    ]
    seeded = seed_gbiz_establishment(
        companies,
        [
            {
                "edinet_code": "E00012",
                "date_of_establishment": "1937-08-27",
                "corporate_number": "1010401033225",
            },
            {"edinet_code": "E00014", "date_of_establishment": ""},
        ],
    )
    assert len(seeded) == 1
    assert seeded[0].source == SOURCE_GBIZ
    rows: list[EnrichmentRow] = []
    upsert_search_row(rows, seeded[0])
    need = companies_needing_establishment(companies, rows)
    assert [c.edinet_code for c in need] == ["E00014"]
    out = tmp_path / "company-enrichment.csv"
    write_enrichment_csv(out, rows)
    loaded = load_enrichment_csv(out)
    assert loaded[0].value == "1937-08-27"
    assert loaded[0].source == SOURCE_GBIZ
