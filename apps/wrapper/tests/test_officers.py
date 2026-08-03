"""Tests for officer TSV parsing (shaped like wagatoushi annual data)."""

from __future__ import annotations

from edinet_wrapper.officers import officers_to_api_entries, parse_officers_from_raw

TSV_FIXTURE_ROWS = [
    [
        "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditors",
        "氏名、役員の状況（取締役（及び監査役））",
        "FilingDateInstant_jpcrp030000-asr_E04908-000IshizukaHaruhisaMember",
        "",
        "",
        "",
        "",
        "",
        "石塚　晴久",
    ],
    [
        "jpcrp_cor:OfficialTitleOrPositionInformationAboutDirectorsAndCorporateAuditors",
        "役職名、役員の状況（取締役（及び監査役））",
        "FilingDateInstant_jpcrp030000-asr_E04908-000IshizukaHaruhisaMember",
        "",
        "",
        "",
        "",
        "",
        "代表取締役会長",
    ],
    [
        "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditors",
        "生年月日、役員の状況（取締役（及び監査役））",
        "FilingDateInstant_jpcrp030000-asr_E04908-000IshizukaHaruhisaMember",
        "",
        "",
        "",
        "",
        "",
        "1947-10-21",
    ],
    [
        "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditorsProposal",
        "氏名",
        "FilingDateInstant_jpcrp030000-asr_E04908-000ProposalPersonMember",
        "",
        "",
        "",
        "",
        "",
        "提案用太郎",
    ],
    [
        "jpcrp_cor:NameInformationAboutExecutiveDirectors",
        "氏名、役員の状況（執行役）",
        "FilingDateInstant_jpcrp030000-asr_E01573-000EjiriHirohikoMember",
        "",
        "",
        "",
        "",
        "",
        "江尻　裕彦",
    ],
    [
        "jpcrp_cor:OfficialTitleOrPositionInformationAboutExecutiveDirectors",
        "役職名、役員の状況（執行役）",
        "FilingDateInstant_jpcrp030000-asr_E01573-000EjiriHirohikoMember",
        "",
        "",
        "",
        "",
        "",
        "代表執行役社長",
    ],
    [
        "jpcrp_cor:DateOfBirthInformationAboutExecutiveDirectors",
        "生年月日、役員の状況（執行役）",
        "FilingDateInstant_jpcrp030000-asr_E01573-000EjiriHirohikoMember",
        "",
        "",
        "",
        "",
        "",
        "1962-10-06",
    ],
]


def test_parse_officers_from_raw():
    entries = parse_officers_from_raw({"rows": TSV_FIXTURE_ROWS})
    assert len(entries) == 2
    assert entries[0].name == "石塚　晴久"
    assert entries[0].title == "代表取締役会長"
    assert entries[0].birth_date == "1947-10-21"
    assert entries[0].role_group == "directors"
    assert entries[1].name == "江尻　裕彦"
    assert entries[1].role_group == "executive"
    assert all("提案" not in e.name for e in entries)


def test_officers_to_api_entries():
    api = officers_to_api_entries(parse_officers_from_raw({"rows": TSV_FIXTURE_ROWS}))
    assert api[0] == {
        "name": "石塚　晴久",
        "title": "代表取締役会長",
        "birthDate": "1947-10-21",
        "roleGroup": "directors",
    }
