import { createHash } from "node:crypto";

const CONTROL_TOOLS = new Set([
  "dispatcher_health",
  "dispatch_next_task",
  "request_decision",
]);

const TASK_TTL_MS = 10 * 60 * 1000;

type DispatcherTask = {
  taskId: string;
  objective: string;
  allowedToolNames: Set<string>;
  expiresAt: number;
};

let activeTask: DispatcherTask | null = null;

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function findObject(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findObject(item);
      if (found) return found;
    }
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const object = parsed as Record<string, unknown>;
  if (typeof object.status === "string") return object;
  if (object.content) return findObject(object.content);
  if (typeof object.text === "string") return findObject(object.text);
  return null;
}

function normaliseToolNames(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function verifyGrant(taskId: string, objective: string, grant: unknown): boolean {
  if (typeof grant !== "string" || !/^[a-f0-9]{16}$/i.test(grant)) return false;
  const expected = createHash("sha256")
    .update(`${taskId}\0${objective}`)
    .digest("hex")
    .slice(0, 16);
  return expected === grant.toLowerCase();
}

export function isDispatcherControlTool(toolName: string): boolean {
  return CONTROL_TOOLS.has(toolName);
}

/**
 * Every non-control tool must have a live Dispatcher task ticket. This check
 * is deliberately deterministic and runs immediately before the tool starts.
 */
export function assertToolAuthorised(toolName: string): void {
  if (isDispatcherControlTool(toolName)) return;

  if (!activeTask) {
    throw new Error(
      `DISPATCHER_REQUIRED: tool "${toolName}" is blocked until ` +
        "dispatcher_health and dispatch_next_task return an active task",
    );
  }

  if (Date.now() >= activeTask.expiresAt) {
    activeTask = null;
    throw new Error(
      `DISPATCHER_TASK_EXPIRED: tool "${toolName}" requires a new dispatched task`,
    );
  }

  if (!activeTask.allowedToolNames.has(toolName.toLowerCase())) {
    throw new Error(
      `DISPATCHER_TOOL_NOT_ALLOWED: task "${activeTask.taskId}" does not ` +
        `authorize tool "${toolName}"`,
    );
  }
}

/** Update the gate only from the result of a Dispatcher control tool. */
export function observeDispatcherResult(toolName: string, result: string): void {
  if (toolName === "dispatcher_health") {
    // A fresh health check starts a new control sequence and invalidates any
    // ticket left by a previous chat/session.
    activeTask = null;
    return;
  }
  if (toolName !== "dispatch_next_task") return;

  const payload = findObject(result);
  if (!payload || payload.status !== "TASK") {
    activeTask = null;
    return;
  }

  const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
  const objective = typeof payload.objective === "string" ? payload.objective : "";
  const allowedToolNames = normaliseToolNames(payload.allowed_tool_names);
  const grantValid = verifyGrant(taskId, objective, payload.execution_grant);

  if (
    payload.execution_gate !== "OPEN_FOR_THIS_TASK" ||
    !taskId ||
    !objective ||
    !grantValid ||
    allowedToolNames.size === 0
  ) {
    activeTask = null;
    return;
  }

  activeTask = {
    taskId,
    objective,
    allowedToolNames,
    expiresAt: Date.now() + TASK_TTL_MS,
  };
}

export function clearDispatcherTask(): void {
  activeTask = null;
}
