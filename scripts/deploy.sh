#!/usr/bin/env bash
# 养元汇 · 部署脚本：构建前后端并发布到 /opt/yangyuanhui
# 用法：sudo bash scripts/deploy.sh
set -euo pipefail
ROOT="/opt/yangyuanhui"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> [1/6] 构建前端"
cd "$SRC/web"
npm ci --no-audit --no-fund
npm run build

echo "==> [2/6] 构建后端"
cd "$SRC/api"
npm ci --no-audit --no-fund
npm run build

echo "==> [3/6] 创建目录与用户"
id -u yyh >/dev/null 2>&1 || useradd -r -m -s /usr/sbin/nologin yyh
mkdir -p "$ROOT/frontend" "$ROOT/api" "$ROOT/data/files" "$ROOT/data/backups" "$ROOT/scripts"
chown -R root:yyh "$ROOT"
chmod 750 "$ROOT/data"

echo "==> [4/6] 发布产物"
rm -rf "$ROOT/frontend/dist" "$ROOT/api/dist"
cp -r "$SRC/web/dist" "$ROOT/frontend/dist"
cp -r "$SRC/api/dist" "$ROOT/api/dist"
cp -r "$SRC/api/node_modules" "$ROOT/api/node_modules"
cp "$SRC/api/package.json" "$ROOT/api/package.json"
cp -n "$SRC/api/.env.example" "$ROOT/api/.env.example" 2>/dev/null || true

echo "==> [5/6] 自检 .env（首次需手动创建）"
if [ ! -f "$ROOT/api/.env" ]; then
  echo "!! 未找到 $ROOT/api/.env，请先复制 .env.example 并填入真实密钥再启动。"
else
  chmod 600 "$ROOT/api/.env"; chown yyh:yyh "$ROOT/api/.env"
fi

echo "==> [6/6] 迁移表结构 + 种子数据（MySQL，凭据从 .env 读取）"
cd "$ROOT/api"
set -a
source "$ROOT/api/.env"
set +a
node -e "require('./dist/db/migrate.js')"
node -e "require('./dist/db/seed.js')"
mkdir -p "$ROOT/data/uploads/logo" "$ROOT/data/backups"
chown -R yyh:yyh "$ROOT/data"

echo "==> 完成。请配置 Nginx / systemd 后执行："
echo "    sudo systemctl enable --now yangyuanhui"
echo "    sudo bash $ROOT/scripts/bootstrap-admin.sh"
