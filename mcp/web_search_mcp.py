#!/usr/bin/env python3
"""Small, dependency-light web search MCP server for Continue.

It deliberately exposes a real MCP tool named ``web_search``.  This is
separate from Continue's built-in ``Search`` (repository search) and
``Fetch`` (known-URL retrieval).  No API key is required; the server queries
DuckDuckGo's HTML endpoint and returns a bounded result list.
"""
from __future__ import annotations

import html
import json
import os
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any

from mcp.server.fastmcp import FastMCP

MAX_RESULTS = 10
TIMEOUT = float(os.environ.get("WEB_SEARCH_TIMEOUT", "15"))
SEARCH_URL = "https://html.duckduckgo.com/html/?q="
mcp = FastMCP("continue-web-search")


class _ResultParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.results: list[dict[str, str]] = []
        self._current: dict[str, str] | None = None
        self._field: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())
        if tag == "a" and "result__a" in classes and len(self.results) < MAX_RESULTS:
            href = html.unescape(attributes.get("href") or "")
            parsed = urllib.parse.urlparse(href)
            query = urllib.parse.parse_qs(parsed.query).get("uddg", [None])[0]
            self._current = {"url": query or href, "title": "", "snippet": ""}
            self._field = "title"
        elif self.results and "result__snippet" in classes:
            self._current = self.results[-1]
            self._field = "snippet"

    def handle_data(self, data: str) -> None:
        if self._current and self._field:
            self._current[self._field] += data

    def handle_endtag(self, tag: str) -> None:
        if self._field == "snippet" and tag in {"div", "a"}:
            self._field = None
            self._current = None
            return
        if tag == "a" and self._current and self._field == "title":
            self._current["title"] = re.sub(r"\s+", " ", self._current["title"]).strip()
            self.results.append(self._current)
            self._current = None
            self._field = None


@mcp.tool()
def web_search(query: str, max_results: int = 5) -> dict[str, Any]:
    """Search the public web and return title, URL, and short snippets."""
    query = query.strip()
    if not query:
        return {"status": "BLOCKED", "reason": "query_required", "results": []}

    limit = max(1, min(int(max_results), MAX_RESULTS))
    request = urllib.request.Request(
        SEARCH_URL + urllib.parse.quote_plus(query),
        headers={"User-Agent": "Continue-Web-Search/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            body = response.read().decode("utf-8", errors="replace")
        parser = _ResultParser()
        parser.feed(body)
        results = [
            {
                "title": item["title"][:300],
                "url": item["url"][:2000],
                "snippet": re.sub(r"\s+", " ", item["snippet"]).strip()[:800],
            }
            for item in parser.results[:limit]
            if item["url"]
        ]
        return {"status": "OK", "query": query, "results": results}
    except Exception as exc:  # MCP stays available and reports a bounded failure.
        return {
            "status": "FALLBACK",
            "query": query,
            "results": [],
            "reason": type(exc).__name__,
            "message": "Web search is temporarily unavailable; try again later.",
        }


if __name__ == "__main__":
    mcp.run(transport="stdio")
