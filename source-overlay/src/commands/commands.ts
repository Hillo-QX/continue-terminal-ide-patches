import { type AssistantConfig } from "@continuedev/sdk";

import {
  getSkillSlashCommandName,
  loadMarkdownSkills,
} from "../util/loadMarkdownSkills.js";

// Export command functions
export { chat } from "./chat.js";
export { listSessionsCommand } from "./ls.js";
export { review } from "./review.js";
export { serve } from "./serve.js";

export interface SlashCommand {
  name: string;
  description: string;
  category: "system" | "assistant";
}

export interface SystemCommand extends SlashCommand {
  category: "system";
}

// Central definition of all system slash commands
export const SYSTEM_SLASH_COMMANDS: SystemCommand[] = [
  {
    name: "help",
    description: "显示帮助",
    category: "system",
  },
  {
    name: "clear",
    description: "清空对话记录",
    category: "system",
  },
  {
    name: "update",
    description: "更新 Continue CLI",
    category: "system",
  },
  {
    name: "info",
    description: "显示会话信息",
    category: "system",
  },
  {
    name: "model",
    description: "切换可用聊天模型",
    category: "system",
  },
  {
    name: "config",
    description: "切换配置",
    category: "system",
  },
  {
    name: "mcp",
    description: "管理 MCP 服务器连接",
    category: "system",
  },
  {
    name: "init",
    description: "创建 AGENTS.md 文件",
    category: "system",
  },
  {
    name: "compact",
    description: "压缩并总结聊天记录",
    category: "system",
  },
  {
    name: "resume",
    description: "恢复之前的聊天会话",
    category: "system",
  },
  {
    name: "fork",
    description: "从当前历史创建分支会话",
    category: "system",
  },
  {
    name: "title",
    description: "设置当前会话标题",
    category: "system",
  },
  {
    name: "rename",
    description: "重命名当前会话",
    category: "system",
  },
  {
    name: "exit",
    description: "退出对话",
    category: "system",
  },
  {
    name: "jobs",
    description: "查看后台任务",
    category: "system",
  },
  {
    name: "sessions",
    description: "查看所有聊天会话",
    category: "system",
  },
  {
    name: "chat",
    description: "切换聊天会话",
    category: "system",
  },
  {
    name: "workspace",
    description: "选择工作环境",
    category: "system",
  },
  {
    name: "聊天",
    description: "切换聊天会话",
    category: "system",
  },
  {
    name: "工作环境",
    description: "选择工作环境",
    category: "system",
  },
  {
    name: "skills",
    description: "查看所有可用技能",
    category: "system",
  },
  {
    name: "import-skill",
    description: "从网址或名称导入技能到 ~/.continue/skills",
    category: "system",
  },
  {
    name: "export",
    description: "将会话导出为 JSON 文件",
    category: "system",
  },
  {
    name: "import",
    description: "从 JSON 文件导入会话",
    category: "system",
  },
];

export const REMOTE_MODE_SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "exit",
    description: "Exit the remote environment",
    category: "system",
  },
  {
    name: "diff",
    description: "Show the current diff from the remote environment",
    category: "system",
  },
  {
    name: "apply",
    description: "Apply the current diff to the local working tree",
    category: "system",
  },
];

/**
 * Get all available slash commands including system commands and assistant prompts
 */
export async function getAllSlashCommands(
  assistant: AssistantConfig,
  options: { isRemoteMode?: boolean } = {},
): Promise<SlashCommand[]> {
  const { isRemoteMode = false } = options;

  // In remote mode, only show the exit command
  if (isRemoteMode) {
    return REMOTE_MODE_SLASH_COMMANDS;
  }

  // All system commands are available
  const systemCommands = SYSTEM_SLASH_COMMANDS;

  // Get assistant prompt commands
  const assistantCommands: SlashCommand[] =
    assistant?.prompts?.map((prompt) => ({
      name: prompt?.name || "",
      description: prompt?.description || "",
      category: "assistant" as const,
    })) || [];

  // Get invokable rule commands
  const invokableRuleCommands = getInvokableRuleSlashCommands(assistant);

  // Get skill commands
  const skillCommands = await getSkillSlashCommands();

  return [
    ...systemCommands,
    ...assistantCommands,
    ...invokableRuleCommands,
    ...skillCommands,
  ];
}

/**
 * Get assistant prompt commands only
 */
export function getAssistantSlashCommands(
  assistant: AssistantConfig,
): SlashCommand[] {
  return (
    assistant?.prompts?.map((prompt) => ({
      name: prompt?.name || "",
      description: prompt?.description || "",
      category: "assistant" as const,
    })) || []
  );
}

/**
 * Get invokable rule commands from assistant config
 */
export function getInvokableRuleSlashCommands(
  assistant: AssistantConfig,
): SlashCommand[] {
  if (!assistant?.rules) {
    return [];
  }

  return assistant.rules
    .filter((rule) => {
      // Handle both string rules and rule objects
      if (!rule || typeof rule === "string") {
        return false;
      }
      // Only include rules with invokable: true
      return rule.invokable === true;
    })
    .map((rule) => {
      // TypeScript now knows rule is an object with invokable: true
      const ruleObj = rule as any;
      return {
        name: ruleObj.name || "",
        description: ruleObj.description || "",
        category: "assistant" as const,
      };
    });
}

/**
 * Get skill-based slash commands from Markdown skills
 */
export async function getSkillSlashCommands(): Promise<SlashCommand[]> {
  const { skills } = await loadMarkdownSkills();

  return skills.map((skill) => ({
    name: getSkillSlashCommandName(skill),
    description: skill.description,
    category: "assistant" as const,
  }));
}
