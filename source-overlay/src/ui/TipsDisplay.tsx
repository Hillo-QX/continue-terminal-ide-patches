import { Box, Text } from "ink";
import React, { useMemo } from "react";

// Array of helpful tips for Continue CLI users
const CONTINUE_CLI_TIPS = [
  "使用 `/help` 查看键盘快捷键",
  "按 Esc 暂停 cn，按回车继续",
  "使用 ↑/↓ 浏览输入历史",
  '输入 "\\" 后按回车可以换行',
  "使用 `cn ls` 或 `/resume` 恢复之前的对话",
  '使用 `-p` 参数运行 `cn` 可进入无界面模式，例如：`cn -p "Generate a commit message for the current changes. Output _only_ the commit message and nothing else."`',
  "使用 /init 命令生成 AGENTS.md，帮助 `cn` 理解代码库并给出更好的回答。",
];

interface TipsDisplayProps {
  // No props needed - component handles its own randomization
}

/**
 * Randomly selects and displays a tip from the CONTINUE_CLI_TIPS array.
 * Should only be shown 1 in 5 times (20% chance).
 */
const TipsDisplay: React.FC<TipsDisplayProps> = () => {
  // Randomly select a tip, memoized to prevent changing on re-renders
  const randomTip = useMemo(
    () =>
      CONTINUE_CLI_TIPS[Math.floor(Math.random() * CONTINUE_CLI_TIPS.length)],
    [],
  );

  return (
    <Box flexDirection="row" paddingX={1} paddingBottom={1}>
      <Text color="green" bold>
        提示：
      </Text>
      <Text color="dim" italic>
        {" "}
        {randomTip}
      </Text>
      <Text> </Text>
    </Box>
  );
};

/**
 * Determines whether to show a tip (1 in 5 chance, 20% probability)
 */
export function shouldShowTip(): boolean {
  return Math.random() < 0.2; // 20% chance (1 in 5)
}

export { CONTINUE_CLI_TIPS, TipsDisplay };
