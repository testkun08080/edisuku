"""Cover-page META → company profile field extraction."""

from __future__ import annotations

from edinet_wrapper.ingest import cover_profile_from_meta


def test_cover_profile_from_meta_nec_shape():
    meta = {
        "代表者の役職氏名": "取締役代表執行役社長兼CEO      森　田　　隆　之",
        "本店の所在の場所": "東京都港区芝五丁目7番1号",
        "電話番号": "(03)3454-1111(大代表)",
    }
    profile = cover_profile_from_meta(meta)
    assert profile["representative"] == "取締役代表執行役社長兼CEO      森　田　　隆　之"
    assert profile["head_office_address"] == "東京都港区芝五丁目7番1号"
    assert profile["phone"] == "(03)3454-1111(大代表)"


def test_cover_profile_keeps_annotation_address():
    meta = {
        "本店の所在の場所": (
            "静岡県浜松市中央区市野町1126番地の１（注）上記は登記上の本店所在地であり、"
            "実際の本社業務は「最寄りの連絡場所」において行っております。"
        ),
        "電話番号": "053(434)3311（代表）",
        "代表者の役職氏名": "代表取締役社長　社長執行役員　　丸野　正",
    }
    profile = cover_profile_from_meta(meta)
    assert "（注）" in (profile["head_office_address"] or "")
    assert profile["phone"] == "053(434)3311（代表）"


def test_cover_profile_empty_meta():
    assert cover_profile_from_meta({}) == {
        "representative": None,
        "head_office_address": None,
        "phone": None,
    }
