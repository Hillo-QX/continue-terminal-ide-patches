# Continue MCP 同步包

这个目录包含 macOS 和 Windows 共用的 MCP 服务源码，以及两个平台的
Continue 配置模板。安装器会把它们复制到：

- macOS：`~/.continue/continue-mcp`
- Windows：`%USERPROFILE%\.continue\continue-mcp`

## 安装

1. 运行仓库根目录的对应安装器。
2. 安装器会生成 `config.example.generated.yaml`，把其中的 `mcpServers`
   合并到 Continue 的 `config.yaml`。
3. 不要把真实 API key 写入仓库。模板使用 Continue 的
   `${{ secrets.DASHSCOPE_API_KEY }}` 引用；也可以按 Continue 的密钥配置方式替换。
4. Python MCP 服务需要 Python 3 和 `mcp` 包：
   `python -m pip install mcp`。
5. 重启 Continue；首条请求会等待一个有界的 MCP 工具发现窗口。

Qwen 的 `enable_search: true` 属于模型提供商能力，不是 MCP `tools/list` 返回的
工具；因此它不会以 `web_search` 名称出现在 Continue 的 MCP 工具列表中。Continue
仍然只显示自己的内置工具和已连接的 MCP 工具。

现有的 Qwen Dispatcher、Continue Compact、Qwen Swarm 也一并打包。Kimi Expert
作为可选项单独提供，因为另一台电脑不一定安装 Kimi CLI。
