"""Back-fill EDINET submissions into local SQLite.

Useful for fork users seeding their own D1 from scratch.
"""

from __future__ import annotations

import argparse
from datetime import date, timedelta
from pathlib import Path

from edinet_wrapper.db import apply_schema, open_db
from edinet_wrapper.ingest import create_downloader, ingest_date, iterate_dates, parse_known_docs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, default=1)
    parser.add_argument("--output", type=Path, default=Path("data/edinet.db"))
    parser.add_argument("--from-date", default=None)
    parser.add_argument("--to-date", default=None)
    parser.add_argument("--known-docs", type=Path, default=None)
    parser.add_argument("--api-key", default=None, help="Falls back to EDINET_API_KEY env var")
    parser.add_argument("--raw-root", type=Path, default=Path("data/raw"))
    args = parser.parse_args()

    to_d = date.fromisoformat(args.to_date) if args.to_date else date.today()
    from_d = (
        date.fromisoformat(args.from_date)
        if args.from_date
        else to_d - timedelta(days=365 * args.years)
    )

    conn = open_db(args.output)
    apply_schema(conn)
    known = parse_known_docs(args.known_docs)
    downloader = create_downloader(api_key=args.api_key)

    total_fetched = 0
    total_ingested = 0
    total_skipped = 0
    total_errors = 0

    for day in iterate_dates(from_d, to_d):
        stats = ingest_date(
            conn,
            downloader,
            day,
            known_doc_ids=known,
            raw_root=args.raw_root,
        )
        total_fetched += stats.fetched
        total_ingested += stats.ingested
        total_skipped += stats.skipped
        total_errors += stats.errors
        if stats.fetched or stats.ingested:
            print(
                f"[backfill] {day.isoformat()} fetched={stats.fetched} "
                f"ingested={stats.ingested} skipped={stats.skipped} errors={stats.errors}"
            )

    conn.close()
    print(
        f"[backfill] {from_d} → {to_d} into {args.output} "
        f"fetched={total_fetched} ingested={total_ingested} "
        f"skipped={total_skipped} errors={total_errors}"
    )
    return 1 if total_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
