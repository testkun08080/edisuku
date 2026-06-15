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

from edinet_wrapper.db import upsert_company, upsert_document, upsert_period_financial
from edinet_wrapper.downloader import Downloader
from edinet_wrapper.parser import parse_tsv
from edinet_wrapper.schema import Result

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


def _company_meta(downloader: Downloader, edinet_code: str) -> tuple[str | None, str | None]:
    row = downloader.edinet_code_info.filter(pl.col("ＥＤＩＮＥＴコード") == edinet_code)
    if row.height == 0:
        return None, None
    return row["上場区分"][0], row["提出者業種"][0]


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
            listed_category, industry = _company_meta(downloader, result.edinetCode)
            upsert_company(
                conn,
                edinet_code=result.edinetCode,
                sec_code=sec_code,
                filer_name=result.filerName or "",
                listed_category=listed_category,
                industry=industry,
            )
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

            filer_name = result.filerName or str(parsed.meta.get("提出者名") or "")
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
            stats.ingested += 1
            known_doc_ids.add(result.docID)
        except Exception:
            stats.errors += 1
            logger.exception("Failed to process doc_id={}", getattr(result, "docID", "unknown"))
            conn.rollback()

    conn.commit()
    return stats
