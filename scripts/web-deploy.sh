#!/usr/bin/env bash
# 鵲太醫 AI 运营工作台（连锁店版）· 网站目录部署（宝塔 / 原生 Nginx + Node + MySQL）
# 不用 Docker：前端构建后放进网站目录，后端由 systemd 守护，域名由宝塔解析。
#
# 用法（复制到服务器执行）：
#   curl -fsSL https://raw.githubusercontent.com/Evan78s/Qty_ai_conter/master/scripts/web-deploy.sh -o /tmp/qty-web-deploy.sh && sudo bash /tmp/qty-web-deploy.sh
#
# 可选环境变量：
#   QTY_WEB_ROOT=/www/wwwroot/你的域名   网站根目录（前端文件放这里）
#   QTY_APP_DIR=/www/wwwroot/quetaiyiai-src   源码与后端运行目录
#   QTY_API_PORT=3000                   后端监听端口（本机，不对外暴露）
# 注意：已经在用非默认端口（例如为避开宝塔 upage 占用的 3000 而改用 3100）的服务器，
# 重新执行时必须显式带 QTY_API_PORT=3100，否则会把 systemd 服务重置回 3000 导致冲突。
# 本脚本可重复执行：已有源码时自动 git pull → 重建 → 重启，不会删除数据库或 install.json。
set -euo pipefail

REPO="https://github.com/Evan78s/Qty_ai_conter.git"
BRANCH="master"
WEB_ROOT="${QTY_WEB_ROOT:-/www/wwwroot/quetaiyiai}"
APP_DIR="${QTY_APP_DIR:-/www/wwwroot/quetaiyiai-src}"
API_PORT="${QTY_API_PORT:-3000}"
SERVICE="qty-api"

echo ""
echo "============================================================"
echo "  鵲太醫 AI 运营工作台（连锁店版）· 网站目录部署"
echo "============================================================"
echo ""
echo "  网站目录：$WEB_ROOT"
echo "  源码目录：$APP_DIR"
echo "  后端端口：$API_PORT（仅本机 127.0.0.1，由 Nginx 反代）"
echo ""

# ---------- 0. root 检查 ----------
if [ "$(id -u)" -ne 0 ]; then
  echo "✗ 请以 root 执行：sudo bash /tmp/qty-web-deploy.sh"
  exit 1
fi

# ---------- 1. 安装基础依赖 ----------
need_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! need_cmd git; then
  echo "==> 安装 git…"
  if need_cmd apt-get; then apt-get update -qq && apt-get install -y -qq git curl;
  elif need_cmd yum; then yum install -y -q git curl;
  elif need_cmd dnf; then dnf install -y -q git curl;
  else echo "✗ 无法自动安装 git，请先手动安装"; exit 1; fi
fi

if ! need_cmd node || [ "$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)" -lt 20 ]; then
  echo "==> 安装 Node.js 22 LTS（官方二进制包，兼容 CentOS / Ubuntu / 宝塔）…"
  # 不用 NodeSource 脚本（它在部分阿里云 CentOS 上会误判系统），直接下载官方预编译包。
  NODE_VER="v22.14.0"
  case "$(uname -m)" in
    x86_64)  NODE_ARCH="x64" ;;
    aarch64|arm64) NODE_ARCH="arm64" ;;
    *) echo "✗ 不支持的 CPU 架构：$(uname -m)"; exit 1 ;;
  esac
  NODE_TARBALL="node-${NODE_VER}-linux-${NODE_ARCH}.tar.xz"
  NODE_INSTALLED=0
  # 优先国内镜像（阿里云服务器快），失败再回退官方源
  for NODE_BASE in "https://npmmirror.com/mirrors/node" "https://nodejs.org/dist"; do
    NODE_URL="${NODE_BASE}/${NODE_VER}/${NODE_TARBALL}"
    echo "    尝试下载：${NODE_URL}"
    if curl -fsSL --connect-timeout 15 --retry 2 "$NODE_URL" -o "/tmp/${NODE_TARBALL}"; then
      if tar -xf "/tmp/${NODE_TARBALL}" -C /usr/local --strip-components=1; then
        NODE_INSTALLED=1
        rm -f "/tmp/${NODE_TARBALL}"
        break
      fi
    fi
  done
  if [ "$NODE_INSTALLED" -ne 1 ]; then
    echo "✗ Node.js 下载失败。请检查服务器能否访问外网，或手动安装 Node 22 后重试。"
    exit 1
  fi
  hash -r 2>/dev/null || true
  echo "✓ Node.js $(node -v) 安装完成"
else
  echo "✓ Node.js $(node -v) 已就绪"
fi

# 运行用户：宝塔环境用 www，其余系统创建 qty
if id -u www >/dev/null 2>&1; then
  RUN_USER="www"; RUN_GROUP="www"
else
  RUN_USER="qty"; RUN_GROUP="qty"
  id -u qty >/dev/null 2>&1 || useradd -r -m -s /usr/sbin/nologin qty
fi
echo "✓ 运行用户：$RUN_USER"

# ---------- 2. 拉取源码 ----------
if [ -d "$APP_DIR/.git" ]; then
  echo "==> 检测到已有源码，正在更新…"
  git -C "$APP_DIR" pull --ff-only
else
  if [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    echo "✗ 源码目录 $APP_DIR 已存在且非空。"
    echo "  请换目录：QTY_APP_DIR=/你的/目录 bash $0"
    exit 1
  fi
  echo "==> 拉取源码…"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
fi

# ---------- 3. 构建前后端 ----------
echo "==> 构建前端（ vite build ）…"
cd "$APP_DIR/web"
npm ci --no-audit --no-fund
npm run build

echo "==> 构建后端（ tsc ）…"
cd "$APP_DIR/api"
npm ci --no-audit --no-fund
npm run build

# ---------- 4. 发布前端到网站目录 ----------
mkdir -p "$WEB_ROOT"
cp -r "$APP_DIR/web/dist/." "$WEB_ROOT/"
echo "✓ 前端已发布到 $WEB_ROOT"

# ---------- 5. 后端数据目录与权限 ----------
mkdir -p "$APP_DIR/api/data"
chown -R "$RUN_USER:$RUN_GROUP" "$APP_DIR/api/data" || true
# 宝塔会在网站目录生成 .user.ini 并加不可变属性（chattr +i），对其 chown 必然报
# "Operation not permitted"。脚本开头有 set -e，若不吞掉这个错误会在此中断，
# 导致后面的 systemd 配置/后端重启全部不执行 —— 表现为前端已更新但后端仍是旧代码（接口 404）。
if ! chown -R "$RUN_USER:$RUN_GROUP" "$WEB_ROOT" 2>/dev/null; then
  find "$WEB_ROOT" -name .user.ini -prune -o -exec chown -h "$RUN_USER:$RUN_GROUP" {} + 2>/dev/null || true
  echo "    已跳过宝塔保护文件 .user.ini（属主调整失败不影响运行）"
fi
chmod 750 "$APP_DIR/api/data"

# ---------- 6. systemd 服务 ----------
SERVICE_FILE="/etc/systemd/system/${SERVICE}.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=QTY AI Console API
After=network.target mysql.service mysqld.service

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$APP_DIR/api
Environment=NODE_ENV=production
Environment=PORT=$API_PORT
Environment=HOST=127.0.0.1
ExecStart=$(command -v node) dist/main.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
# 若 3000 端口已被占用（常见：之前 Docker 部署残留的容器），先明确提示，避免服务反复重启却查不到原因
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | awk 'NR>1{print $4}' | grep -qE "[:.]$API_PORT\$"; then
  echo "⚠ 检测到端口 $API_PORT 已被占用（可能是之前 Docker 部署的容器）。若后端启动失败，请先清理："
  echo "    docker ps -a --filter 'name=qty-' -q | xargs -r docker rm -f"
fi
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
echo "✓ 后端服务已启动：$SERVICE"

# ---------- 6.5 后台一键升级：安装执行器 + 配置 sudo 白名单 ----------
# 后端以 www（或 qty）运行，无权 git pull / 重启服务，故用 sudo 白名单只允许运行它专属的升级脚本。
# 该脚本路径写死、不接受任何参数，www 用户对它只有执行权、无写权，无法借此提权执行任意命令。
echo "==> 配置后台一键升级…"
if ! need_cmd sudo; then
  echo "    安装 sudo…"
  if need_cmd apt-get; then apt-get install -y -qq sudo; else yum install -y -q sudo; fi
fi
UPGRADE_BIN="/usr/local/bin/qty-upgrade"
cp "$APP_DIR/scripts/upgrade-runner.sh" "$UPGRADE_BIN"
chown root:root "$UPGRADE_BIN"
chmod 750 "$UPGRADE_BIN"
# 真实目录/端口写入 root 专属配置，升级脚本自行读取（不依赖 sudo 环境变量传递）
UPGRADE_ENV="/etc/qty-upgrade.env"
cat > "$UPGRADE_ENV" <<EOF
QTY_APP_DIR=$APP_DIR
QTY_WEB_ROOT=$WEB_ROOT
QTY_API_PORT=$API_PORT
QTY_SERVICE=$SERVICE
QTY_RUN_USER=$RUN_USER
EOF
chown root:root "$UPGRADE_ENV"; chmod 600 "$UPGRADE_ENV"
SUDOERS_FILE="/etc/sudoers.d/qty-upgrade"
cat > "$SUDOERS_FILE" <<EOF
# 鵲太醫 AI 运营工作台后台升级：仅允许 $RUN_USER 免密执行固定升级脚本（不接受任何参数）
$RUN_USER ALL=(root) NOPASSWD: $UPGRADE_BIN
EOF
chown root:root "$SUDOERS_FILE"; chmod 440 "$SUDOERS_FILE"
# 校验语法，避免 sudoers 写错导致 sudo 整体不可用
if command -v visudo >/dev/null 2>&1 && ! visudo -cf "$SUDOERS_FILE" >/dev/null 2>&1; then
  echo "⚠ sudoers 配置校验未通过，已移除以免阻断 sudo；后台升级将不可用，请手动升级"
  rm -f "$SUDOERS_FILE"
else
  echo "✓ 后台一键升级已就绪（$UPGRADE_BIN）"
fi

# ---------- 7. 生成 Nginx 配置片段 ----------
SNIPPET="$APP_DIR/nginx-snippet.conf"
cat > "$SNIPPET" <<EOF
# 鵲太醫 AI 运营工作台 · Nginx 配置片段
# 宝塔面板：网站 → 你的域名 → 设置 → 配置文件，把下面 location 放进 server { } 内

location /api/ {
    proxy_pass http://127.0.0.1:$API_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    client_max_body_size 20m;
}

# 前端 history 路由回退（必须加，否则 /setup 等页面 404）
# 宝塔「配置」标签：把下面这段 location / 放进 server { } 内（和上面的 /api/ 并列）
# 或宝塔「URL 重写 / 伪静态」标签：只填 try_files 那一行
location / {
    try_files \$uri \$uri/ /index.html;
}
EOF
echo "✓ Nginx 配置片段已生成：$SNIPPET"

# ---------- 8. 自检 ----------
sleep 2
if systemctl is-active --quiet "$SERVICE"; then
  echo "✓ 后端进程运行中"
else
  echo "⚠ 后端未启动，查看日志：journalctl -u $SERVICE -n 50"
fi
HEALTH="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || true)"
echo "  健康检查：${HEALTH:-未安装数据库时会返回错误，属正常现象}"

# ---------- 9. 后续指引 ----------
echo ""
echo "============================================================"
echo "  部署完成！接下来在宝塔面板做 3 件事："
echo "------------------------------------------------------------"
echo "  1) 数据库 → 添加数据库"
echo "     库名：quetaiyiai    用户名：quetaiyiai    密码：自定义（记下来）"
echo "     （字符集选 utf8mb4；不用手动建表，网页向导会建）"
echo ""
echo "  2) 网站 → 你的域名 → 设置 → 配置文件"
echo "     把 $SNIPPET 里的 location /api/ 放进 server { } 内，保存"
echo "     伪静态填：try_files \$uri \$uri/ /index.html;"
echo ""
echo "  3) 浏览器打开 https://你的域名/setup"
echo "     填数据库地址 127.0.0.1、端口 3306、库名/账号/密码"
echo "     点「测试连接」→「一键安装」"
echo "     密钥会自动生成并写入 $APP_DIR/api/data/install.json"
echo "------------------------------------------------------------"
echo "  常用命令："
echo "    systemctl status $SERVICE            查看后端状态"
echo "    journalctl -u $SERVICE -f            看后端日志"
echo "    systemctl restart $SERVICE           重启后端"
echo "    cd $APP_DIR && git pull && bash scripts/web-deploy.sh   升级"
echo "============================================================"
echo ""
