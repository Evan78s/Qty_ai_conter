#!/usr/bin/env bash
# 首次创建平台总管理员（生成随机强密码，只打印一次）
set -euo pipefail
cd /opt/yangyuanhui/api
set -a
source .env
set +a
node dist/scripts/bootstrap-admin.js --username "${1:-admin}" --name "平台总管理员"
