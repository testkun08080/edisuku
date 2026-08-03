"""Shared EDINET ingestion logic for ingest_daily and backfill."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import polars as pl
from loguru import logger

from edinet_wrapper.db import (
    upsert_company,
    upsert_document,
    upsert_officer_snapshot,
    upsert_period_financial,
    upsert_shareholder_snapshot,
)
from edinet_wrapper.downloader import Downloader
from edinet_wrapper.officers import officers_to_api_entries, parse_officers_from_tsv
from edinet_wrapper.parser import parse_tsv
from edinet_wrapper.schema import Result
from edinet_wrapper.shareholders import (
    major_shareholders_to_api_entries,
    parse_major_shareholders_from_tsv,
)

DOC_TYPES_DEFAULT = frozenset({"annual", "quarterly", "semiannual", "large_holding"})


def normalize_sec_code(sec_code: str | None) -> str | None:
    if sec_code is None:
        return None
    value = sec_code.strip().strip('"')
    if not value:
        return None
    value = value.lstrip("0") or value
    if len(value) == 5 and value.endswith("0"):
        value = value[:-1]
    return value or None


def parse_known_docs(path: Path | None) -> set[str]:
    """Load doc_ids to skip from a JSON file (plain list or wrangler d1 --json output)."""
    if path is None or not path.exists():
        return set()
    raw = json.loads(path.read_text(encoding="utf-8"))
    return _extract_doc_ids(raw)


def _extract_doc_ids(raw: Any) -> set[str]:
    if raw is None:
        return set()
    if isinstance(raw, str):
        return {raw} if raw else set()
    if isinstance(raw, list):
        ids: set[str] = set()
        for item in raw:
            if isinstance(item, str):
                ids.add(item)
            elif isinstance(item, dict):
                doc_id = item.get("doc_id") or item.get("docID")
                if doc_id:
                    ids.add(str(doc_id))
                elif "results" in item:
                    ids.update(_extract_doc_ids(item["results"]))
        return ids
    if isinstance(raw, dict):
        doc_id = raw.get("doc_id") or raw.get("docID")
        if doc_id:
            return {str(doc_id)}
        if "results" in raw:
            return _extract_doc_ids(raw["results"])
    return set()


def to_flat_dict(d: dict[str, Any]) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for key, value in d.items():
        if isinstance(value, dict):
            for period_key in (
                "CurrentQuarter",
                "CurrentYTD",
                "CurrentYear",
                "Interim",
                "Prior1Interim",
                "Prior1Quarter",
                "Prior1YTD",
                "Prior1Year",
            ):
                if period_key in value and value[period_key] not in ("", None):
                    out[key] = str(value[period_key])
                    break
            else:
                first_value = next((v for v in value.values() if v not in ("", None)), None)
                out[key] = str(first_value) if first_value is not None else None
        else:
            out[key] = str(value) if value is not None else None
    return out


def resolve_target_date(raw: str | None) -> date:
    if raw and raw.strip():
        return date.fromisoformat(raw.strip())
    jst_now = datetime.now(UTC) + timedelta(hours=9)
    return (jst_now - timedelta(days=1)).date()


def iterate_dates(from_d: date, to_d: date):
    current = from_d
    while current <= to_d:
        yield current
        current += timedelta(days=1)


def create_downloader(
    api_key: str | None = None, request_delay_sec: float | None = None
) -> Downloader:
    if api_key:
        os.environ["EDINET_API_KEY"] = api_key.strip()
    return Downloader(request_delay_sec=request_delay_sec)


@dataclass
class IngestStats:
    fetched: int = 0
    ingested: int = 0
    skipped: int = 0
    errors: int = 0


def _cell_str(row: pl.DataFrame, column: str) -> str | None:
    if column not in row.columns:
        return None
    value = row[column][0]
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _company_meta(downloader: Downloader, edinet_code: str) -> dict[str, str | None]:
    row = downloader.edinet_code_info.filter(pl.col("ＥＤＩＮＥＴコード") == edinet_code)
    if row.height == 0:
        return {
            "listed_category": None,
            "industry": None,
            "corporate_number": None,
            "filer_name_en": None,
            "filer_name_kana": None,
            "address": None,
        }
    return {
        "listed_category": _cell_str(row, "上場区分"),
        "industry": _cell_str(row, "提出者業種"),
        "corporate_number": _cell_str(row, "提出者法人番号"),
        "filer_name_en": _cell_str(row, "提出者名（英字）"),
        "filer_name_kana": _cell_str(row, "提出者名（ヨミ）"),
        "address": _cell_str(row, "所在地"),
    }


def _meta_text(meta: dict[str, Any], key: str) -> str | None:
    value = meta.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def cover_profile_from_meta(meta: dict[str, Any]) -> dict[str, str | None]:
    """Extract cover-page profile fields from parse_tsv META (JP labels)."""
    return {
        "representative": _meta_text(meta, "代表者の役職氏名"),
        "head_office_address": _meta_text(meta, "本店の所在の場所"),
        "phone": _meta_text(meta, "電話番号"),
    }


def _result_to_document(result: Result, doc_type: str) -> dict[str, Any]:
    return {
        "doc_id": result.docID,
        "edinet_code": result.edinetCode,
        "sec_code": normalize_sec_code(result.secCode),
        "doc_type": doc_type,
        "ordinance_code": result.ordinanceCode,
        "form_code": result.formCode,
        "doc_type_code": result.docTypeCode,
        "period_start": result.periodStart,
        "period_end": result.periodEnd,
        "submit_date_time": result.submitDateTime,
        "withdrawal_status": result.withdrawalStatus,
        "doc_description": result.docDescription,
        "source_meta": result.to_dict(),
    }


def ingest_date(
    conn,
    downloader: Downloader,
    target: date,
    *,
    known_doc_ids: set[str],
    raw_root: Path,
    doc_types: frozenset[str] = DOC_TYPES_DEFAULT,
    listed_only: bool = True,
) -> IngestStats:
    """Fetch EDINET submissions for one calendar day and upsert into SQLite."""
    stats = IngestStats()
    date_str = target.isoformat()
    results = downloader.get_results(date_str, date_str, listed_only=listed_only)

    for result in results:
        try:
            doc_type = downloader.get_doc_type_from_result(result)
            if doc_type not in doc_types:
                continue
            if result.withdrawalStatus == "1":
                stats.skipped += 1
                continue
            if not result.edinetCode:
                stats.skipped += 1
                continue
            if result.docID in known_doc_ids:
                stats.skipped += 1
                continue

            stats.fetched += 1
            sec_code = normalize_sec_code(result.secCode)
            company_meta = _company_meta(downloader, result.edinetCode)
            upsert_document(conn, _result_to_document(result, doc_type))

            doc_dir = (
                raw_root
                / doc_type
                / target.strftime("%Y")
                / target.strftime("%m")
                / result.edinetCode
            )
            doc_dir.mkdir(parents=True, exist_ok=True)
            downloader.download_document(result.docID, "tsv", str(doc_dir))
            tsv_path = doc_dir / f"{result.docID}.tsv"

            if not tsv_path.exists():
                stats.skipped += 1
                continue

            parsed = parse_tsv(str(tsv_path))
            if parsed is None:
                stats.skipped += 1
                continue

            period_end = result.periodEnd or parsed.meta.get("当会計期間終了日")
            if not period_end:
                stats.skipped += 1
                continue

            cover = (
                cover_profile_from_meta(parsed.meta)
                if doc_type in ("annual", "semiannual")
                else {
                    "representative": None,
                    "head_office_address": None,
                    "phone": None,
                }
            )
            filer_name = result.filerName or str(parsed.meta.get("提出者名") or "")
            upsert_company(
                conn,
                edinet_code=result.edinetCode,
                sec_code=sec_code,
                filer_name=filer_name,
                listed_category=company_meta["listed_category"],
                industry=company_meta["industry"],
                corporate_number=company_meta["corporate_number"],
                filer_name_en=company_meta["filer_name_en"],
                filer_name_kana=company_meta["filer_name_kana"],
                address=company_meta["address"],
                head_office_address=cover["head_office_address"],
                phone=cover["phone"],
                representative=cover["representative"],
            )
            upsert_period_financial(
                conn,
                edinet_code=result.edinetCode,
                sec_code=sec_code,
                doc_id=result.docID,
                doc_type=doc_type,
                period_start=result.periodStart,
                period_end=str(period_end),
                submit_date_time=result.submitDateTime,
                filer_name=filer_name,
                summary=to_flat_dict(parsed.summary),
                pl=to_flat_dict(parsed.pl),
                bs=to_flat_dict(parsed.bs),
                cf=to_flat_dict(parsed.cf),
                raw_tsv_path=tsv_path.as_posix(),
            )
            if doc_type in ("annual", "semiannual") and sec_code:
                entries = major_shareholders_to_api_entries(
                    parse_major_shareholders_from_tsv(tsv_path)
                )
                if entries:
                    upsert_shareholder_snapshot(
                        conn,
                        sec_code=sec_code,
                        period_end=str(period_end),
                        doc_id=result.docID,
                        entries=entries,
                    )
            if doc_type == "annual" and sec_code:
                officer_entries = officers_to_api_entries(parse_officers_from_tsv(tsv_path))
                if officer_entries:
                    upsert_officer_snapshot(
                        conn,
                        sec_code=sec_code,
                        period_end=str(period_end),
                        doc_id=result.docID,
                        entries=officer_entries,
                    )
            stats.ingested += 1
            known_doc_ids.add(result.docID)
        except Exception:
            stats.errors += 1
            logger.exception("Failed to process doc_id={}", getattr(result, "docID", "unknown"))
            conn.rollback()

    conn.commit()
    return stats
