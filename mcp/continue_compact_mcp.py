#!/usr/bin/env python3
"""Continue compact bridge backed by a Qwen OpenAI-compatible endpoint.

This server never edits Continue session JSON.  ``compact_soft`` returns a
bounded structured capsule; ``compact_hard`` persists that capsule and emits
the exact prompt needed to start a new chat.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get("QWEN38_COMPACT_BASE_URL", "http://127.0.0.1:8000/v1").rstrip("/")
MODEL = os.environ.get("QWEN38_COMPACT_MODEL", "qwen3.8-27b")
API_KEY = os.environ.get("QWEN38_COMPACT_API_KEY", "qwen3.8-local")
TIMEOUT = float(os.environ.get("QWEN38_COMPACT_TIMEOUT", "90"))
MAX_INPUT_CHARS = 120_000
MAX_OUTPUT_TOKENS = 1200
CAPSULE_DIR = Path(os.environ.get(
    "CONTINUE_COMPACT_DIR", str(ROOT / ".continue" / "compacted")
))

mcp = FastMCP("continue-compact-qwen38")


def _estimate(text: str) -> dict[str, Any]:
    chars = len(text or "")
    return {"chars": chars, "estimated_tokens": (chars + 3) // 4,
            "thresholds": {"soft": 65_536, "hard": 104_857}}


def _json_object(text: str) -> dict[str, Any] | None:
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else None
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                value = json.loads(text[start:end + 1])
                return value if isinstance(value, dict) else None
            except json.JSONDecodeError:
                return None
    return None


def _call_qwen(task: str, transcript: str) -> dict[str, Any]:
    body = {
        "model": MODEL,
        "temperature": 0,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "messages": [
            {"role": "system", "content": (
                "Create a compact continuation capsule. Return JSON only with "
                "keys task, constraints, decisions, changed_files, tests, "
                "open_issues, next_action, source_refs. Preserve uncertainty; "
                "do not invent facts or execute tools."
            )},
            {"role": "user", "content": f"CURRENT_TASK:\n{task}\n\nTRANSCRIPT:\n{transcript[:MAX_INPUT_CHARS]}"},
        ],
    }
    request = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))
    content = payload["choices"][0]["message"].get("content", "")
    capsule = _json_object(content)
    if capsule is None:
        raise ValueError("Qwen compact response was not valid JSON")
    capsule["task"] = capsule.get("task") or task
    capsule["source_refs"] = capsule.get("source_refs") or []
    return capsule


@mcp.tool()
def estimate_context(transcript: str, current_task: str = "") -> dict[str, Any]:
    """Estimate context pressure without calling a model."""
    return {"status": "OK", "current_task": current_task, **_estimate(transcript)}


@mcp.tool()
def compact_soft(transcript: str, current_task: str, task_id: str = "",
                 workspace: str = "") -> dict[str, Any]:
    """Create a capsule for continuing the same chat; does not persist history."""
    if not current_task.strip():
        return {"status": "FALLBACK", "reason": "current_task_required"}
    try:
        capsule = _call_qwen(current_task, transcript)
        return {"status": "OK", "mode": "soft", "task_id": task_id,
                "workspace": workspace, "capsule": capsule, **_estimate(transcript)}
    except (OSError, urllib.error.URLError, KeyError, ValueError, TimeoutError) as exc:
        return {"status": "FALLBACK", "mode": "soft", "reason": type(exc).__name__,
                "message": "Qwen3.8 27B local compact service unavailable; start a new chat manually"}


@mcp.tool()
def compact_hard(capsule: dict[str, Any], current_task: str, task_id: str = "",
                 workspace: str = "") -> dict[str, Any]:
    """Persist a bounded capsule and return a new-chat handoff prompt."""
    if not current_task.strip():
        return {"status": "FALLBACK", "reason": "current_task_required"}
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    record = {"version": 1, "created_at": now, "ttl_hours": 6,
              "task_id": task_id, "workspace": workspace,
              "current_task": current_task, "capsule": capsule}
    CAPSULE_DIR.mkdir(parents=True, exist_ok=True)
    path = CAPSULE_DIR / f"capsule-{task_id or 'untagged'}-{now}.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    prompt = ("继续当前任务。只使用下面的 capsule 和当前任务，不恢复旧聊天全文。\n\n"
              + json.dumps({"current_task": current_task, "capsule": capsule},
                           ensure_ascii=False))
    return {"status": "OK", "mode": "hard", "capsule_path": str(path),
            "new_chat_prompt": prompt}


if __name__ == "__main__":
    mcp.run(transport="stdio")
