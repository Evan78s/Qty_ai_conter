# 养生馆 AI 增效 · 多媒体推广运营管理工作台

一套系统服务一家公司的所有分店，管理业绩看板、对账、境外投流、自媒体 AI、AI 客服接待等运营工作。多端（手机 / iPad / PC / Mac）通过浏览器登录使用。

> 版本：`v1.0.0` · 作者：Evan安导

## 架构约定（重要）

- **一套系统 = 一家公司 = 一个独立 MySQL 数据库**。其他公司需各自下载、独立部署、接自己的数据库，互不干扰。
- **MySQL 是系统库**：账号、角色、权限、会话、飞书凭证、品牌设置、审计、同步映射。
- **飞书是业务库**：业绩、投流、知识库、AI 回复等业务数据存飞书多维表格，本地不留业务副本（仅允许只读降级快照）。
- **一店一表**：每个分店对应一个飞书多维表格 Base，各自的子表存不同业务数据，由后台管理员绑定。

## 技术栈

- 前端：Vue 3 + Vite + TypeScript + Element Plus + ECharts + Pinia
- 后端：NestJS + TypeScript + Drizzle(MySQL) + mysql2
- 认证：bcrypt + pepper，JWT access（内存）+ refresh（HttpOnly Cookie），首次登录强制改密

## 目录结构

```
api/       后端服务（NestJS）
web/       前端（Vue3）
scripts/   部署与运维脚本
deploy/    systemd 服务文件
docs/      部署与运维手册
index.html 高保真原型（单文件，可直接浏览器打开看效果）
```

## 快速开始

### 1. 首次部署（推荐：Docker 一键安装）

一台 Linux 服务器装好 Docker 后，只需一条命令：

```bash
git clone <你的仓库地址> /opt/qty && cd /opt/qty
bash docker/install.sh
```

脚本问 3 个问题（端口 / 管理员账号 / 密码），然后自动拉起「前端 + 后端 + MySQL」、建表、建管理员、生成密钥，完成即可用。

**详细步骤见 [`docs/Docker一键部署.md`](docs/Docker一键部署.md)**（含私有仓库 SSH key、HTTPS、备份、各端安装）。

> 传统手动部署（宝塔 + 原生 MySQL + systemd）仍保留，见 [`docs/部署与运维手册.md`](docs/部署与运维手册.md)。

### 2. 各端使用（PWA，无需下载 App）

系统内置 PWA：手机/平板用浏览器打开网址后「添加到主屏幕」、电脑用 Chrome/Edge「安装」，即可像原生 App 一样全屏使用，且每次打开都是最新版。配 HTTPS 域名后体验完整。

### 3. 本地开发预览（演示模式）

```bash
cd web
npm install
VITE_DEMO=true npm run dev
```

演示模式使用内置模拟数据，仅供看界面和流程，**不保存任何数据**。账号 `admin` / `demo1234`。

## 安全须知

- `.env`、`data/install.json`、数据库文件**绝不提交到 git**。
- 生产环境的 JWT_SECRET / KEY_ENCRYPTION_KEY / PASSWORD_PEPPER 请用 `openssl rand -hex 32` 生成随机值。
- MySQL 不要开放公网 3306，同机部署填 `127.0.0.1:3306`。

## 升级

```bash
cd /opt/qty
git pull
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
```

数据卷保留，数据不丢。后台一键升级（系统设置里点按钮）将在后续版本提供。

## 目录补充

```
docker/    Docker 一键部署（Dockerfile / compose / install.sh / 配置模板）
web/public/ PWA 资源（manifest / sw.js / 各尺寸图标）
```
