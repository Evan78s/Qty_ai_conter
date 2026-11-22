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

echo "==> [6/6] 数据目录准备（建表交由网页安装向导，未安装时不连库）"
mkdir -p "$ROOT/api/data" "$ROOT/data/uploads/logo" "$ROOT/data/backups"
chown -R yyh:yyh "$ROOT/api/data" "$ROOT/data"

# 已安装实例：平滑增量迁移（新列/新索引缺则补，不动已有数据）；未安装则跳过，等网页向导建表。
if [ -f "$ROOT/api/data/install.json" ]; then
  echo "==> 检测到已安装实例，检查数据库增量迁移…"
  cd "$ROOT/api"
  node -e "require('./dist/db/migrate.js')" || echo "!! 增量迁移失败，请检查数据库配置，服务仍会启动"
fi

echo "==> 完成。接下来："
echo "    1) 配置 Nginx 让浏览器可访问（见 docs）"
echo "    2) sudo systemctl daemon-reload && sudo systemctl enable --now yangyuanhui"
echo "    3) 浏览器打开 http://你的域名/setup 走安装向导（建表/建管理员/密钥）"
