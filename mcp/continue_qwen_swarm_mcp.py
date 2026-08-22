#!/usr/bin/env python3
"""Bounded serial Qwen swarm for Continue.

The swarm is intentionally advisory: Planner/Implementer/Verifier return
structured proposals, while the Continue main agent retains file-write and
final-decision authority.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

from mcp.server.fastmcp import FastMCP

BASE_URL = os.environ.get("QWEN_SWARM_BASE_URL", "http://127.0.0.1:8000/v1").rstrip("/")
MODEL = os.environ.get("QWEN_SWARM_MODEL", "qwen3.8-27b")
API_KEY = os.environ.get("QWEN_SWARM_API_KEY", os.environ.get("DASHSCOPE_API_KEY", "local-qwen"))
TIMEOUT = float(os.environ.get("QWEN_SWARM_TIMEOUT", "120"))
MAX_CONTEXT = 60_000
mcp = FastMCP("qwen-swarm")


def _object(text: str) -> dict[str, Any]:
    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        try:
            value = json.loads(text[start:end + 1])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            pass
    raise ValueError("Qwen swarm stage did not return a JSON object")


def _ask(role: str, instruction: str) -> dict[str, Any]:
    body = {
        "model": MODEL,
        "temperature": 0,
        "max_tokens": 1400,
        "messages": [
            {"role": "system", "content": (
                f"You are the {role} in a bounded serial coding swarm. "
                "Return JSON only. Do not claim to have edited files, run tests, "
                "or used tools. Keep the response concise and evidence-based."
            )},
            {"role": "user", "content": instruction[:MAX_CONTEXT]},
        ],
    }
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return _object(payload["choices"][0]["message"].get("content", ""))


@mcp.tool()
def swarm_health() -> dict[str, Any]:
    """Return configured swarm endpoint metadata without calling the model."""
    return {"status": "READY", "model": MODEL, "base_url": BASE_URL,
            "roles": ["Planner", "Implementer", "Verifier"], "parallel": False}


@mcp.tool()
def swarm_run(task: str, task_id: str = "", workspace: str = "",
              allowed_paths: list[str] | None = None,
              acceptance_criteria: list[str] | None = None,
              context: str = "") -> dict[str, Any]:
    """Run Planner -> Implementer -> Verifier serially and return advisory output."""
    if not task.strip():
        return {"status": "BLOCKED", "reason": "task_required"}
    envelope = json.dumps({
        "task_id": task_id, "workspace": workspace, "task": task,
        "allowed_paths": allowed_paths or [],
        "acceptance_criteria": acceptance_criteria or [],
        "context": context[:MAX_CONTEXT],
    }, ensure_ascii=False)
    try:
        plan = _ask("Planner", (
            "Break this task into at most 3 deterministic steps. Do not write files. "
            "JSON keys: status, steps, risks, required_inputs.\n" + envelope
        ))
        proposal = _ask("Implementer", (
            "Using the task and Planner output below, propose the smallest safe change. "
            "Do not edit files. JSON keys: status, changes, commands, files_to_review, "
            "do_not_do.\nTASK:\n" + envelope + "\nPLANNER:\n" + json.dumps(plan, ensure_ascii=False)
        ))
        verification = _ask("Verifier", (
            "Review the proposed change against the task. Do not run tests. JSON keys: "
            "status, acceptance_checks, risks, verdict, next_action.\nTASK:\n" + envelope
            + "\nPLAN:\n" + json.dumps(plan, ensure_ascii=False)
            + "\nPROPOSAL:\n" + json.dumps(proposal, ensure_ascii=False)
        ))
        return {"status": "OK", "mode": "serial_advisory",
                "task_id": task_id, "plan": plan,
                "implementation_proposal": proposal, "verification": verification,
                "authority": "Continue main agent"}
    except (OSError, urllib.error.URLError, KeyError, ValueError, TimeoutError) as exc:
        return {"status": "FALLBACK", "mode": "serial_advisory",
                "reason": type(exc).__name__,
                "message": "Qwen swarm unavailable; main agent retains execution path"}


if __name__ == "__main__":
    mcp.run(transport="stdio")
