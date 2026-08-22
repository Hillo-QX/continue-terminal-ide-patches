# Continue Terminal IDE 补丁（2026-08-23）

这是今天对 Continue CLI/TUI（`@continuedev/cli` **1.5.47**）的运行版补丁包。

## 功能

- `/chat`、`/聊天`：切换聊天会话；
- `/workspace`、`/工作环境`：选择工作目录；
- 保存最近工作目录到 `~/.continue/workspaces.json`；
- 选择工作目录后继续当前会话或开启新会话；
- 底部显示当前工作环境和路径；
- 拖入文件路径后直接作为原始附件发送；
- PNG/JPG/GIF/WEBP 拖入后作为图片内容发送；
- Continue TUI 中文化显示；
- 不生成转换副本，不移动或覆盖原文件。
- 同步 macOS/Windows 的 Qwen Dispatcher、Compact、Qwen Swarm MCP；
- 新增 `web_search` MCP tool（互联网搜索，不是代码搜索）；
- 首条消息等待一个有界的 MCP 工具发现窗口，避免工具列表永远少一拍。

## 安装

在安装 Continue CLI 1.5.47 后，进入本目录执行：

```bash
./install_continue_patch.sh
```

脚本会先备份当前 Continue CLI 的 `src` 和 `dist`，再安装补丁。安装完成后需要关闭并重新打开 Continue TUI。
同时会把 MCP 文件安装到 `~/.continue/qxen-mcp`，并生成配置模板；请按提示把模板的
`mcpServers` 合并到 `~/.continue/config.yaml`，脚本不会覆盖你的现有配置。

## Windows 安装

在 PowerShell 中执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install_continue_patch.ps1
```

也可以直接双击 `install_continue_patch.cmd`。脚本会创建 `%USERPROFILE%\.continue\qxen-patch-backups\` 下的 ZIP 备份。
MCP 文件会安装到 `%USERPROFILE%\.continue\qxen-mcp`，并生成 Windows 配置模板；请按提示
合并到 Continue 的 `config.yaml`。

也可以把 [`INSTALL_PROMPT_CN.md`](./INSTALL_PROMPT_CN.md) 交给 Codex 或 Luna 执行。

## 回滚

每次安装都会生成备份目录：

```text
~/.continue/qxen-patch-backups/<时间戳>/continue-cli-before-patch.tar.gz
```

恢复前请先退出 Continue，再解压备份覆盖对应 CLI 目录。

## 验收

```bash
cn --version
cn --help
```

进入 TUI 后验证 `/聊天`、`/工作环境`，并拖入一个图片或文本文件测试附件发送。
合并 MCP 配置并重启后，在工具列表/日志中应看到 `web_search`；它用于互联网搜索，
Continue 内置的 `Search` 仍然只用于项目代码搜索，`Fetch` 仍然只抓取已知 URL。
