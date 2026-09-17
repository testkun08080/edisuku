"""Fill listed-company establishment dates with provenance.

gBiz dates (optional CSV) are seeded as source=gbiz and never overwritten.
Gaps are filled Wikidata → Wikipedia → Web search.

Usage (from apps/wrapper):

    uv run python scripts/enrich_establishment_dates.py
    uv run python scripts/enrich_establishment_dates.py --gbiz-csv path/to/gbiz-listed.csv
    uv run python scripts/enrich_establishment_dates.py --skip-web --limit 50
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from edinet_wrapper.downloader import download_edinetinfo_csv
from edinet_wrapper.enrichment import (
    FIELD_ESTABLISHMENT,
    SOURCE_WEB_SEARCH,
    SOURCE_WIKIDATA,
    SOURCE_WIKIPEDIA,
    EnrichmentRow,
    ListedCompany,
    companies_needing_establishment,
    load_enrichment_csv,
    load_gbiz_csv,
    load_listed_from_edinet_csv,
    now_iso,
    seed_gbiz_establishment,
    upsert_search_row,
    write_enrichment_csv,
)
from edinet_wrapper.establishment_lookup import (
    WikidataHit,
    _session,
    date_hit_from_wikidata,
    date_hit_from_wikipedia,
    fetch_wikipedia_pages,
    lookup_web_establishment,
    query_wikidata_by_jcn,
    query_wikidata_by_label,
    query_wikidata_by_ticker,
    wikipedia_search_title,
)

DEFAULT_EDINET_CSV = Path("data/EdinetcodeDlInfo.csv")
DEFAULT_OUTPUT = Path("data/company-enrichment.csv")


def _ensure_edinet_csv(path: Path) -> Path:
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    download_edinetinfo_csv(str(path.parent))
    if not path.exists():
        raise FileNotFoundError(f"EDINET code list not found at {path}")
    return path


def _row_from_hit(company: ListedCompany, hit, source: str) -> EnrichmentRow:
    return EnrichmentRow(
        edinet_code=company.edinet_code,
        sec_code=company.sec_code,
        filer_name=company.filer_name,
        field=FIELD_ESTABLISHMENT,
        value=hit.value,
        precision=hit.precision,
        source=source,
        source_url=hit.source_url,
        source_qid=hit.source_qid,
        query=hit.query,
        retrieved_at=now_iso(),
        notes=hit.notes,
    )


def collect_wikidata_hits(companies: list[ListedCompany]) -> dict[str, WikidataHit]:
    session = _session()
    jcns = [company.corporate_number for company in companies if company.corporate_number]
    by_jcn = query_wikidata_by_jcn(session, jcns)
    by_edinet: dict[str, WikidataHit] = {}
    missing_ticker: list[ListedCompany] = []
    for company in companies:
        hit = by_jcn.get(company.corporate_number)
        if hit:
            by_edinet[company.edinet_code] = hit
        elif company.sec_code:
            missing_ticker.append(company)
    tickers = [company.sec_code for company in missing_ticker]
    by_ticker = query_wikidata_by_ticker(session, tickers) if tickers else {}
    for company in missing_ticker:
        hit = by_ticker.get(company.sec_code)
        if hit:
            by_edinet[company.edinet_code] = hit
    unlabeled = [company for company in companies if company.edinet_code not in by_edinet]
    names: list[str] = []
    for company in unlabeled:
        names.append(company.filer_name)
        stripped = company.filer_name.replace("株式会社", "").replace("　", "").strip()
        if stripped and stripped != company.filer_name:
            names.append(stripped)
    by_label = query_wikidata_by_label(session, names) if unlabeled else {}
    for company in unlabeled:
        stripped = company.filer_name.replace("株式会社", "").replace("　", "").strip()
        hit = by_label.get(company.filer_name) or by_label.get(stripped)
        if hit:
            by_edinet[company.edinet_code] = hit
    return by_edinet


def apply_wikidata_sites(companies: list[ListedCompany], hits: dict[str, WikidataHit]) -> None:
    for company in companies:
        hit = hits.get(company.edinet_code)
        if hit and hit.official_website and not company.company_url:
            company.company_url = hit.official_website


def fill_from_wikidata(
    companies: list[ListedCompany],
    rows: list[EnrichmentRow],
    hits: dict[str, WikidataHit],
) -> int:
    added = 0
    for company in companies_needing_establishment(companies, rows):
        hit = hits.get(company.edinet_code)
        date_hit = date_hit_from_wikidata(hit) if hit else None
        if date_hit and upsert_search_row(rows, _row_from_hit(company, date_hit, SOURCE_WIKIDATA)):
            added += 1
    print(
        "[enrich] wikidata added="
        f"{added} remaining={len(companies_needing_establishment(companies, rows))}"
    )
    return added


def fill_wikipedia(
    companies: list[ListedCompany],
    rows: list[EnrichmentRow],
    hits: dict[str, WikidataHit],
    *,
    sitelinks_only: bool = False,
) -> int:
    pending = companies_needing_establishment(companies, rows)
    if not pending:
        return 0
    session = _session()
    titles: dict[str, str] = {}
    for company in pending:
        hit = hits.get(company.edinet_code)
        if hit and hit.wikipedia_title:
            titles[company.edinet_code] = hit.wikipedia_title
    if not sitelinks_only:
        for company in pending:
            if company.edinet_code in titles:
                continue
            try:
                title = wikipedia_search_title(session, company.filer_name)
            except Exception as exc:
                print(
                    f"[enrich] wikipedia search fail {company.edinet_code}: {exc}", file=sys.stderr
                )
                continue
            if title:
                titles[company.edinet_code] = title
            time.sleep(0.8)
    pages = fetch_wikipedia_pages(session, list(dict.fromkeys(titles.values())))
    added = 0
    for company in pending:
        title = titles.get(company.edinet_code)
        if not title:
            continue
        wikitext = pages.get(title)
        if not wikitext:
            continue
        date_hit = date_hit_from_wikipedia(title, wikitext)
        if date_hit and upsert_search_row(rows, _row_from_hit(company, date_hit, SOURCE_WIKIPEDIA)):
            added += 1
    print(
        "[enrich] wikipedia added="
        f"{added} remaining={len(companies_needing_establishment(companies, rows))}"
    )
    return added


def fill_web(
    companies: list[ListedCompany],
    rows: list[EnrichmentRow],
    output: Path,
    *,
    delay_sec: float,
    official_only: bool = False,
) -> int:
    pending = companies_needing_establishment(companies, rows)
    if not pending:
        return 0
    session = _session()
    added = 0
    for index, company in enumerate(pending, start=1):
        try:
            date_hit = lookup_web_establishment(
                session,
                company.filer_name,
                company_url=company.company_url,
                official_only=official_only,
            )
        except Exception as exc:
            print(f"[enrich] web fail {company.edinet_code}: {exc}", file=sys.stderr)
            date_hit = None
        if date_hit and upsert_search_row(
            rows, _row_from_hit(company, date_hit, SOURCE_WEB_SEARCH)
        ):
            added += 1
        if index % 25 == 0:
            write_enrichment_csv(output, rows)
            print(f"[enrich] web progress {index}/{len(pending)} added={added}")
        if delay_sec:
            time.sleep(delay_sec)
    print(
        "[enrich] web added="
        f"{added} remaining={len(companies_needing_establishment(companies, rows))}"
    )
    return added


def apply_gbiz_urls(companies: list[ListedCompany], gbiz_rows: list[dict[str, str]]) -> None:
    by_edinet = {company.edinet_code: company for company in companies}
    for raw in gbiz_rows:
        company = by_edinet.get((raw.get("edinet_code") or "").strip())
        if company is None:
            continue
        url = (raw.get("company_url") or "").strip()
        if url and not company.company_url:
            company.company_url = url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fill listed-company establishment dates")
    parser.add_argument("--edinet-csv", type=Path, default=DEFAULT_EDINET_CSV)
    parser.add_argument(
        "--gbiz-csv", type=Path, default=None, help="Optional gBiz snapshot to seed"
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=0, help="Cap listed companies (debug)")
    parser.add_argument("--skip-wikidata", action="store_true")
    parser.add_argument("--skip-wikipedia", action="store_true")
    parser.add_argument("--skip-web", action="store_true")
    parser.add_argument(
        "--wikipedia-sitelinks-only",
        action="store_true",
        help="Do not Wikipedia-search by company name; only use Wikidata ja sitelinks",
    )
    parser.add_argument("--web-delay-sec", type=float, default=1.5)
    parser.add_argument(
        "--web-official-only",
        action="store_true",
        help="Fetch Wikidata/gBiz official websites only; skip DuckDuckGo",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    edinet_csv = _ensure_edinet_csv(args.edinet_csv)
    companies = load_listed_from_edinet_csv(edinet_csv)
    if args.limit:
        companies = companies[: args.limit]
    rows = load_enrichment_csv(args.output)
    print(f"[enrich] listed={len(companies)} existing_rows={len(rows)}")

    if args.gbiz_csv:
        gbiz_rows = load_gbiz_csv(args.gbiz_csv)
        apply_gbiz_urls(companies, gbiz_rows)
        seeded = seed_gbiz_establishment(companies, gbiz_rows)
        added_gbiz = 0
        for row in seeded:
            if upsert_search_row(rows, row):
                added_gbiz += 1
        print(f"[enrich] gbiz seeded={added_gbiz}")
        write_enrichment_csv(args.output, rows)

    wikidata_hits: dict[str, WikidataHit] = {}
    if not args.skip_wikidata or not args.skip_wikipedia:
        wikidata_hits = collect_wikidata_hits(companies)
        apply_wikidata_sites(companies, wikidata_hits)
        print(f"[enrich] wikidata entities={len(wikidata_hits)}")
    if not args.skip_wikidata:
        fill_from_wikidata(companies, rows, wikidata_hits)
        write_enrichment_csv(args.output, rows)
    if not args.skip_wikipedia:
        fill_wikipedia(
            companies,
            rows,
            wikidata_hits,
            sitelinks_only=args.wikipedia_sitelinks_only,
        )
        write_enrichment_csv(args.output, rows)
    if not args.skip_web:
        fill_web(
            companies,
            rows,
            args.output,
            delay_sec=args.web_delay_sec,
            official_only=args.web_official_only,
        )
        write_enrichment_csv(args.output, rows)

    remaining = companies_needing_establishment(companies, rows)
    filled = len(companies) - len(remaining)
    write_enrichment_csv(args.output, rows)
    print(
        f"[enrich] done output={args.output} filled={filled}/{len(companies)} "
        f"remaining={len(remaining)} rows={len(rows)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
