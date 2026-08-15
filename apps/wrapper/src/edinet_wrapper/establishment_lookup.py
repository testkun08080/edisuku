"""Lookup establishment dates from Wikidata, Wikipedia, then the open web."""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import quote, unquote

import requests

from edinet_wrapper.enrichment import (
    extract_wikipedia_establishment,
    parse_establishment_text,
    parse_wikidata_time,
)

USER_AGENT = (
    "edisuku-establishment-enrichment/0.1 "
    "(https://github.com/testkun08080/edisuku; listed-company date fill)"
)
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIPEDIA_API = "https://ja.wikipedia.org/w/api.php"
DDG_HTML = "https://html.duckduckgo.com/html/"

WIKIBASE_DAY = 11
WIKIBASE_MONTH = 10


@dataclass
class WikidataHit:
    qid: str
    jcn: str = ""
    ticker: str = ""
    inception: str = ""
    precision: int | None = None
    wikipedia_title: str = ""
    official_website: str = ""


@dataclass
class DateHit:
    value: str
    precision: str
    source_url: str
    source_qid: str = ""
    query: str = ""
    notes: str = ""


def _session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
    return session


def _qid_from_uri(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def _title_from_article(url: str) -> str:
    if not url:
        return ""
    path = url.rsplit("/", 1)[-1]
    return unquote(path).replace("_", " ")


def _bindings(payload: dict) -> list[dict]:
    return payload.get("results", {}).get("bindings", [])


def _literal(binding: dict, key: str) -> str:
    node = binding.get(key) or {}
    return str(node.get("value") or "")


def sparql_query(session: requests.Session, query: str, timeout: int = 60) -> dict:
    response = session.get(
        WIKIDATA_SPARQL,
        params={"query": query, "format": "json"},
        headers={"Accept": "application/sparql-results+json", "User-Agent": USER_AGENT},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def _inception_block() -> str:
    return """
      OPTIONAL {
        ?item p:P571 ?st .
        ?st psv:P571 ?node .
        ?node wikibase:timeValue ?inception .
        ?node wikibase:timePrecision ?precision .
      }
      OPTIONAL {
        ?article schema:about ?item ;
                 schema:isPartOf <https://ja.wikipedia.org/> .
      }
      OPTIONAL { ?item wdt:P856 ?website . }
    """


def _parse_wikidata_bindings(bindings: list[dict], key: str) -> dict[str, WikidataHit]:
    hits: dict[str, WikidataHit] = {}
    for binding in bindings:
        ident = _literal(binding, key)
        if not ident:
            continue
        qid = _qid_from_uri(_literal(binding, "item"))
        precision_raw = _literal(binding, "precision")
        precision = int(float(precision_raw)) if precision_raw else None
        hit = WikidataHit(
            qid=qid,
            jcn=_literal(binding, "jcn") or (ident if key == "jcn" else ""),
            ticker=_literal(binding, "ticker") or (ident if key == "ticker" else ""),
            inception=_literal(binding, "inception"),
            precision=precision,
            wikipedia_title=_title_from_article(_literal(binding, "article")),
            official_website=_literal(binding, "website"),
        )
        previous = hits.get(ident)
        if previous is None or (hit.inception and not previous.inception):
            hits[ident] = hit
    return hits


def query_wikidata_by_jcn(
    session: requests.Session,
    jcns: list[str],
    *,
    delay_sec: float = 0.4,
) -> dict[str, WikidataHit]:
    hits: dict[str, WikidataHit] = {}
    chunk_size = 80
    for offset in range(0, len(jcns), chunk_size):
        chunk = [jcn for jcn in jcns[offset : offset + chunk_size] if jcn]
        if not chunk:
            continue
        values = " ".join(f'"{jcn}"' for jcn in chunk)
        query = f"""
        SELECT ?jcn ?item ?inception ?precision ?article ?website WHERE {{
          VALUES ?jcn {{ {values} }}
          ?item wdt:P3225 ?jcn .
          {_inception_block()}
        }}
        """
        payload = sparql_query(session, query)
        hits.update(_parse_wikidata_bindings(_bindings(payload), "jcn"))
        if offset + chunk_size < len(jcns) and delay_sec:
            time.sleep(delay_sec)
    return hits


def query_wikidata_by_ticker(
    session: requests.Session,
    tickers: list[str],
    *,
    delay_sec: float = 0.4,
) -> dict[str, WikidataHit]:
    hits: dict[str, WikidataHit] = {}
    chunk_size = 80
    for offset in range(0, len(tickers), chunk_size):
        chunk = [ticker for ticker in tickers[offset : offset + chunk_size] if ticker]
        if not chunk:
            continue
        values = " ".join(f'"{ticker}"' for ticker in chunk)
        query = f"""
        SELECT ?ticker ?item ?inception ?precision ?article ?website WHERE {{
          VALUES ?ticker {{ {values} }}
          ?item wdt:P249 ?ticker .
          ?item wdt:P17 wd:Q17 .
          {_inception_block()}
        }}
        """
        payload = sparql_query(session, query)
        hits.update(_parse_wikidata_bindings(_bindings(payload), "ticker"))
        if offset + chunk_size < len(tickers) and delay_sec:
            time.sleep(delay_sec)
    return hits


def date_hit_from_wikidata(hit: WikidataHit) -> DateHit | None:
    if not hit.inception:
        return None
    parsed = parse_wikidata_time(hit.inception, hit.precision)
    if parsed is None:
        return None
    value, precision = parsed
    return DateHit(
        value=value,
        precision=precision,
        source_url=f"https://www.wikidata.org/wiki/{hit.qid}",
        source_qid=hit.qid,
        notes="Wikidata P571",
    )


def fetch_wikipedia_pages(
    session: requests.Session,
    titles: list[str],
    *,
    delay_sec: float = 0.2,
) -> dict[str, str]:
    pages: dict[str, str] = {}
    chunk_size = 40
    unique = list(dict.fromkeys(title for title in titles if title))
    for offset in range(0, len(unique), chunk_size):
        chunk = unique[offset : offset + chunk_size]
        response = session.get(
            WIKIPEDIA_API,
            params={
                "action": "query",
                "prop": "revisions",
                "rvprop": "content",
                "rvslots": "main",
                "format": "json",
                "formatversion": "2",
                "redirects": "1",
                "titles": "|".join(chunk),
            },
            headers={"User-Agent": USER_AGENT},
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        redirects = {
            item.get("from"): item.get("to")
            for item in payload.get("query", {}).get("redirects", [])
        }
        normalized = {
            item.get("from"): item.get("to")
            for item in payload.get("query", {}).get("normalized", [])
        }
        by_title: dict[str, str] = {}
        for page in payload.get("query", {}).get("pages", []):
            title = page.get("title") or ""
            revisions = page.get("revisions") or []
            if not revisions:
                continue
            slots = revisions[0].get("slots") or {}
            wikitext = (slots.get("main") or {}).get("content") or ""
            if title and wikitext:
                by_title[title] = wikitext
        for requested in chunk:
            resolved = redirects.get(
                normalized.get(requested, requested), normalized.get(requested, requested)
            )
            text = by_title.get(resolved) or by_title.get(requested)
            if text:
                pages[requested] = text
        if offset + chunk_size < len(unique) and delay_sec:
            time.sleep(delay_sec)
    return pages


def wikipedia_search_title(session: requests.Session, name: str) -> str | None:
    response = session.get(
        WIKIPEDIA_API,
        params={
            "action": "query",
            "list": "search",
            "srsearch": name,
            "srlimit": 5,
            "format": "json",
            "formatversion": "2",
        },
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()
    hits = response.json().get("query", {}).get("search", [])
    if not hits:
        return None
    stripped = re.sub(r"(株式会社|有限会社|合同会社)", "", name)
    for hit in hits:
        title = hit.get("title") or ""
        if stripped and stripped in title:
            return title
    return hits[0].get("title")


def date_hit_from_wikipedia(title: str, wikitext: str) -> DateHit | None:
    parsed = extract_wikipedia_establishment(wikitext)
    if parsed is None:
        return None
    value, precision = parsed
    return DateHit(
        value=value,
        precision=precision,
        source_url=f"https://ja.wikipedia.org/wiki/{quote(title)}",
        query=title,
        notes="Wikipedia infobox 設立",
    )


_HREF = re.compile(r'href="(https?://[^"]+)"', re.IGNORECASE)
_SNIPPET_DATE = re.compile(
    r"設立.{0,24}?(?:(令和|平成|昭和|大正|明治)\s*\d+|\d{4})\s*年(?:\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?)?"
)


def parse_duckduckgo_html(html: str) -> tuple[str, str]:
    """Return (snippet_with_date, first_http_url) from DDG HTML."""
    snippet_match = _SNIPPET_DATE.search(html)
    snippet = snippet_match.group(0) if snippet_match else ""
    url = ""
    for href in _HREF.findall(html):
        if "duckduckgo.com" in href or "wikipedia.org" in href:
            continue
        url = href
        break
    if not url:
        wiki = next((href for href in _HREF.findall(html) if "wikipedia.org" in href), "")
        url = wiki
    return snippet, url


def duckduckgo_search(
    session: requests.Session,
    query: str,
    *,
    timeout: int = 30,
) -> tuple[str, str]:
    response = session.post(
        DDG_HTML,
        data={"q": query, "kl": "jp-jp"},
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return parse_duckduckgo_html(response.text)


def fetch_text(session: requests.Session, url: str, *, timeout: int = 20) -> str:
    response = session.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        timeout=timeout,
        allow_redirects=True,
    )
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "")
    if "html" not in content_type.lower() and not response.text.lstrip().startswith("<"):
        return ""
    return response.text[:80_000]


def date_hit_from_web_text(text: str, url: str, query: str) -> DateHit | None:
    snippet_match = _SNIPPET_DATE.search(text)
    target = snippet_match.group(0) if snippet_match else text[:4000]
    parsed = parse_establishment_text(target)
    if parsed is None:
        parsed = parse_establishment_text(text)
    if parsed is None:
        return None
    value, precision = parsed
    return DateHit(
        value=value,
        precision=precision,
        source_url=url,
        query=query,
        notes="web page / search snippet 設立",
    )


def lookup_web_establishment(
    session: requests.Session,
    filer_name: str,
    *,
    company_url: str = "",
    sleep: Callable[[float], None] = time.sleep,
) -> DateHit | None:
    if company_url:
        try:
            html = fetch_text(session, company_url)
        except requests.RequestException:
            html = ""
        hit = date_hit_from_web_text(html, company_url, f"{filer_name} site") if html else None
        if hit:
            return hit
        sleep(0.3)
    query = f"{filer_name} 設立"
    try:
        snippet, url = duckduckgo_search(session, query)
    except requests.RequestException:
        return None
    if snippet:
        parsed = parse_establishment_text(snippet)
        if parsed and url:
            value, precision = parsed
            return DateHit(
                value=value,
                precision=precision,
                source_url=url,
                query=query,
                notes="DuckDuckGo snippet 設立",
            )
        if parsed:
            value, precision = parsed
            return DateHit(
                value=value,
                precision=precision,
                source_url="",
                query=query,
                notes="DuckDuckGo snippet 設立 (no url)",
            )
    if url:
        try:
            html = fetch_text(session, url)
        except requests.RequestException:
            return None
        return date_hit_from_web_text(html, url, query)
    return None
