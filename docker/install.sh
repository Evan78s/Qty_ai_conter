#!/usr/bin/env bash
# 鵲太醫 AI 运营工作台 · Docker 一键安装
# 用法：把源码放到服务器后，执行  bash docker/install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/docker/.env"
cd "$ROOT"   # 统一工作目录，保证 compose 的相对路径稳定

echo ""
echo "============================================"
echo "  鵲太醫 AI 运营工作台 · Docker 一键安装"
echo "============================================"
echo ""

# ---------- 0. 环境检查 ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ 未检测到 Docker。请先安装："
  echo "  curl -fsSL https://get.docker.com | bash"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "✗ 需要 docker compose v2 插件。请安装 Docker 后再试。"
  exit 1
fi
PYTHON="$(command -v python3 || command -v python || true)"
if [ -z "$PYTHON" ]; then
  echo "✗ 未检测到 python3（用于生成配置）。请先安装 python3。"
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "✗ 未检测到 openssl（用于生成随机密码）。请先安装 openssl。"
  exit 1
fi

# ---------- 1. 询问必要信息 ----------
read -r -p "① 对外访问端口（默认 80，直接回车）: " HTTP_PORT
HTTP_PORT="${HTTP_PORT:-80}"

read -r -p "② 管理员账号（默认 admin，直接回车）: " ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"
if ! [[ "$ADMIN_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "✗ 管理员账号只能用字母、数字、下划线"; exit 1
fi

read -r -s -p "③ 管理员密码（至少8位，直接回车则随机生成）: " ADMIN_PASS
echo ""
if [ -z "$ADMIN_PASS" ]; then
  ADMIN_PASS="$(openssl rand -hex 10)"
  echo "   已随机生成管理员密码（下面会再显示一次，请保存）"
elif [ "${#ADMIN_PASS}" -lt 8 ]; then
  echo "✗ 密码至少 8 位"; exit 1
fi

# ---------- 2. 生成随机数据库密码 ----------
DB_ROOT_PASS="$(openssl rand -hex 20)"
DB_PASS="$(openssl rand -hex 20)"
DB_NAME="yangyuanhui"
DB_USER="qty"

# ---------- 3. 写 .env ----------
cat > "$ENV_FILE" <<EOF
HTTP_PORT=${HTTP_PORT}
MYSQL_DATABASE=${DB_NAME}
MYSQL_USER=${DB_USER}
MYSQL_ROOT_PASSWORD=${DB_ROOT_PASS}
MYSQL_PASSWORD=${DB_PASS}
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
ADMIN_NAME=总管理员
EOF
chmod 600 "$ENV_FILE"
echo "✓ 配置已写入 docker/.env（权限 600，含密码，请勿外传）"

# ---------- 4. 拉起容器 ----------
echo "==> 正在构建并启动容器（首次约需几分钟）…"
docker compose -f "$ROOT/docker/docker-compose.yml" --env-file "$ENV_FILE" up -d --build

# ---------- 5. 等待 API 就绪 ----------
echo "==> 等待服务就绪…"
API_URL="http://127.0.0.1:${HTTP_PORT}/api"
ready=0
for i in $(seq 1 60); do
  if curl -fsS "${API_URL}/setup/status" >/tmp/qty-setup-status.json 2>/dev/null; then
    ready=1; break
  fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  echo "✗ 服务启动超时。查看日志：docker compose -f docker/docker-compose.yml logs -f"
  exit 1
fi
echo "✓ 服务已就绪"

# ---------- 6. 自动安装（建表/种子/管理员/密钥）----------
if grep -q '"installed":true' /tmp/qty-setup-status.json; then
  echo "✓ 系统已安装过，跳过初始化（数据保留）"
else
  echo "==> 正在初始化系统（建表 + 管理员 + 密钥）…"
  BODY_FILE="$(mktemp)"
  "$PYTHON" - "$BODY_FILE" "$DB_NAME" "$DB_USER" "$DB_PASS" "$ADMIN_USER" "$ADMIN_PASS" <<'PY'
import json, sys
out, db, user, pwd, admin_u, admin_p = sys.argv[1:7]
body = {
  "host": "mysql", "port": 3306, "user": user, "password": pwd,
  "name": db, "createDatabase": False,
  "adminUsername": admin_u, "adminPassword": admin_p,
  "adminName": "总管理员", "platformName": "鵲太醫"
}
open(out, "w").write(json.dumps(body, ensure_ascii=False))
PY
  RESP="$(curl -fsS -X POST "${API_URL}/setup/install" \
      -H 'Content-Type: application/json' --data-binary @"$BODY_FILE" 2>&1)" || {
        echo "✗ 初始化失败：$RESP"
        echo "  查看日志：docker compose -f docker/docker-compose.yml logs api"
        exit 1
      }
  rm -f "$BODY_FILE"
  echo "✓ 初始化完成"
fi

# ---------- 7. 输出访问信息 ----------
echo ""
echo "============================================"
echo "  安装完成！"
echo "--------------------------------------------"
echo "  访问地址：http://服务器IP:${HTTP_PORT}"
echo "  管理员：${ADMIN_USER}"
echo "  密码：${ADMIN_PASS}"
echo "--------------------------------------------"
echo "  首次登录会强制要求修改密码。"
echo "  密码也已保存在 docker/.env，请妥善保管。"
echo "============================================"
echo ""
