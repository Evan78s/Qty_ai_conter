#!/usr/bin/env bash
# 在线备份 MySQL 系统库 + 密钥与证书 + 品牌 logo 上传目录
# 建议加入 cron：0 2 * * * bash /opt/yangyuanhui/scripts/backup.sh
set -euo pipefail
ROOT="/opt/yangyuanhui"
BK="$ROOT/data/backups"
DATE="$(date +%F)"
mkdir -p "$BK"

# 从 .env 读取数据库凭据（避免命令行明文密码告警）
set -a
source "$ROOT/api/.env"
set +a

# --single-transaction 保证 InnoDB 一致性快照，不锁表
mysqldump --single-transaction --routines --triggers --default-character-set=utf8mb4 \
  -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" "-p$DB_PASSWORD" "$DB_NAME" \
  | gzip -f > "$BK/db_$DATE.sql.gz"

# 周日备份额外保留 3 个月
if [ "$(date +%u)" = "7" ]; then
  cp "$BK/db_$DATE.sql.gz" "$BK/weekly_db_$DATE.sql.gz"
fi

# 密钥与证书、品牌 logo 一并备份（主密钥丢失会导致加密数据不可解）
tar czf "$BK/secrets_$DATE.tar.gz" -C "$ROOT" api/.env 2>/dev/null || true
[ -d "$ROOT/data/uploads" ] && tar czf "$BK/uploads_$DATE.tar.gz" -C "$ROOT/data" uploads 2>/dev/null || true
[ -d /etc/letsencrypt/live ] && tar czf "$BK/certs_$DATE.tar.gz" -C /etc/letsencrypt/live . 2>/dev/null || true

chmod 600 "$BK"/*
# 清理 30 天前普通备份（周备份保留 90 天）
find "$BK" -name 'db_*.sql.gz' -mtime +30 -delete
find "$BK" -name 'weekly_db_*.sql.gz' -mtime +90 -delete
find "$BK" -name 'secrets_*.tar.gz' -mtime +90 -delete

echo "备份完成：$DATE"
