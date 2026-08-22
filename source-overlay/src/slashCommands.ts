import fs from "fs";

import { type AssistantConfig } from "@continuedev/sdk";
import chalk from "chalk";
import type { Session } from "core/index.js";
import historyManager from "core/util/history.js";
import { v4 as uuidv4 } from "uuid";

import { getAllSlashCommands } from "./commands/commands.js";
import { handleInit } from "./commands/init.js";
import { handleInfoSlashCommand } from "./infoScreen.js";
import { getCurrentSession, updateSessionTitle } from "./session.js";
import { telemetryService } from "./telemetry/telemetryService.js";
import { buildImportSkillPrompt } from "./tools/skills.js";
import { SlashCommandResult } from "./ui/hooks/useChat.types.js";
import {
  getSkillSlashCommandName,
  loadMarkdownSkills,
} from "./util/loadMarkdownSkills.js";

type CommandHandler = (
  args: string[],
  assistant: AssistantConfig,
) => Promise<SlashCommandResult> | SlashCommandResult;

async function handleHelp(_args: string[], _assistant: AssistantConfig) {
  const helpMessage = [
    chalk.bold("键盘快捷键："),
    "",
    chalk.white("导航："),
    `  ${chalk.cyan("↑/↓")}        浏览命令、文件建议或历史记录`,
    `  ${chalk.cyan("Tab")}        补全命令或文件选择`,
    `  ${chalk.cyan("Enter")}      发送消息`,
    `  ${chalk.cyan("Shift+Enter")} 换行`,
    `  ${chalk.cyan("\\")}          行尾续行`,
    `  ${chalk.cyan("!")}          终端模式，执行 Shell 命令`,
    "",
    chalk.white("控制："),
    `  ${chalk.cyan("Ctrl+C")}     清空输入`,
    `  ${chalk.cyan("Ctrl+D")}     退出程序`,
    `  ${chalk.cyan("Ctrl+L")}     清屏`,
    `  ${chalk.cyan("Shift+Tab")}  切换权限模式（normal/plan/auto）`,
    `  ${chalk.cyan("Esc")}        取消生成或关闭建议`,
    "",
    chalk.white("特殊符号："),
    `  ${chalk.cyan("@")}          搜索并添加文件上下文`,
    `  ${chalk.cyan("/")}          打开斜杠命令`,
    `  ${chalk.cyan("!")}          直接执行 Bash 命令`,
    "",
    chalk.white("可用命令："),
    `  输入 ${chalk.cyan("/")} 查看可用斜杠命令`,
    `  输入 ${chalk.cyan("!")} 加命令可直接执行 Bash`,
  ].join("\n");
  return { output: helpMessage };
}

async function handleFork() {
  try {
    const currentSession = getCurrentSession();
    const forkCommand = `cn --fork ${currentSession.sessionId}`;
    // Try to copy to clipboard dynamically to avoid hard dependency in tests
    try {
      const clipboardy = await import("clipboardy");
      await clipboardy.default.write(forkCommand);
      return {
        exit: false,
        output: chalk.gray(`${forkCommand}（已复制到剪贴板）`),
      };
    } catch {
      return {
        exit: false,
        output: chalk.gray(`${forkCommand}`),
      };
    }
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`创建分支会话命令失败：${error.message}`),
    };
  }
}

function handleTitle(args: string[]) {
  const title = args.join(" ").trim();
  if (!title) {
    return {
      exit: false,
      output: chalk.yellow(
        "请输入标题。用法：/title <标题>",
      ),
    };
  }

  try {
    updateSessionTitle(title);
    return {
      exit: false,
      output: chalk.green(`会话标题已更新为：“${title}”`),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`更新标题失败：${error.message}`),
    };
  }
}

function handleJobs() {
  return { openJobsSelector: true };
}

async function handleSkills(): Promise<SlashCommandResult> {
  const { skills } = await loadMarkdownSkills();

  if (!skills.length) {
    return {
      exit: false,
      output: chalk.yellow(
        "没有找到技能。请将技能放入 .continue/skills 或 .claude/skills。",
      ),
    };
  }

  const header = chalk.bold("可用技能：");
  const lines = skills.map(
    (skill) =>
      `${chalk.cyan(skill.name)} - ${skill.description} ${chalk.gray(
        `(${skill.path})`,
      )}`,
  );

  return {
    exit: false,
    output: [header, "", ...lines].join("\n"),
  };
}

async function handleImportSkill(args: string[]): Promise<SlashCommandResult> {
  const query = args.join(" ").trim();

  if (!query) {
    return {
      exit: false,
      output: chalk.yellow(
        "请输入技能网址或名称。用法：/import-skill <网址或名称>",
      ),
    };
  }

  return {
    newInput: buildImportSkillPrompt(query),
  };
}

function handleSessions() {
  return { openSessionSelector: true };
}

const EXPORTED_SESSION_VERSION = 1;

interface ExportedSession {
  version: number;
  exportedAt: string;
  session: Session;
}

function isValidExportedSession(data: unknown): data is ExportedSession {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  return (
    obj.version === EXPORTED_SESSION_VERSION &&
    typeof obj.exportedAt === "string" &&
    typeof obj.session === "object" &&
    obj.session !== null &&
    typeof (obj.session as Record<string, unknown>).sessionId === "string" &&
    typeof (obj.session as Record<string, unknown>).title === "string" &&
    Array.isArray((obj.session as Record<string, unknown>).history)
  );
}

function handleExport(_args: string[]): SlashCommandResult {
  return {
    exit: false,
    openExportSelector: true,
  };
}

function handleImport(args: string[]): SlashCommandResult {
  const filePath = args.join(" ").trim();
  if (!filePath) {
    return {
      exit: false,
      output: chalk.yellow(
        "请输入文件路径。用法：/import <文件路径>",
      ),
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      exit: false,
      output: chalk.red(`找不到文件：${filePath}`),
    };
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const exportedData: unknown = JSON.parse(fileContent);

    if (!isValidExportedSession(exportedData)) {
      return {
        exit: false,
        output: chalk.red(
          "会话文件无效：需要 Continue 导出的有效会话文件（版本 1）。",
        ),
      };
    }

    let session = exportedData.session;

    const existing = historyManager.load(session.sessionId);
    const sessionExists = existing.history.length > 0;

    if (sessionExists) {
      const originalId = session.sessionId;
      session = {
        ...session,
        sessionId: uuidv4(),
      };
      historyManager.save(session);
      return {
        exit: false,
        output: chalk.green(
          `Session imported with new ID: ${session.sessionId}\n` +
            chalk.gray(`（原 ID：${originalId} 已存在）`),
        ),
      };
    }

    historyManager.save(session);
    return {
      exit: false,
      output: chalk.green(
        `会话已导入：${session.sessionId}（${session.title}）`,
      ),
    };
  } catch (error: any) {
    return {
      exit: false,
      output: chalk.red(`导入会话失败：${error.message}`),
    };
  }
}

const commandHandlers: Record<string, CommandHandler> = {
  help: handleHelp,
  clear: () => {
    return { clear: true, output: "聊天记录已清空" };
  },
  exit: () => {
    return { exit: true, output: "再见！" };
  },
  config: () => {
    return { openConfigSelector: true };
  },
  info: handleInfoSlashCommand,
  model: () => ({ openModelSelector: true }),
  compact: () => {
    return { compact: true };
  },
  mcp: () => {
    return { openMcpSelector: true };
  },
  resume: () => {
    return { openSessionSelector: true };
  },
  fork: handleFork,
  title: handleTitle,
  rename: handleTitle,
  init: (args, assistant) => {
    return handleInit(args, assistant);
  },
  update: () => {
    return { openUpdateSelector: true };
  },
  jobs: handleJobs,
  skills: () => handleSkills(),
  "import-skill": (args) => handleImportSkill(args),
  sessions: handleSessions,
  chat: handleSessions,
  workspace: () => ({ openWorkspaceSelector: true }),
  "聊天": handleSessions,
  "工作环境": () => ({ openWorkspaceSelector: true }),
  export: handleExport,
  import: handleImport,
};

export async function handleSlashCommands(
  input: string,
  assistant: AssistantConfig,
): Promise<SlashCommandResult | null> {
  // Only trigger slash commands if slash is the very first character
  if (!input.startsWith("/") || !input.trim().startsWith("/")) {
    return null;
  }

  const [command, ...args] = input.slice(1).split(" ");

  telemetryService.recordSlashCommand(command);

  const handler = commandHandlers[command];
  if (handler) {
    return await handler(args, assistant);
  }

  // Check for custom assistant prompts
  const assistantPrompt = assistant.prompts?.find(
    (prompt) => prompt?.name === command,
  );
  if (assistantPrompt) {
    const newInput = assistantPrompt.prompt + args.join(" ");
    return { newInput };
  }

  // Check for invokable rules
  const invokableRule = assistant.rules?.find((rule) => {
    // Handle both string rules and rule objects
    if (!rule || typeof rule === "string") {
      return false;
    }
    const ruleObj = rule as any;
    return ruleObj.invokable === true && ruleObj.name === command;
  });
  if (invokableRule) {
    const ruleObj = invokableRule as any;
    const newInput = ruleObj.rule + " " + args.join(" ");
    return { newInput };
  }

  const { skills } = await loadMarkdownSkills();
  if (skills.length) {
    const normalizedCommand = command.trim().toLowerCase();
    const matchingSkill = skills.find(
      (skill) => getSkillSlashCommandName(skill) === normalizedCommand,
    );

    if (matchingSkill) {
      return {
    newInput: `请使用 **Skills** 工具加载技能，并将 **skill_name** 参数设置为“${matchingSkill.name}”。`,
      };
    }
  }

  // Check if this command would match any available commands (same logic as UI)
  const allCommands = await getAllSlashCommands(assistant);
  const hasMatches = allCommands.some((cmd) =>
    cmd.name.toLowerCase().includes(command.toLowerCase()),
  );

  // If no commands match, treat this as regular text instead of an unknown command
  if (!hasMatches) {
    return null;
  }

  return { output: `未知命令：${command}` };
}
