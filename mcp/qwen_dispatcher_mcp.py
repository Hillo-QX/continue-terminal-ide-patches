#!/usr/bin/env python3
"""Bounded Qwen3.8 dispatcher for the Qwen branch.

The dispatcher is advisory and read-only.  It uses the same Qwen model as the
main agent, but can only return a small, validated task/decision envelope; the
main Codex/Continue agent keeps tool, file-write, and final-decision authority.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import hashlib
from typing import Any

from mcp.server.fastmcp import FastMCP

BASE_URL = os.environ.get(
    "QWEN_DISPATCHER_BASE_URL",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
).rstrip("/")
MODEL = os.environ.get("QWEN_DISPATCHER_MODEL", "qwen3.8-27b")
API_KEY = os.environ.get("QWEN_DISPATCHER_API_KEY", os.environ.get("DASHSCOPE_API_KEY", ""))
TIMEOUT = float(os.environ.get("QWEN_DISPATCHER_TIMEOUT", "120"))
MAX_CONTEXT = 48_000
mcp = FastMCP("qwen-dispatcher")
_health_checked = False
_execution_granted = False


def _object(text: str) -> dict[str, Any]:
    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        value = json.loads(text[start:end + 1])
        if isinstance(value, dict):
            return value
    raise ValueError("Qwen dispatcher did not return a JSON object")


def _ask(system: str, instruction: str, max_tokens: int = 900) -> dict[str, Any]:
    if not API_KEY:
        raise RuntimeError("DASHSCOPE_API_KEY is not configured")
    body = {
        "model": MODEL,
        "temperature": 0,
        "max_tokens": max_tokens,
        "enable_thinking": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": instruction[:MAX_CONTEXT]},
        ],
    }
    request = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return _object(payload["choices"][0]["message"].get("content", ""))


def _bounded_list(value: Any, name: str, limit: int = 8) -> list[str]:
    if not isinstance(value, list) or len(value) > limit or not all(isinstance(x, str) for x in value):
        raise ValueError(f"{name} must be a list of at most {limit} strings")
    return [x[:500] for x in value]


def _validate_task(value: dict[str, Any], task_id: str) -> dict[str, Any]:
    status = value.get("status")
    if status not in {"TASK", "DONE", "BLOCKED"}:
        raise ValueError("invalid dispatcher task status")
    result = {
        "status": status,
        "task_id": str(value.get("task_id") or task_id or "qwen-task-1")[:120],
        "objective": str(value.get("objective", ""))[:1000],
        "allowed_actions": _bounded_list(value.get("allowed_actions", []), "allowed_actions"),
        "allowed_tool_names": _bounded_list(value.get("allowed_tool_names", []), "allowed_tool_names"),
        "stop_conditions": _bounded_list(value.get("stop_conditions", []), "stop_conditions"),
        "acceptance_criteria": _bounded_list(value.get("acceptance_criteria", []), "acceptance_criteria"),
        "reason": str(value.get("reason", ""))[:1000],
        "authority": "advisory_only",
        "backend": "qwen3.8-27b",
    }
    if status == "TASK" and not result["objective"]:
        raise ValueError("TASK requires objective")
    if status == "TASK" and not result["allowed_tool_names"]:
        raise ValueError("TASK requires allowed_tool_names")
    return result


@mcp.tool()
def dispatcher_health() -> dict[str, Any]:
    """Return dispatcher configuration without making a model request."""
    global _health_checked
    _health_checked = True
    return {"status": "READY", "model": MODEL, "base_url": BASE_URL,
            "backend": "qwen3.8-27b", "roles": ["Qwen Agent", "Qwen Dispatcher"],
            "authority": "advisory_only",
            "execution_gate": "CLOSED_UNTIL_DISPATCH"}


@mcp.tool()
def dispatch_next_task(overall_goal: str, completed_tasks: list[str] | None = None,
                       current_state: str = "", constraints: list[str] | None = None) -> dict[str, Any]:
    """Ask Qwen for one bounded next task; never executes it."""
    global _execution_granted
    if not _health_checked:
        return {"status": "BLOCKED", "reason": "dispatcher_health_required_first",
                "authority": "advisory_only", "execution_gate": "CLOSED"}
    if not overall_goal.strip():
        return {"status": "BLOCKED", "reason": "overall_goal_required", "authority": "advisory_only"}
    prompt = json.dumps({"overall_goal": overall_goal, "completed_tasks": completed_tasks or [],
                         "current_state": current_state[:8000], "constraints": constraints or []},
                        ensure_ascii=False)
    try:
        value = _ask(
            "You are Qwen3.8 27B acting only as a bounded dispatcher. Return JSON only. "
            "Propose exactly one small next task. Never claim to edit files, run tools, or "
            "make the final decision. Keep actions and acceptance criteria explicit. "
            "allowed_tool_names must contain exact Continue or MCP tool names needed for "
            "this task, such as Read, Bash, Search, or Fetch.",
            "Return keys status(TASK|DONE|BLOCKED), task_id, objective, allowed_actions, "
            "allowed_tool_names, "
            "stop_conditions, acceptance_criteria, reason. Input:\n" + prompt,
        )
        result = _validate_task(value, "qwen-task-1")
        if result["status"] == "TASK":
            _execution_granted = True
            grant_input = result["task_id"] + "\0" + result["objective"]
            result["execution_grant"] = hashlib.sha256(grant_input.encode()).hexdigest()[:16]
            result["execution_gate"] = "OPEN_FOR_THIS_TASK"
        else:
            result["execution_gate"] = "CLOSED"
        return result
    except (OSError, urllib.error.URLError, KeyError, ValueError, TimeoutError, RuntimeError) as exc:
        return {"status": "FALLBACK", "reason": type(exc).__name__,
                "message": "Qwen dispatcher unavailable; main agent retains execution path",
                "authority": "advisory_only", "backend": "qwen3.8-27b"}


@mcp.tool()
def request_decision(question: str, context: str = "", options: list[str] | None = None,
                     constraints: list[str] | None = None) -> dict[str, Any]:
    """Request an advisory Qwen decision without granting execution authority."""
    if not question.strip():
        return {"status": "BLOCKED", "reason": "question_required", "authority": "advisory_only"}
    prompt = json.dumps({"question": question, "context": context[:12000],
                         "options": options or [], "constraints": constraints or []}, ensure_ascii=False)
    try:
        value = _ask(
            "You are Qwen3.8 27B acting as a cautious decision reviewer. Return JSON only. "
            "Do not use tools, edit files, or pretend to have verified facts.",
            "Return keys status(DECISION|ESCALATE), verdict(APPROVE|REJECT|ESCALATE), "
            "recommendation, rationale, preconditions. Input:\n" + prompt,
            max_tokens=700,
        )
        verdict = value.get("verdict")
        if verdict not in {"APPROVE", "REJECT", "ESCALATE"}:
            raise ValueError("invalid decision verdict")
        return {"status": value.get("status", "DECISION"), "verdict": verdict,
                "recommendation": str(value.get("recommendation", ""))[:1200],
                "rationale": str(value.get("rationale", ""))[:1600],
                "preconditions": _bounded_list(value.get("preconditions", []), "preconditions"),
                "authority": "advisory_only", "backend": "qwen3.8-27b"}
    except (OSError, urllib.error.URLError, KeyError, ValueError, TimeoutError, RuntimeError) as exc:
        return {"status": "FALLBACK", "reason": type(exc).__name__,
                "message": "Qwen decision reviewer unavailable; main agent decides",
                "authority": "advisory_only", "backend": "qwen3.8-27b"}


if __name__ == "__main__":
    mcp.run(transport="stdio")
