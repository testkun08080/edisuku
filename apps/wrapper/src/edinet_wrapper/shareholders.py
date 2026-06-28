"""Parse major shareholders (大株主の状況) from EDINET TSV files."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import polars as pl

_CTX_RANK = re.compile(r"No(\d+)MajorShareholdersMember$")

_ELEM_NAME = "jpcrp_cor:NameMajorShareholders"
_ELEM_ADDRESS = "jpcrp_cor:AddressMajorShareholders"
_ELEM_SHARES = "jpcrp_cor:NumberOfSharesHeld"
_ELEM_RATIO = "jpcrp_cor:ShareholdingRatio"
_ITEM_SHARES = "所有株式数"
_ITEM_RATIO = "発行済株式（自己株式を除く。）の総数に対する所有株式数の割合"


@dataclass
class MajorShareholderEntry:
    rank: int
    name: str
    address: str
    shares: str | None
    ratio: str | None


def _rank_from_context(context_id: str) -> int | None:
    match = _CTX_RANK.search(context_id)
    if not match:
        return None
    return int(match.group(1))


def parse_major_shareholders_from_raw(raw: dict[str, Any]) -> list[MajorShareholderEntry]:
    """Parse from ``{"rows": [[elem_id, item_name, context_id, ..., value], ...]}``."""
    rows = raw.get("rows") or []
    acc: dict[int, dict[str, str | None]] = {}

    for row in rows:
        if len(row) < 9:
            continue
        elem_id = row[0]
        item_name = row[1] or ""
        context_id = row[2] or ""
        value = row[8] or ""

        rank = _rank_from_context(context_id)
        if rank is None:
            continue

        entry = acc.setdefault(
            rank, {"rank": rank, "name": None, "address": None, "shares": None, "ratio": None}
        )

        if elem_id == _ELEM_NAME:
            entry["name"] = value
        elif elem_id == _ELEM_ADDRESS:
            entry["address"] = value
        elif (
            elem_id == _ELEM_SHARES
            and item_name == _ITEM_SHARES
            and "MajorShareholders" in context_id
        ):
            entry["shares"] = value
        elif (
            elem_id == _ELEM_RATIO
            and item_name == _ITEM_RATIO
            and "MajorShareholders" in context_id
        ):
            entry["ratio"] = value

    out: list[MajorShareholderEntry] = []
    for rank in sorted(acc):
        entry = acc[rank]
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        shares = entry.get("shares")
        ratio = entry.get("ratio")
        out.append(
            MajorShareholderEntry(
                rank=rank,
                name=name,
                address=(entry.get("address") or "").strip(),
                shares=shares.strip() if shares and shares.strip() not in ("", "－") else None,
                ratio=ratio.strip() if ratio and ratio.strip() not in ("", "－") else None,
            )
        )
    return out


def parse_major_shareholders_from_tsv(tsv_path: str | Path) -> list[MajorShareholderEntry]:
    path = Path(tsv_path)
    if not path.exists():
        return []

    try:
        df = pl.read_csv(str(path), separator="\t", encoding="utf-16", infer_schema_length=0)
    except Exception:
        return []
    rows: list[list[str]] = []
    for record in df.iter_rows(named=True):
        rows.append(
            [
                str(record.get("要素ID") or ""),
                str(record.get("項目名") or ""),
                str(record.get("コンテキストID") or ""),
                "",
                "",
                "",
                "",
                "",
                str(record.get("値") or ""),
            ]
        )
    return parse_major_shareholders_from_raw({"rows": rows})


def major_shareholders_to_api_entries(entries: list[MajorShareholderEntry]) -> list[dict[str, Any]]:
    """Convert to ShareholderEntry JSON stored in shareholder_snapshots.entries_json."""
    api: list[dict[str, Any]] = []
    for entry in entries:
        shares = 0
        if entry.shares:
            try:
                shares = int(entry.shares.replace(",", ""))
            except ValueError:
                shares = 0

        ratio: float | None = None
        if entry.ratio:
            try:
                r = float(entry.ratio.replace(",", ""))
                if r == r:  # finite
                    ratio = r if r <= 1 else r / 100
            except ValueError:
                ratio = None

        api.append({"name": entry.name, "shares": shares, "ratio": ratio})
    return api
