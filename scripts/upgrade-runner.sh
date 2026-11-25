#!/usr/bin/env bash
# 鵲太醫 AI 运营工作台（连锁店版）· 后台一键升级执行器
# 由 web-deploy.sh 安装并以 sudo 白名单授权，只能由后端以 root 身份触发。
# 流程：git pull → 构建前端 → 构建后端 → 发布前端 → 重启后端；全程写状态文件供前端轮询。
#
# 用法（仅后端内部调用）：sudo /usr/local/bin/qty-upgrade
# 状态：api/data/upgrade-status.json   日志：api/data/upgrade.log
set -uo pipefail

# 参数从 root 专属配置文件读取（sudo 会清理环境变量，不依赖 env 传递）
UPGRADE_ENV="${QTY_UPGRADE_ENV:-/etc/qty-upgrade.env}"
if [ -f "$UPGRADE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$UPGRADE_ENV"
fi
APP_DIR="${QTY_APP_DIR:-/www/wwwroot/quetaiyiai-src}"
WEB_ROOT="${QTY_WEB_ROOT:-/www/wwwroot/quetaiyiai}"
API_PORT="${QTY_API_PORT:-3000}"
SERVICE="${QTY_SERVICE:-qty-api}"
RUN_USER="${QTY_RUN_USER:-www}"
DATA_DIR="$APP_DIR/api/data"
STATUS_FILE="$DATA_DIR/upgrade-status.json"
LOG_FILE="$DATA_DIR/upgrade.log"
LOCK_FILE="/tmp/qty-upgrade.lock"

mkdir -p "$DATA_DIR"

# 状态写入：json 单行，原子替换。参数：state stage message ok
write_status() {
  local state="$1" stage="$2" message="$3" ok="${4:-true}"
  python3 - "$STATUS_FILE" "$state" "$stage" "$message" "$ok" <<'PY'
import json, sys, time, os
path, state, stage, message, ok = sys.argv[1:6]
try:
    with open(path, encoding='utf-8') as f: d = json.load(f)
except Exception:
    d = {}
d.update(state=state, stage=stage, message=message, ok=(ok == 'true'),
         updatedAt=int(time.time()), pid=os.getpid())
tmp = path + '.tmp'
with open(tmp, 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False)
os.replace(tmp, path)
PY
  # 状态文件由 root 脚本写入，但下次是后端进程（www）来写初始状态；
  # 不把属主改回去，第二次点升级就会 EACCES。
  chown "$RUN_USER":"$RUN_USER" "$STATUS_FILE" 2>/dev/null || true
}

log() {
  echo "[$(date '+%F %T')] $*" >> "$LOG_FILE"
  chown "$RUN_USER":"$RUN_USER" "$LOG_FILE" 2>/dev/null || true
}

# 并发保护：flock -n 拿不到锁就直接退出（前端会看到已在升级中）
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "已有升级任务在运行，本次忽略" >> "$LOG_FILE"
  exit 0
fi

: > "$LOG_FILE"
log "===== 开始升级 ====="
write_status running "准备中" "正在检查更新…"
cd "$APP_DIR" || { write_status error "准备" "源码目录不存在：$APP_DIR" false; exit 1; }
# 升级脚本以 root 运行，而源码目录属主是 www；高版本 Git 会因 dubious ownership 拒绝 pull。
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

# 1. 拉取最新代码
log "git pull --ff-only"
write_status running "拉取代码" "正在拉取最新代码…"
if ! git pull --ff-only >>"$LOG_FILE" 2>&1; then
  log "git pull 失败"
  write_status error "拉取代码" "拉取失败，可能有本地改动冲突，请在服务器手动处理" false
  exit 1
fi
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log "当前提交：$COMMIT"
# root 拉取后 .git 属主可能变 root，后端 www 用户再次执行 git 会被 dubious ownership 拒绝。
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR/.git" 2>/dev/null || true

# 2. 构建前端
log "构建前端"
write_status running "构建前端" "正在构建前端（约 30 秒）…"
if ! (cd "$APP_DIR/web" && npm ci --no-audit --no-fund && npm run build) >>"$LOG_FILE" 2>&1; then
  write_status error "构建前端" "前端构建失败，请查看升级日志" false
  exit 1
fi

# 3. 构建后端
log "构建后端"
write_status running "构建后端" "正在构建后端…"
if ! (cd "$APP_DIR/api" && npm ci --no-audit --no-fund && npm run build) >>"$LOG_FILE" 2>&1; then
  write_status error "构建后端" "后端构建失败，请查看升级日志" false
  exit 1
fi

# 4. 发布前端
log "发布前端到 $WEB_ROOT"
write_status running "发布前端" "正在发布前端文件…"
mkdir -p "$WEB_ROOT"
if ! cp -r "$APP_DIR/web/dist/." "$WEB_ROOT/" >>"$LOG_FILE" 2>&1; then
  write_status error "发布前端" "前端发布失败，请查看升级日志" false
  exit 1
fi
chown -R "$RUN_USER":"$RUN_USER" "$WEB_ROOT" 2>/dev/null || true

# 5. 重启后端（最后一步，重启会让本次 HTTP 连接断开，前端靠轮询感知完成）
log "重启后端服务 $SERVICE（端口 $API_PORT）"
write_status running "重启服务" "正在重启服务，即将完成…"
systemctl restart "$SERVICE" >>"$LOG_FILE" 2>&1 || {
  write_status error "重启服务" "服务重启失败，请查看升级日志" false
  exit 1
}

sleep 2
write_status success "完成" "升级完成，请刷新页面" true
# ok=true 额外写 commit，供前端展示
python3 - "$STATUS_FILE" "$COMMIT" <<'PY'
import json, sys
path, commit = sys.argv[1:3]
try:
    d = json.load(open(path, encoding='utf-8'))
except Exception:
    d = {}
d['commit'] = commit
with open(path + '.tmp', 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False)
import os; os.replace(path + '.tmp', path)
PY
log "===== 升级完成：$COMMIT ====="
exit 0
