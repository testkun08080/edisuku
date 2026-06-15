"""Tests for edinet_wrapper.ingest helpers and ingest_date."""

from __future__ import annotations

import json
import sqlite3
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from edinet_wrapper.ingest import (
    _extract_doc_ids,
    ingest_date,
    normalize_sec_code,
    parse_known_docs,
    to_flat_dict,
)
from edinet_wrapper.schema import Result


def test_normalize_sec_code():
    assert normalize_sec_code("  72030  ") == "7203"
    assert normalize_sec_code('"7203"') == "7203"
    assert normalize_sec_code(None) is None
    assert normalize_sec_code("") is None


def test_parse_known_docs_plain_list(tmp_path: Path):
    path = tmp_path / "known.json"
    path.write_text(json.dumps(["S100AAA", "S100BBB"]), encoding="utf-8")
    assert parse_known_docs(path) == {"S100AAA", "S100BBB"}


def test_parse_known_docs_wrangler_format():
    raw = [{"results": [{"doc_id": "S100AAA"}, {"doc_id": "S100BBB"}], "success": True}]
    assert _extract_doc_ids(raw) == {"S100AAA", "S100BBB"}


def test_to_flat_dict_picks_current_year():
    flat = to_flat_dict({"NetSales": {"Prior1Year": "900", "CurrentYear": "1000"}})
    assert flat["NetSales"] == "1000"


def _make_result(**overrides) -> Result:
    base = {
        "seqNumber": 1,
        "docID": "S100TEST",
        "edinetCode": "E00001",
        "secCode": "72030",
        "JCN": "",
        "filerName": "テスト株式会社",
        "fundCode": "",
        "ordinanceCode": "010",
        "formCode": "030000",
        "docTypeCode": "120",
        "periodStart": "2024-04-01",
        "periodEnd": "2025-03-31",
        "submitDateTime": "2025-06-12 10:00",
        "docDescription": "有価証券報告書",
        "issuerEdinetCode": "",
        "subjectEdinetCode": "",
        "subsidiaryEdinetCode": "",
        "currentReportReason": "",
        "parentDocID": "",
        "opeDateTime": "",
        "withdrawalStatus": "0",
        "docInfoEditStatus": "",
        "disclosureStatus": "",
        "xbrlFlag": "1",
        "pdfFlag": "1",
        "attachDocFlag": "0",
        "englishDocFlag": "0",
        "csvFlag": "1",
        "legalStatus": "",
    }
    base.update(overrides)
    return Result.from_json(base)


@pytest.fixture
def sqlite_conn(tmp_path: Path):
    conn = sqlite3.connect(str(tmp_path / "test.db"))
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


def test_ingest_date_skips_known_and_withdrawn(sqlite_conn, tmp_path: Path):
    known = {"S100KNOWN"}
    withdrawn = _make_result(docID="S100WD", withdrawalStatus="1")
    skipped_known = _make_result(docID="S100KNOWN")
    fresh = _make_result(docID="S100FRESH")

    downloader = MagicMock()
    downloader.get_results.return_value = [withdrawn, skipped_known, fresh]
    downloader.get_doc_type_from_result.return_value = "annual"
    downloader.edinet_code_info.filter.return_value.height = 0

    tsv_path = tmp_path / "raw" / "annual" / "2025" / "06" / "E00001" / "S100FRESH.tsv"
    tsv_path.parent.mkdir(parents=True)
    tsv_path.write_text("dummy", encoding="utf-8")

    def fake_download(doc_id, file_type, output_dir):
        assert doc_id == "S100FRESH"
        assert file_type == "tsv"

    downloader.download_document.side_effect = fake_download

    financial = MagicMock()
    financial.meta = {"当会計期間終了日": "2025-03-31"}
    financial.summary = {}
    financial.pl = {}
    financial.bs = {}
    financial.cf = {}

    with (
        patch("edinet_wrapper.ingest.upsert_company"),
        patch("edinet_wrapper.ingest.upsert_document"),
        patch("edinet_wrapper.ingest.upsert_period_financial") as upsert_pf,
        patch("edinet_wrapper.ingest.parse_tsv", return_value=financial),
    ):
        stats = ingest_date(
            sqlite_conn,
            downloader,
            date(2025, 6, 12),
            known_doc_ids=known,
            raw_root=tmp_path / "raw",
        )

    assert stats.fetched == 1
    assert stats.ingested == 1
    assert stats.skipped == 2
    assert stats.errors == 0
    upsert_pf.assert_called_once()
    assert "S100FRESH" in known
