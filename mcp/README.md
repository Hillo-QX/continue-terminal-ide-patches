# Continue MCP 同步包

这个目录包含 macOS 和 Windows 共用的 MCP 服务源码，以及两个平台的
Continue 配置模板。安装器会把它们复制到：

- macOS：`~/.continue/qxen-mcp`
- Windows：`%USERPROFILE%\.continue\qxen-mcp`

## 安装

1. 运行仓库根目录的对应安装器。
2. 安装器会生成 `config.example.generated.yaml`，把其中的 `mcpServers`
   合并到 Continue 的 `config.yaml`。
3. 不要把真实 API key 写入仓库。模板使用 Continue 的
   `${{ secrets.DASHSCOPE_API_KEY }}` 引用；也可以按 Continue 的密钥配置方式替换。
4. Python MCP 服务需要 Python 3 和 `mcp` 包：
   `python -m pip install mcp`。
5. 重启 Continue；首条请求会等待一个有界的 MCP 工具发现窗口。

## Web Search 为什么之前不能用

Continue 内置的 `Search` 是项目代码搜索，`Fetch` 是抓取已知 URL，二者都不是
互联网搜索。Qwen 的 `enable_search: true` 只是模型提供商请求参数，也不会注册
一个 Continue tool。以前的配置没有 Web Search MCP，因此工具列表里不会出现搜索。

这里新增的 `web_search_mcp.py` 暴露了真实的 `web_search` MCP tool。它使用公开的
DuckDuckGo HTML 搜索接口，不需要 API key，返回标题、URL 和摘要；网络不可用时
返回 `FALLBACK`，不会阻塞 Continue。

现有的 Qwen Dispatcher、Continue Compact、Qwen Swarm 也一并打包。Kimi Expert
作为可选项单独提供，因为另一台电脑不一定安装 Kimi CLI。
