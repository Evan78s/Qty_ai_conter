#!/usr/bin/env bash
# 鵲太醫 AI 运营工作台 · Docker 一键安装
# 用法：把源码放到服务器后，执行  bash docker/install.sh
# 断点续装：若 docker/.env 已存在，自动复用端口与密码，不会重新生成。
# 自定义端口：HTTP_PORT=8080 bash docker/install.sh
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

# ---------- 端口工具 ----------
port_in_use() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk 'NR>1{print $4}' | grep -qE "[:.]$p\$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk 'NR>2{print $4}' | grep -qE "[:.]$p\$"
  else
    return 1
  fi
}
next_free_port() {
  local p=8080
  while port_in_use "$p"; do p=$((p+1)); done
  echo "$p"
}

# ---------- 1. 读取已有配置（断点续装）或首次询问 ----------
RESUME=0
if [ -f "$ENV_FILE" ]; then
  echo "✓ 检测到已有配置 docker/.env，将复用端口与密码（断点续装）"
  ENV_SOURCE="$(mktemp)"
  "$PYTHON" - "$ENV_FILE" "$ENV_SOURCE" <<'PY'
import sys, shlex
src, out = sys.argv[1:3]
d = {}
for line in open(src, encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    if len(v) >= 2 and v[0] == '"' and v[-1] == '"':
        v = v[1:-1].replace('\\"', '"').replace('\\\\', '\\')
    d[k] = v
mapping = {
    'HTTP_PORT': 'EXIST_HTTP_PORT',
    'MYSQL_DATABASE': 'EXIST_DB_NAME',
    'MYSQL_USER': 'EXIST_DB_USER',
    'MYSQL_ROOT_PASSWORD': 'EXIST_DB_ROOT_PASS',
    'MYSQL_PASSWORD': 'EXIST_DB_PASS',
    'ADMIN_USERNAME': 'EXIST_ADMIN_USER',
    'ADMIN_PASSWORD': 'EXIST_ADMIN_PASS',
}
with open(out, 'w', encoding='utf-8') as f:
    for k, var in mapping.items():
        if k in d:
            f.write(f"{var}={shlex.quote(d[k])}\n")
PY
  # shellcheck disable=SC1090
  source "$ENV_SOURCE"
  rm -f "$ENV_SOURCE"
  RESUME=1
fi

HTTP_PORT_FROM_ENV=0
if [ -n "${HTTP_PORT:-}" ]; then HTTP_PORT_FROM_ENV=1; fi

if [ "$RESUME" -eq 1 ]; then
  HTTP_PORT="${HTTP_PORT:-${EXIST_HTTP_PORT:-80}}"
  DB_NAME="${EXIST_DB_NAME:-yangyuanhui}"
  DB_USER="${EXIST_DB_USER:-qty}"
  DB_ROOT_PASS="${EXIST_DB_ROOT_PASS:-}"
  DB_PASS="${EXIST_DB_PASS:-}"
  ADMIN_USER="${EXIST_ADMIN_USER:-admin}"
  ADMIN_PASS="${EXIST_ADMIN_PASS:-}"
  echo "① 对外访问端口：${HTTP_PORT}（复用已有配置）"
  echo "② 管理员账号：${ADMIN_USER}（复用已有配置）"
  if [ -n "${ADMIN_PASSWORD:-}" ]; then
    ADMIN_PASS="$ADMIN_PASSWORD"
    echo "③ 管理员密码：已通过环境变量更新（${#ADMIN_PASS} 位）"
  else
    echo "③ 管理员密码：复用已有配置（${#ADMIN_PASS} 位）"
  fi
else
  if [ "$HTTP_PORT_FROM_ENV" -eq 1 ]; then
    echo "① 对外访问端口：${HTTP_PORT}（来自环境变量）"
  else
    DEFAULT_HTTP_PORT=80
    if port_in_use 80; then
      DEFAULT_HTTP_PORT="$(next_free_port)"
      echo "⚠ 80 端口已被占用（常见：宝塔 / Nginx / Apache），默认改用 ${DEFAULT_HTTP_PORT}。"
    fi
    read -r -p "① 对外访问端口（默认 ${DEFAULT_HTTP_PORT}，直接回车）: " HTTP_PORT
    HTTP_PORT="${HTTP_PORT:-$DEFAULT_HTTP_PORT}"
  fi

  read -r -p "② 管理员账号（默认 admin，直接回车）: " ADMIN_USER
  ADMIN_USER="${ADMIN_USER:-admin}"
  if ! [[ "$ADMIN_USER" =~ ^[A-Za-z0-9_]+$ ]]; then
    echo "✗ 管理员账号只能用字母、数字、下划线"; exit 1
  fi

  # 优先用环境变量 ADMIN_PASSWORD（适合含特殊字符、或终端无法输入的情况）
  # 用法：sudo ADMIN_PASSWORD='MyP@ss#123!' bash /tmp/qty-boot.sh
  if [ -n "${ADMIN_PASSWORD:-}" ]; then
    ADMIN_PASS="$ADMIN_PASSWORD"
    echo "③ 管理员密码：已通过环境变量读取（${#ADMIN_PASS} 位）"
  else
    echo "③ 管理员密码（至少 8 位，直接回车则随机生成）"
    echo "   注意：密码会显示在屏幕上，输入时请确保周围无人。"
    echo "   若终端无法输入数字或特殊字符，请改用环境变量方式（见文档）。"
    read -r -p "   请输入密码: " ADMIN_PASS
  fi
  if [ -z "$ADMIN_PASS" ]; then
    ADMIN_PASS="$(openssl rand -hex 10)"
    echo "   已随机生成管理员密码（下面会再显示一次，请保存）"
  elif [ "${#ADMIN_PASS}" -lt 8 ]; then
    echo "✗ 密码至少 8 位"; exit 1
  fi

  DB_ROOT_PASS="$(openssl rand -hex 20)"
  DB_PASS="$(openssl rand -hex 20)"
  DB_NAME="yangyuanhui"
  DB_USER="qty"
fi

# ---------- 端口校验 ----------
if ! [[ "$HTTP_PORT" =~ ^[0-9]+$ ]] || [ "$HTTP_PORT" -lt 1 ] || [ "$HTTP_PORT" -gt 65535 ]; then
  echo "✗ 端口必须是 1-65535 的数字"; exit 1
fi
if port_in_use "$HTTP_PORT"; then
  if [ "$HTTP_PORT_FROM_ENV" -eq 0 ] && [ "$RESUME" -eq 1 ]; then
    echo "⚠ 配置中的端口 ${HTTP_PORT} 已被占用，自动改用空闲端口。"
    HTTP_PORT="$(next_free_port)"
  else
    echo "✗ 端口 ${HTTP_PORT} 已被占用，请换一个端口后重试。"
    echo "  查看占用：ss -ltnp | grep ':${HTTP_PORT}'"
    echo "  指定端口：HTTP_PORT=8080 bash docker/install.sh"
    exit 1
  fi
fi
echo "→ 本次使用端口：${HTTP_PORT}"

# ---------- 2. 写 .env（用 python 写，避免密码中的 $、`、\、" 被 shell 篡改）----------
"$PYTHON" - "$ENV_FILE" "$HTTP_PORT" "$DB_NAME" "$DB_USER" "$DB_ROOT_PASS" "$DB_PASS" "$ADMIN_USER" "$ADMIN_PASS" <<'PY'
import sys
path, port, db, user, rootpw, dbpw, admin_u, admin_p = sys.argv[1:9]
def q(v):  # 加双引号并转义 \ 和 "，保证 docker compose 读到原样密码
    return '"' + v.replace('\\', '\\\\').replace('"', '\\"') + '"'
lines = [
    f"HTTP_PORT={port}",
    f"MYSQL_DATABASE={db}",
    f"MYSQL_USER={user}",
    f"MYSQL_ROOT_PASSWORD={q(rootpw)}",
    f"MYSQL_PASSWORD={q(dbpw)}",
    f"ADMIN_USERNAME={q(admin_u)}",
    f"ADMIN_PASSWORD={q(admin_p)}",
    "ADMIN_NAME=总管理员",
]
open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
PY
chmod 600 "$ENV_FILE"
echo "✓ 配置已写入 docker/.env（权限 600，含密码，请勿外传）"

# ---------- 3. 拉起容器 ----------
echo "==> 正在构建并启动容器（首次约需几分钟）…"
docker compose -f "$ROOT/docker/docker-compose.yml" --env-file "$ENV_FILE" up -d --build

# ---------- 4. 等待 API 就绪 ----------
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

# ---------- 5. 自动安装（建表/种子/管理员/密钥）----------
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

# ---------- 6. 输出访问信息 ----------
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
