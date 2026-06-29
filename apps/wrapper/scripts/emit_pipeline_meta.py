"""Emit pipeline_runs + daily_metrics SQL for D1 to apply.

Usage:
    uv run python scripts/emit_pipeline_meta.py \\
        --target-date 2026-05-15 \\
        --scope daily-refresh-staging \\
        --run-id 12345 \\
        --status success \\
        --started-at 2026-05-16T00:00:00 \\
        --finished-at 2026-05-16T00:30:00 \\
        --fetched 10 --ingested 8 --skipped 2 --errors 0 \\
        --company-count 4000 --document-count 50000 --period-financial-count 35000 \\
        --output /tmp/pipeline_meta.sql
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any


def _sql_literal(v: Any) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(int(v)) if isinstance(v, int) or v == int(v) else str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"


def build_pipeline_meta_sql(
    *,
    target_date: str,
    scope: str,
    run_id: str,
    status: str,
    started_at: str,
    finished_at: str | None,
    fetched: int,
    ingested: int,
    skipped: int,
    errors: int,
    notes: str | None,
    company_count: int | None,
    document_count: int | None,
    period_financial_count: int | None,
    include_daily_metrics: bool,
) -> list[str]:
    stmts: list[str] = []
    stmts.append(
        "INSERT OR REPLACE INTO pipeline_runs ("
        "run_id, scope, target_date, status, started_at, finished_at, "
        "fetched_documents, ingested_documents, skipped_documents, error_count, notes"
        f") VALUES ({
            ', '.join(
                _sql_literal(v)
                for v in (
                    run_id,
                    scope,
                    target_date,
                    status,
                    started_at,
                    finished_at,
                    fetched,
                    ingested,
                    skipped,
                    errors,
                    notes,
                )
            )
        });"
    )
    if include_daily_metrics:
        if company_count is None or document_count is None or period_financial_count is None:
            raise ValueError(
                "company_count, document_count, period_financial_count required "
                "when include_daily_metrics is true"
            )
        stmts.append(
            "INSERT OR REPLACE INTO daily_metrics ("
            "snapshot_date, company_count, document_count, period_financial_count"
            f") VALUES ({
                ', '.join(
                    _sql_literal(v)
                    for v in (
                        target_date,
                        company_count,
                        document_count,
                        period_financial_count,
                    )
                )
            });"
        )
    return stmts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-date", required=True, help="Submission date YYYY-MM-DD")
    parser.add_argument("--scope", required=True, help="e.g. daily-refresh-staging")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--status", required=True, choices=["success", "failed"])
    parser.add_argument("--started-at", required=True, help="ISO timestamp")
    parser.add_argument("--finished-at", default=None, help="ISO timestamp")
    parser.add_argument("--fetched", type=int, default=0)
    parser.add_argument("--ingested", type=int, default=0)
    parser.add_argument("--skipped", type=int, default=0)
    parser.add_argument("--errors", type=int, default=0)
    parser.add_argument("--notes", default=None)
    parser.add_argument("--company-count", type=int, default=None)
    parser.add_argument("--document-count", type=int, default=None)
    parser.add_argument("--period-financial-count", type=int, default=None)
    parser.add_argument(
        "--skip-daily-metrics",
        action="store_true",
        help="Omit daily_metrics row (e.g. on failed runs)",
    )
    parser.add_argument("--output", type=Path, default=Path("/tmp/pipeline_meta.sql"))
    args = parser.parse_args()

    stmts = build_pipeline_meta_sql(
        target_date=args.target_date,
        scope=args.scope,
        run_id=args.run_id,
        status=args.status,
        started_at=args.started_at,
        finished_at=args.finished_at,
        fetched=args.fetched,
        ingested=args.ingested,
        skipped=args.skipped,
        errors=args.errors,
        notes=args.notes,
        company_count=args.company_count,
        document_count=args.document_count,
        period_financial_count=args.period_financial_count,
        include_daily_metrics=not args.skip_daily_metrics,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(stmts) + "\n", encoding="utf-8")
    print(f"[pipeline_meta] wrote {len(stmts)} statements to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
