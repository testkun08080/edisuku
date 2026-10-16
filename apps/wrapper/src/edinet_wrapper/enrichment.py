"""Provenance-aware company enrichment rows (establishment date first).

gBiz values win. Search fills only empty (edinet_code, field) pairs.
Working output lives under data/; fixtures/ holds committed snapshots.
"""

from __future__ import annotations

import csv
import re
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from edinet_wrapper.ingest import normalize_sec_code

FIELD_ESTABLISHMENT = "date_of_establishment"
FIELD_LISTING = "listing_date"

SOURCE_GBIZ = "gbiz"
SOURCE_WIKIDATA = "wikidata"
SOURCE_WIKIPEDIA = "wikipedia"
SOURCE_WEB_SEARCH = "web_search"
SEARCH_SOURCES = frozenset({SOURCE_WIKIDATA, SOURCE_WIKIPEDIA, SOURCE_WEB_SEARCH})
ALL_SOURCES = frozenset({SOURCE_GBIZ, *SEARCH_SOURCES})

PRECISION_DATE = "date"
PRECISION_MONTH = "month"
PRECISION_YEAR = "year"

ENRICHMENT_COLUMNS = (
    "edinet_code",
    "sec_code",
    "filer_name",
    "field",
    "value",
    "precision",
    "source",
    "source_url",
    "source_qid",
    "query",
    "retrieved_at",
    "notes",
    "error",
)

_FULLWIDTH = str.maketrans("０１２３４５６７８９", "0123456789")
_ERA_YEAR1 = {
    "令和": 2019,
    "平成": 1989,
    "昭和": 1926,
    "大正": 1912,
    "明治": 1868,
}

_ISO_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$")
_ISO_MONTH = re.compile(r"^(\d{4})-(\d{2})$")
_ISO_YEAR = re.compile(r"^(\d{4})$")
_JP_YMD = re.compile(
    r"(?:(?P<era>令和|平成|昭和|大正|明治)\s*(?P<era_year>\d+)|(?P<year>\d{4}))\s*年"
    r"(?:\s*(?P<month>\d{1,2})\s*月(?:\s*(?P<day>\d{1,2})\s*日)?)?"
)
_TMPL_YMD = re.compile(
    r"\{\{\s*(?:開始年月日|Start date(?: and age)?)\s*\|"
    r"\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})",
    re.IGNORECASE,
)
_TMPL_YM = re.compile(
    r"\{\{\s*(?:開始年月日|Start date(?: and age)?)\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*"
    r"(?:\||\})",
    re.IGNORECASE,
)
_TMPL_Y = re.compile(
    r"\{\{\s*(?:開始年月日|Start date(?: and age)?)\s*\|\s*(\d{4})\s*(?:\||\})",
    re.IGNORECASE,
)


@dataclass
class ListedCompany:
    edinet_code: str
    sec_code: str
    filer_name: str
    corporate_number: str
    filer_name_en: str = ""
    company_url: str = ""


@dataclass
class EnrichmentRow:
    edinet_code: str
    sec_code: str
    filer_name: str
    field: str
    value: str
    precision: str
    source: str
    source_url: str = ""
    source_qid: str = ""
    query: str = ""
    retrieved_at: str = ""
    notes: str = ""
    error: str = ""

    def as_csv_dict(self) -> dict[str, str]:
        payload = asdict(self)
        return {key: payload.get(key) or "" for key in ENRICHMENT_COLUMNS}


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _era_to_gregorian(era: str, era_year: int) -> int | None:
    start = _ERA_YEAR1.get(era)
    if start is None or era_year < 1:
        return None
    return start + era_year - 1


def _valid_ymd(year: int, month: int | None, day: int | None) -> tuple[str, str] | None:
    if year < 1600 or year > 2100:
        return None
    if month is None:
        return str(year), PRECISION_YEAR
    if month < 1 or month > 12:
        return None
    if day is None:
        return f"{year:04d}-{month:02d}", PRECISION_MONTH
    if day < 1 or day > 31:
        return None
    return f"{year:04d}-{month:02d}-{day:02d}", PRECISION_DATE


def parse_establishment_text(text: str) -> tuple[str, str] | None:
    """Parse a Japanese or ISO establishment date. Returns (value, precision)."""
    if not text:
        return None
    raw = text.translate(_FULLWIDTH).replace("元年", "1年").strip()
    raw = re.sub(r"\[\[([^|\]]*\|)?([^\]]+)\]\]", r"\2", raw)
    raw = raw.replace("&nbsp;", " ")

    iso = _ISO_DATE.match(raw[:32].strip())
    if iso:
        return _valid_ymd(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
    iso_m = _ISO_MONTH.match(raw[:7].strip())
    if iso_m:
        return _valid_ymd(int(iso_m.group(1)), int(iso_m.group(2)), None)
    iso_y = _ISO_YEAR.match(raw[:4].strip())
    if iso_y and len(raw.strip()) == 4:
        return _valid_ymd(int(iso_y.group(1)), None, None)

    tmpl = _TMPL_YMD.search(raw)
    if tmpl:
        return _valid_ymd(int(tmpl.group(1)), int(tmpl.group(2)), int(tmpl.group(3)))
    tmpl_m = _TMPL_YM.search(raw)
    if tmpl_m:
        return _valid_ymd(int(tmpl_m.group(1)), int(tmpl_m.group(2)), None)
    tmpl_y = _TMPL_Y.search(raw)
    if tmpl_y:
        return _valid_ymd(int(tmpl_y.group(1)), None, None)

    match = _JP_YMD.search(raw)
    if not match:
        return None
    if match.group("era"):
        year = _era_to_gregorian(match.group("era"), int(match.group("era_year")))
        if year is None:
            return None
    else:
        year = int(match.group("year"))
    month = int(match.group("month")) if match.group("month") else None
    day = int(match.group("day")) if match.group("day") else None
    return _valid_ymd(year, month, day)


_INFOBOX_EST = re.compile(
    r"\|\s*設立(?:年月日|年|日)?\s*=\s*(.+?)(?:\n|\r|$)",
    re.IGNORECASE,
)


def extract_wikipedia_establishment(wikitext: str) -> tuple[str, str] | None:
    if not wikitext:
        return None
    match = _INFOBOX_EST.search(wikitext)
    if not match:
        return parse_establishment_text(wikitext[:2000])
    return parse_establishment_text(match.group(1))


def wikidata_precision_label(precision: int | None) -> str:
    if precision == 11:
        return PRECISION_DATE
    if precision == 10:
        return PRECISION_MONTH
    return PRECISION_YEAR


def parse_wikidata_time(value: str, precision: int | None) -> tuple[str, str] | None:
    parsed = parse_establishment_text(value.replace("T00:00:00Z", "").replace("+", ""))
    if parsed is None:
        return None
    date_value, _inferred = parsed
    label = wikidata_precision_label(precision)
    if label == PRECISION_YEAR:
        return date_value[:4], PRECISION_YEAR
    if label == PRECISION_MONTH:
        return date_value[:7], PRECISION_MONTH
    return date_value[:10], PRECISION_DATE


def gbiz_blocks(existing: Iterable[EnrichmentRow], edinet_code: str, field: str) -> bool:
    return any(
        row.edinet_code == edinet_code
        and row.field == field
        and row.source == SOURCE_GBIZ
        and row.value
        for row in existing
    )


def has_value(existing: Iterable[EnrichmentRow], edinet_code: str, field: str) -> bool:
    return any(
        row.edinet_code == edinet_code and row.field == field and row.value for row in existing
    )


def row_from_csv(raw: dict[str, str]) -> EnrichmentRow:
    return EnrichmentRow(**{key: (raw.get(key) or "") for key in ENRICHMENT_COLUMNS})


def load_enrichment_csv(path: Path) -> list[EnrichmentRow]:
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as handle:
        return [row_from_csv(row) for row in csv.DictReader(handle)]


def write_enrichment_csv(path: Path, rows: Iterable[EnrichmentRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(rows, key=lambda row: (row.edinet_code, row.field, row.source))
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=ENRICHMENT_COLUMNS)
        writer.writeheader()
        for row in ordered:
            writer.writerow(row.as_csv_dict())


def upsert_search_row(rows: list[EnrichmentRow], incoming: EnrichmentRow) -> bool:
    """Append a search-sourced value unless gBiz (or any value) already exists.

    Returns True when the row was added.
    """
    if incoming.source not in ALL_SOURCES:
        raise ValueError(f"unknown source: {incoming.source}")
    if incoming.source == SOURCE_GBIZ:
        if gbiz_blocks(rows, incoming.edinet_code, incoming.field):
            return False
        rows.append(incoming)
        return True
    if gbiz_blocks(rows, incoming.edinet_code, incoming.field):
        return False
    if has_value(rows, incoming.edinet_code, incoming.field):
        return False
    rows.append(incoming)
    return True


def seed_gbiz_establishment(
    companies: list[ListedCompany], gbiz_rows: Iterable[dict[str, str]]
) -> list[EnrichmentRow]:
    by_edinet = {company.edinet_code: company for company in companies}
    by_jcn = {
        company.corporate_number: company for company in companies if company.corporate_number
    }
    seeded: list[EnrichmentRow] = []
    retrieved = now_iso()
    for raw in gbiz_rows:
        value = (raw.get("date_of_establishment") or "").strip()
        parsed = parse_establishment_text(value)
        if parsed is None:
            continue
        date_value, precision = parsed
        edinet = (raw.get("edinet_code") or "").strip()
        jcn = (raw.get("corporate_number") or "").strip()
        company = by_edinet.get(edinet) or by_jcn.get(jcn)
        if company is None:
            company = ListedCompany(
                edinet_code=edinet,
                sec_code=(raw.get("sec_code") or "").strip(),
                filer_name=(raw.get("filer_name") or raw.get("gbiz_name") or "").strip(),
                corporate_number=jcn,
                company_url=(raw.get("company_url") or "").strip(),
            )
        if not company.edinet_code:
            continue
        seeded.append(
            EnrichmentRow(
                edinet_code=company.edinet_code,
                sec_code=company.sec_code,
                filer_name=company.filer_name,
                field=FIELD_ESTABLISHMENT,
                value=date_value,
                precision=precision,
                source=SOURCE_GBIZ,
                source_url="https://info.gbiz.go.jp/",
                retrieved_at=retrieved,
                notes="gBizINFO date_of_establishment",
            )
        )
    return seeded


def load_listed_from_edinet_csv(path: Path) -> list[ListedCompany]:
    """Read EdinetcodeDlInfo.csv (skip download-date row)."""
    import polars as pl

    text = path.read_text(encoding="cp932", errors="replace")
    frame = pl.read_csv(text.encode("utf-8"), encoding="utf8", skip_rows=1)
    listed: list[ListedCompany] = []
    for row in frame.iter_rows(named=True):
        category = str(row.get("上場区分") or "").strip()
        if category != "上場":
            continue
        edinet = str(row.get("ＥＤＩＮＥＴコード") or "").strip()
        if not edinet:
            continue
        listed.append(
            ListedCompany(
                edinet_code=edinet,
                sec_code=normalize_sec_code(str(row.get("証券コード") or "")) or "",
                filer_name=str(row.get("提出者名") or "").strip(),
                corporate_number=str(row.get("提出者法人番号") or "").strip(),
                filer_name_en=str(row.get("提出者名（英字）") or "").strip(),
            )
        )
    return listed


def load_gbiz_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def companies_needing_establishment(
    companies: list[ListedCompany],
    rows: list[EnrichmentRow],
) -> list[ListedCompany]:
    filled = {row.edinet_code for row in rows if row.field == FIELD_ESTABLISHMENT and row.value}
    return [company for company in companies if company.edinet_code not in filled]
