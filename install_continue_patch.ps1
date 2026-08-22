$ErrorActionPreference = "Stop"

$ExpectedVersion = "1.5.47"
$PatchDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "需要先安装 Node.js。"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "需要先安装 npm。"
}

$cnCommand = Get-Command cn -ErrorAction SilentlyContinue
if (-not $cnCommand) {
    Write-Host "未找到 cn，正在安装 Continue CLI $ExpectedVersion..."
    npm install -g "@continuedev/cli@$ExpectedVersion"
    $cnCommand = Get-Command cn -ErrorAction SilentlyContinue
}
if (-not $cnCommand) {
    throw "安装后仍找不到 cn，请把 npm 全局 bin 目录加入 PATH。"
}

$cliVersion = ((& $cnCommand.Source --version 2>$null) | Select-Object -First 1).Trim()
if ($cliVersion -ne $ExpectedVersion) {
    throw "Continue CLI 版本为 $cliVersion，补丁要求 $ExpectedVersion。请先执行：npm install -g @continuedev/cli@$ExpectedVersion"
}

$globalNpmRoot = ((npm root -g) | Select-Object -First 1).Trim()
$cliDir = Join-Path $globalNpmRoot "@continuedev\cli"
if (-not (Test-Path $cliDir)) {
    throw "找不到 Continue CLI 目录：$cliDir"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $env:USERPROFILE ".continue\qxen-patch-backups\$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupArchive = Join-Path $backupDir "continue-cli-before-patch.zip"
Compress-Archive -Path (Join-Path $cliDir "src"), (Join-Path $cliDir "dist") -DestinationPath $backupArchive -Force

Copy-Item (Join-Path $PatchDir "dist\index.js") (Join-Path $cliDir "dist\index.js") -Force
Copy-Item (Join-Path $PatchDir "dist\cn.js") (Join-Path $cliDir "dist\cn.js") -Force
$worker = Join-Path $PatchDir "dist\xhr-sync-worker.js"
if (Test-Path $worker) {
    Copy-Item $worker (Join-Path $cliDir "dist\xhr-sync-worker.js") -Force
}

$sourceOverlay = Join-Path $PatchDir "source-overlay\src"
if (Test-Path $sourceOverlay) {
    New-Item -ItemType Directory -Force -Path (Join-Path $cliDir "src") | Out-Null
    Copy-Item (Join-Path $sourceOverlay "*") (Join-Path $cliDir "src") -Recurse -Force
}

$mcpDir = Join-Path $env:USERPROFILE ".continue\continue-mcp"
New-Item -ItemType Directory -Force -Path $mcpDir | Out-Null
Copy-Item (Join-Path $PatchDir "mcp\*") $mcpDir -Recurse -Force
$mcpDirYaml = $mcpDir.Replace("\", "/")
$windowsTemplate = Get-Content (Join-Path $PatchDir "mcp\config.windows.example.yaml") -Raw
$kimiTemplate = Get-Content (Join-Path $PatchDir "mcp\config.kimi.optional.yaml") -Raw
$windowsTemplate.Replace("__MCP_DIR__", $mcpDirYaml) | Set-Content (Join-Path $mcpDir "config.example.generated.yaml") -Encoding UTF8
$kimiTemplate.Replace("__MCP_DIR__", $mcpDirYaml) | Set-Content (Join-Path $mcpDir "config.kimi.optional.generated.yaml") -Encoding UTF8

node --check (Join-Path $cliDir "dist\index.js")
$bundleText = Get-Content (Join-Path $cliDir "dist\index.js") -Raw
if ($bundleText -notmatch "WorkspaceSelector") {
    throw "验收失败：运行版未包含 WorkspaceSelector。"
}
if ($bundleText -notmatch "DROPPED_IMAGE") {
    throw "验收失败：运行版未包含拖入图片附件逻辑。"
}

Write-Host "Continue Terminal IDE Windows 补丁安装完成。"
Write-Host "版本：$cliVersion"
Write-Host "备份：$backupArchive"
Write-Host "MCP 文件：$mcpDir"
Write-Host "配置模板：$(Join-Path $mcpDir "config.example.generated.yaml")（合并到 Continue config.yaml）"
Write-Host "请关闭当前 Continue TUI 后重新启动。"
