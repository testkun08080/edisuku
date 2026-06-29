"""Tests for emit_pipeline_meta.py."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from emit_pipeline_meta import build_pipeline_meta_sql


def test_build_pipeline_meta_sql_success():
    stmts = build_pipeline_meta_sql(
        target_date="2026-05-15",
        scope="daily-refresh-staging",
        run_id="12345",
        status="success",
        started_at="2026-05-16T00:00:00",
        finished_at="2026-05-16T00:30:00",
        fetched=10,
        ingested=8,
        skipped=2,
        errors=0,
        notes=None,
        company_count=100,
        document_count=200,
        period_financial_count=150,
        include_daily_metrics=True,
    )
    assert len(stmts) == 2
    assert "INSERT OR REPLACE INTO pipeline_runs" in stmts[0]
    assert "'12345'" in stmts[0]
    assert "'daily-refresh-staging'" in stmts[0]
    assert "INSERT OR REPLACE INTO daily_metrics" in stmts[1]
    assert "'2026-05-15'" in stmts[1]
    assert "100" in stmts[1]


def test_build_pipeline_meta_sql_failed_skips_daily_metrics():
    stmts = build_pipeline_meta_sql(
        target_date="2026-05-15",
        scope="daily-refresh",
        run_id="99",
        status="failed",
        started_at="2026-05-16T00:00:00",
        finished_at="2026-05-16T00:05:00",
        fetched=0,
        ingested=0,
        skipped=0,
        errors=1,
        notes="ingest failed",
        company_count=None,
        document_count=None,
        period_financial_count=None,
        include_daily_metrics=False,
    )
    assert len(stmts) == 1
    assert "'failed'" in stmts[0]
    assert "daily_metrics" not in stmts[0]
