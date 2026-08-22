# 安装 Continue 后执行的 Prompt

```text
你现在要在这台电脑上安装 QXEN-CD 项目中的 Continue Terminal IDE 补丁。

前置条件：我已经安装了 Node.js、npm，以及 Continue CLI。请先确认 `cn --version`；本补丁只适配 Continue CLI 1.5.47。

补丁目录：
patches/continue-terminal-ide-20260823

请严格按以下顺序执行：

1. 运行 `cn --version`，如果不是 1.5.47，先执行：
   `npm install -g @continuedev/cli@1.5.47`
2. 进入补丁目录，执行：
   `./install_continue_patch.sh`
   如果是 Windows，则在 PowerShell 执行：
   `Set-ExecutionPolicy -Scope Process Bypass; .\install_continue_patch.ps1`
   或双击 `install_continue_patch.cmd`。
3. 确认脚本输出“补丁安装完成”，并检查 `cn --version` 仍为 1.5.47。
4. 关闭已经运行的 Continue TUI，再重新启动 Continue。
5. 验收以下功能：
   - 输入 `/聊天` 可以打开聊天会话选择；
   - 输入 `/工作环境` 可以选择项目目录；
   - 选择目录后，右下/底部显示当前工作环境和路径；
   - 将图片路径拖进输入框并回车，图片作为原始图片附件发送；
   - 将文本文件路径拖进输入框并回车，文件作为附件上下文发送；
   - 原文件没有被移动、复制或覆盖。
6. 检查安装器输出的 MCP 模板路径：
   - macOS：`~/.continue/continue-mcp/config.example.generated.yaml`
   - Windows：`%USERPROFILE%\.continue\continue-mcp\config.example.generated.yaml`
   将模板中的 `mcpServers` 合并到 Continue 配置后，重启 Continue。
7. 验收 MCP：工具列表中应出现 `dispatcher_health` 等已连接 MCP 工具。
   Qwen 的 `enable_search` 是模型提供商能力，不会作为 MCP tool 出现在列表中；
   `Search` 是项目代码搜索，`Fetch` 是已知 URL 抓取。
8. 验收执行闸门：没有有效 Dispatcher 任务时直接调用 `Read`、`Bash` 或 MCP
   工具必须被拒绝；Dispatcher 返回任务后，只有 `allowed_tool_names` 中的工具可以执行。

约束：

- 不要修改 Continue 的底层工具 ID、权限协议、模型调用协议或 CLI flags；
- 不要重新引入 QX Code 三栏 GUI；
- 不要执行 OCR、PDF/Word 转换或创建 continue-converted 目录；
- 如果安装失败，保留错误输出，不要删除备份；
- 只修改 Continue CLI 1.5.47 的补丁目标文件。
- 不要把真实 API key、token 或个人配置文件提交到 Git；模板中的 secrets 引用保持不变。
- Dispatcher 失败时不要绕过闸门直接执行 Bash；应报告阻断原因。
```
