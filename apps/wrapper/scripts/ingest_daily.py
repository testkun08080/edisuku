"""Daily EDINET ingestion.

Local SQLite is treated as ephemeral; it only stages what will be
UPSERTed into D1 by publish_to_d1.py.

Usage:
    uv run python scripts/ingest_daily.py \
        --date 2026-05-25 \
        --output data/edinet.db \
        --known-docs /tmp/known_docs.json   # optional, skips re-download
"""

from __future__ import annotations

import argparse
from pathlib import Path

from edinet_wrapper.db import apply_schema, open_db
from edinet_wrapper.ingest import (
    create_downloader,
    ingest_date,
    parse_known_docs,
    resolve_target_date,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--date",
        default="",
        help="Submission date (YYYY-MM-DD). Default: yesterday JST",
    )
    parser.add_argument("--output", type=Path, default=Path("data/edinet.db"))
    parser.add_argument("--known-docs", type=Path, default=None)
    parser.add_argument("--api-key", default=None, help="Falls back to EDINET_API_KEY env var")
    parser.add_argument("--raw-root", type=Path, default=Path("data/raw"))
    args = parser.parse_args()

    target = resolve_target_date(args.date)
    known = parse_known_docs(args.known_docs)

    conn = open_db(args.output)
    apply_schema(conn)

    downloader = create_downloader(api_key=args.api_key)
    stats = ingest_date(
        conn,
        downloader,
        target,
        known_doc_ids=known,
        raw_root=args.raw_root,
    )

    conn.close()
    print(
        f"[ingest] {target.isoformat()} fetched={stats.fetched} "
        f"ingested={stats.ingested} skipped={stats.skipped} errors={stats.errors} "
        f"(known_docs={len(known)})"
    )
    return 1 if stats.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
