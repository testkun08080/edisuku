"""Parse officers (役員の状況) from EDINET TSV files."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import polars as pl

RoleGroup = Literal["directors", "executive"]

_DIRECTORS = {
    "name": "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditors",
    "title": "jpcrp_cor:OfficialTitleOrPositionInformationAboutDirectorsAndCorporateAuditors",
    "birthDate": "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditors",
    "roleGroup": "directors",
}

_EXECUTIVE = {
    "name": "jpcrp_cor:NameInformationAboutExecutiveDirectors",
    "title": "jpcrp_cor:OfficialTitleOrPositionInformationAboutExecutiveDirectors",
    "birthDate": "jpcrp_cor:DateOfBirthInformationAboutExecutiveDirectors",
    "roleGroup": "executive",
}

_GROUPS = (_DIRECTORS, _EXECUTIVE)


@dataclass
class OfficerEntry:
    name: str
    title: str | None
    birth_date: str | None
    role_group: RoleGroup


def _match_group(elem_id: str) -> dict[str, str] | None:
    if not elem_id or "Proposal" in elem_id:
        return None
    for group in _GROUPS:
        if elem_id in (group["name"], group["title"], group["birthDate"]):
            return group
    return None


def _field_for(elem_id: str, group: dict[str, str]) -> str | None:
    if elem_id == group["name"]:
        return "name"
    if elem_id == group["title"]:
        return "title"
    if elem_id == group["birthDate"]:
        return "birthDate"
    return None


def parse_officers_from_raw(raw: dict[str, Any]) -> list[OfficerEntry]:
    """Parse from ``{"rows": [[elem_id, item_name, context_id, ..., value], ...]}``."""
    rows = raw.get("rows") or []
    acc: dict[str, dict[str, str | None]] = {}

    for row in rows:
        if len(row) < 9:
            continue
        elem_id = row[0] or ""
        context_id = row[2] or ""
        value = row[8] or ""
        if "Member" not in context_id:
            continue

        group = _match_group(elem_id)
        if group is None:
            continue
        field = _field_for(elem_id, group)
        if field is None:
            continue

        key = f"{group['roleGroup']}:{context_id}"
        entry = acc.setdefault(
            key,
            {
                "name": None,
                "title": None,
                "birthDate": None,
                "roleGroup": group["roleGroup"],
            },
        )
        entry[field] = value

    out: list[OfficerEntry] = []
    for entry in acc.values():
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        title = (entry.get("title") or "").strip()
        birth = (entry.get("birthDate") or "").strip()
        role = entry.get("roleGroup") or "directors"
        out.append(
            OfficerEntry(
                name=name,
                title=title if title and title != "－" else None,
                birth_date=birth if birth and birth != "－" else None,
                role_group=role if role in ("directors", "executive") else "directors",
            )
        )
    return out


def parse_officers_from_tsv(tsv_path: str | Path) -> list[OfficerEntry]:
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
    return parse_officers_from_raw({"rows": rows})


def officers_to_api_entries(entries: list[OfficerEntry]) -> list[dict[str, Any]]:
    """Convert to OfficerEntry JSON stored in officer_snapshots.entries_json."""
    return [
        {
            "name": e.name,
            "title": e.title,
            "birthDate": e.birth_date,
            "roleGroup": e.role_group,
        }
        for e in entries
    ]
