import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { defaultBoxStyles } from "./styles.js";

const MAX_RECENT_WORKSPACES = 10;
const WORKSPACE_FILE = path.join(os.homedir(), ".continue", "workspaces.json");

export type WorkspaceAction = "resume" | "new";

interface WorkspaceSelectorProps {
  onSelect: (workspacePath: string, action: WorkspaceAction) => void;
  onCancel: () => void;
}

function readRecentWorkspaces(): string[] {
  try {
    const data = JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf8"));
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is string =>
        typeof item === "string" && fs.existsSync(item) && fs.statSync(item).isDirectory(),
    );
  } catch {
    return [];
  }
}

function saveRecentWorkspace(workspacePath: string): void {
  try {
    fs.mkdirSync(path.dirname(WORKSPACE_FILE), { recursive: true });
    const recent = [workspacePath, ...readRecentWorkspaces().filter((item) => item !== workspacePath)];
    fs.writeFileSync(
      WORKSPACE_FILE,
      JSON.stringify(recent.slice(0, MAX_RECENT_WORKSPACES), null, 2) + "\n",
      "utf8",
    );
  } catch {
    // Workspace selection must still work if the preference file is read-only.
  }
}

function displayName(workspacePath: string): string {
  const home = os.homedir();
  if (workspacePath === path.join(home, "Downloads")) return "下载";
  if (workspacePath === path.join(home, "Desktop")) return "桌面";
  return path.basename(workspacePath) || workspacePath;
}

type Mode = "list" | "path" | "action";

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  onSelect,
  onCancel,
}) => {
  const currentPath = process.cwd();
  const [mode, setMode] = useState<Mode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [typedPath, setTypedPath] = useState("");
  const [selectedPath, setSelectedPath] = useState(currentPath);

  const workspaces = useMemo(() => {
    const candidates = [
      currentPath,
      path.join(os.homedir(), "Desktop"),
      path.join(os.homedir(), "Downloads"),
      ...readRecentWorkspaces(),
    ];
    return [...new Set(candidates)].filter((item) => {
      try {
        return fs.statSync(item).isDirectory();
      } catch {
        return false;
      }
    });
  }, [currentPath]);

  const actionOptions = [
    { label: "继续当前聊天", action: "resume" as const },
    { label: "开启新聊天", action: "new" as const },
  ];

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      if (mode === "path") {
        setMode("list");
        setTypedPath("");
      } else if (mode === "action") {
        setMode("list");
      } else {
        onCancel();
      }
      return;
    }

    if (mode === "path") {
      if (key.return) {
        const expanded = typedPath.trim().replace(/^~/, os.homedir());
        try {
          if (fs.statSync(expanded).isDirectory()) {
            setSelectedPath(path.resolve(expanded));
            setMode("action");
          }
        } catch {
          // Invalid paths remain in the input so the user can correct them.
        }
        return;
      }
      if (key.backspace || key.delete) {
        setTypedPath((value) => value.slice(0, -1));
        return;
      }
      if (!key.ctrl && !key.meta && input) {
        setTypedPath((value) => value + input);
      }
      return;
    }

    if (mode === "action") {
      if (key.upArrow || key.downArrow) {
        setSelectedIndex((value) => (value === 0 ? 1 : 0));
        return;
      }
      if (key.return) {
        const action = actionOptions[selectedIndex]?.action ?? "new";
        saveRecentWorkspace(selectedPath);
        onSelect(selectedPath, action);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((value) => (value === 0 ? workspaces.length : value - 1));
    } else if (key.downArrow) {
      setSelectedIndex((value) => (value >= workspaces.length ? 0 : value + 1));
    } else if (key.return) {
      if (selectedIndex === workspaces.length) {
        setTypedPath("");
        setMode("path");
      } else if (workspaces[selectedIndex]) {
        setSelectedPath(workspaces[selectedIndex]);
        setSelectedIndex(0);
        setMode("action");
      }
    }
  });

  if (mode === "path") {
    return (
      <Box {...defaultBoxStyles("blue")} flexDirection="column">
        <Text color="blue" bold>输入工作环境路径</Text>
        <Text color="gray">支持拖入文件夹路径，按回车确认</Text>
        <Text color="cyan">{typedPath || "▋"}</Text>
      </Box>
    );
  }

  if (mode === "action") {
    return (
      <Box {...defaultBoxStyles("blue")} flexDirection="column">
        <Text color="blue" bold>工作环境：{displayName(selectedPath)}</Text>
        <Text color="gray">路径：{selectedPath}</Text>
        <Text> </Text>
        {actionOptions.map((option, index) => (
          <Text key={option.action} color={index === selectedIndex ? "cyan" : "white"} bold={index === selectedIndex}>
            {index === selectedIndex ? "➤ " : "  "}{option.label}
          </Text>
        ))}
        <Text color="gray">↑/↓ 选择，回车确认，Esc 返回</Text>
      </Box>
    );
  }

  return (
    <Box {...defaultBoxStyles("blue")} flexDirection="column">
      <Text color="blue" bold>选择工作环境</Text>
      <Text color="gray">当前：{displayName(currentPath)}</Text>
      <Text> </Text>
      {workspaces.map((workspacePath, index) => (
        <Text key={workspacePath} color={index === selectedIndex ? "cyan" : "white"} bold={index === selectedIndex}>
          {index === selectedIndex ? "➤ " : "  "}{displayName(workspacePath)}
          <Text color="gray">（{workspacePath}）</Text>
        </Text>
      ))}
      <Text color={selectedIndex === workspaces.length ? "cyan" : "white"} bold={selectedIndex === workspaces.length}>
        {selectedIndex === workspaces.length ? "➤ " : "  "}输入其他路径
      </Text>
      <Text color="gray">↑/↓ 导航，回车选择，Esc 取消</Text>
    </Box>
  );
};
