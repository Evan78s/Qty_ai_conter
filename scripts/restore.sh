#!/usr/bin/env bash
# 恢复 MySQL 备份（演练或故障恢复）。用法：sudo bash restore.sh db_2026-11-21.sql.gz
# 警告：会覆盖当前数据库，执行前请先备份现状。
set -euo pipefail
ROOT="/opt/yangyuanhui"
FILE="${1:?请指定备份文件名，如 db_2026-11-21.sql.gz}"
SRC="$ROOT/data/backups/$FILE"
[ -f "$SRC" ] || { echo "备份不存在：$SRC"; exit 1; }

set -a
source "$ROOT/api/.env"
set +a

read -r -p "将覆盖数据库 $DB_NAME，确认恢复？输入 yes 继续: " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "已取消"; exit 0; }

# 先对当前库做一次保全备份
mysqldump --single-transaction --routines --triggers -h "$DB_HOST" -P "${DB_PORT:-3306}" \
  -u "$DB_USER" "-p$DB_PASSWORD" "$DB_NAME" | gzip -f > "$ROOT/data/backups/pre_restore_$(date +%s).sql.gz"

systemctl stop yangyuanhui || true

# 导入备份
gunzip -c "$SRC" | mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" "-p$DB_PASSWORD" "$DB_NAME"

# 完整性校验：核心表可查询
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" "-p$DB_PASSWORD" "$DB_NAME" \
  -e "CHECK TABLE users, stores, sessions, tenants, sync_mappings;" >/dev/null

systemctl start yangyuanhui
echo "恢复完成：$FILE"
