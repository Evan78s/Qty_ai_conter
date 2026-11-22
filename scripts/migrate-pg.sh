#!/usr/bin/env bash
# 【已废弃】v3 时代的 SQLite → PostgreSQL 迁移脚本。
# v4 架构：MySQL 为系统库、飞书为业务库，不再迁 PostgreSQL。
#
# 若需从旧 SQLite 系统库迁移到 v4 MySQL，请使用：
#   cd api && npm run etl
#   （脚本：api/src/scripts/etl-sqlite-to-mysql.ts，通过 ETL_SQLITE_PATH 指定旧库路径）
#
# 业务数据（业绩/投流/知识库/AI回复等）无需迁移——它们以飞书为准，旧库中的副本已在 v4 中移除。
echo "此脚本已废弃。系统库迁移请用: cd api && npm run etl"
exit 0
