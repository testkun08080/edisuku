"""Wikipedia infobox and DuckDuckGo HTML extractors used by establishment fill."""

from edinet_wrapper.establishment_lookup import date_hit_from_web_text, parse_duckduckgo_html


def test_web_text_prefers_setsuritsu_clause():
    html = "<p>沿革</p><p>当社は設立1949年5月15日、東京都に本店を置きました。</p>"
    hit = date_hit_from_web_text(html, "https://example.co.jp/about", "株式会社例 設立")
    assert hit is not None
    assert hit.value == "1949-05-15"
    assert hit.source_url == "https://example.co.jp/about"


def test_duckduckgo_skips_ddg_and_prefers_company_url():
    html = """
    <a rel="nofollow" href="https://duckduckgo.com/y.js?x=1">ad</a>
    <a href="https://ja.wikipedia.org/wiki/X">wiki</a>
    <a href="https://www.example.co.jp/ir/">IR</a>
    設立平成3年4月1日
    """
    snippet, url = parse_duckduckgo_html(html)
    assert "平成3年4月1日" in snippet
    assert url == "https://www.example.co.jp/ir/"
