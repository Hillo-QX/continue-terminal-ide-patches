#!/bin/zsh
set -euo pipefail

EXPECTED_VERSION="1.5.47"
PATCH_DIR="${0:A:h}"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  print -u2 "需要先安装 Node.js 和 npm。"
  exit 1
fi

if ! command -v cn >/dev/null 2>&1; then
  print "未找到 cn，正在安装 Continue CLI ${EXPECTED_VERSION}..."
  npm install -g "@continuedev/cli@${EXPECTED_VERSION}"
fi

CLI_VERSION="$(cn --version 2>/dev/null | head -1 | tr -d '\r')"
if [[ "${CLI_VERSION}" != "${EXPECTED_VERSION}" ]]; then
  print -u2 "Continue CLI 版本为 ${CLI_VERSION}，补丁要求 ${EXPECTED_VERSION}。"
  print -u2 "请先执行：npm install -g @continuedev/cli@${EXPECTED_VERSION}"
  exit 2
fi

GLOBAL_NPM_ROOT="$(npm root -g)"
CLI_DIR="${GLOBAL_NPM_ROOT}/@continuedev/cli"
if [[ ! -d "${CLI_DIR}" ]]; then
  print -u2 "找不到 Continue CLI 目录：${CLI_DIR}"
  exit 3
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${HOME}/.continue/qxen-patch-backups/${STAMP}"
mkdir -p "${BACKUP_DIR}"
tar -czf "${BACKUP_DIR}/continue-cli-before-patch.tar.gz" -C "${CLI_DIR}" src dist

cp -p "${PATCH_DIR}/dist/index.js" "${CLI_DIR}/dist/index.js"
cp -p "${PATCH_DIR}/dist/cn.js" "${CLI_DIR}/dist/cn.js"
if [[ -f "${PATCH_DIR}/dist/xhr-sync-worker.js" ]]; then
  cp -p "${PATCH_DIR}/dist/xhr-sync-worker.js" "${CLI_DIR}/dist/xhr-sync-worker.js"
fi

if [[ -d "${PATCH_DIR}/source-overlay/src" ]]; then
  mkdir -p "${CLI_DIR}/src"
  cp -R "${PATCH_DIR}/source-overlay/src/." "${CLI_DIR}/src/"
fi

node --check "${CLI_DIR}/dist/index.js"
if ! grep -q "WorkspaceSelector" "${CLI_DIR}/dist/index.js"; then
  print -u2 "验收失败：运行版未包含 WorkspaceSelector。"
  exit 4
fi
if ! grep -q "DROPPED_IMAGE" "${CLI_DIR}/dist/index.js"; then
  print -u2 "验收失败：运行版未包含拖入图片附件逻辑。"
  exit 5
fi

print "Continue Terminal IDE 补丁安装完成。"
print "版本：${CLI_VERSION}"
print "备份：${BACKUP_DIR}/continue-cli-before-patch.tar.gz"
print "请关闭当前 Continue TUI 后重新启动。"
