"""Tests for major shareholder TSV parsing."""

from __future__ import annotations

from edinet_wrapper.shareholders import (
    major_shareholders_to_api_entries,
    parse_major_shareholders_from_raw,
)

TSV_FIXTURE_ROWS = [
    [
        "jpcrp_cor:NameMajorShareholders",
        "氏名又は名称",
        "No1MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "サンプルホールディングス株式会社",
    ],
    [
        "jpcrp_cor:AddressMajorShareholders",
        "住所",
        "No1MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "東京都千代田区",
    ],
    [
        "jpcrp_cor:NumberOfSharesHeld",
        "所有株式数",
        "No1MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "128,600,000",
    ],
    [
        "jpcrp_cor:ShareholdingRatio",
        "発行済株式（自己株式を除く。）の総数に対する所有株式数の割合",
        "No1MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "29.91",
    ],
    [
        "jpcrp_cor:NameMajorShareholders",
        "氏名又は名称",
        "No2MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "日本サンプル年金基金",
    ],
    [
        "jpcrp_cor:NumberOfSharesHeld",
        "所有株式数",
        "No2MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "43,000,000",
    ],
    [
        "jpcrp_cor:ShareholdingRatio",
        "発行済株式（自己株式を除く。）の総数に対する所有株式数の割合",
        "No2MajorShareholdersMember",
        "",
        "",
        "",
        "",
        "",
        "10.00",
    ],
]


def test_parse_major_shareholders_from_raw():
    entries = parse_major_shareholders_from_raw({"rows": TSV_FIXTURE_ROWS})
    assert len(entries) == 2
    assert entries[0].rank == 1
    assert entries[0].name == "サンプルホールディングス株式会社"
    assert entries[0].shares == "128,600,000"
    assert entries[0].ratio == "29.91"
    assert entries[1].name == "日本サンプル年金基金"


def test_major_shareholders_to_api_entries():
    entries = parse_major_shareholders_from_raw({"rows": TSV_FIXTURE_ROWS})
    api_entries = major_shareholders_to_api_entries(entries)
    assert api_entries[0] == {
        "name": "サンプルホールディングス株式会社",
        "shares": 128600000,
        "ratio": 0.2991,
    }
    assert api_entries[1]["ratio"] == 0.1
