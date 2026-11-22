#!/usr/bin/env bash
# 鵲太醫 AI 运营工作台（连锁店版）· 一键部署引导脚本
#
# 本脚本从 GitHub 直接拉取并执行，负责：安装 Docker → 拉取源码 → 调用安装向导。
# 你只需在服务器复制一行命令（见 README 或 docs/Docker一键部署.md）。
#
# 私有仓库：需先设置 GH_TOKEN（只读令牌），脚本会用令牌拉取源码。
# 公开仓库：无需任何令牌。
# 指定端口：sudo HTTP_PORT=8080 bash /tmp/qty-boot.sh
# 指定管理员密码：sudo ADMIN_PASSWORD='你的密码' bash /tmp/qty-boot.sh
set -euo pipefail

REPO="Evan78s/Qty_ai_conter"
BRANCH="master"
DEST="${QTY_INSTALL_DIR:-/www/docker/qtyai}"

echo ""
echo "============================================================"
echo "  鵲太醫 AI 运营工作台（连锁店版）· 一键部署"
echo "============================================================"
echo ""

# ---------- 0. root 权限检查 ----------
if [ "$(id -u)" -ne 0 ]; then
  echo "✗ 请以 root 执行：sudo bash /tmp/qty-boot.sh"
  exit 1
fi

# ---------- 1. 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "==> 未检测到 Docker，正在安装…"
  curl -fsSL https://get.docker.com | bash
else
  echo "✓ Docker 已安装"
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "✗ 缺少 docker compose v2 插件，请检查 Docker 安装"
  exit 1
fi
if ! command -v git >/dev/null 2>&1; then
  echo "==> 安装 git…"
  if command -v apt-get >/dev/null 2>&1; then apt-get update -qq && apt-get install -y -qq git;
  elif command -v yum >/dev/null 2>&1; then yum install -y -q git;
  else echo "✗ 请手动安装 git"; exit 1; fi
fi

# ---------- 2. 拉取源码 ----------
if [ -d "$DEST/.git" ]; then
  echo "==> 检测到已有源码，正在更新…"
  git -C "$DEST" pull --ff-only
else
  if [ -n "${GH_TOKEN:-}" ]; then
    CLONE_URL="https://${GH_TOKEN}@github.com/${REPO}.git"
    echo "==> 使用令牌拉取私有仓库…"
  else
    CLONE_URL="https://github.com/${REPO}.git"
    echo "==> 拉取公开仓库…"
  fi
  if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
    echo "✗ 目标目录 $DEST 已存在且非空，但不是本系统的源码目录。"
    echo "  请换一个目录后重试：QTY_INSTALL_DIR=/你的/目录 bash $0"
    echo "  或手动删除该目录后重试：rm -rf $DEST"
    exit 1
  fi
  mkdir -p "$(dirname "$DEST")"
  git clone -b "$BRANCH" "$CLONE_URL" "$DEST"
fi

# ---------- 3. 调用安装向导 ----------
if [ ! -f "$DEST/docker/install.sh" ]; then
  echo "✗ 源码不完整：找不到 $DEST/docker/install.sh"
  exit 1
fi
cd "$DEST"
echo ""
echo "==> 源码就绪，开始安装（下面回答 3 个问题）…"
bash docker/install.sh
