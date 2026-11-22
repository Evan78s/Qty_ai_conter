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

### 1. 首次部署（需一台 Linux 服务器，已装 MySQL）

详细步骤见 [`docs/部署与运维手册.md`](docs/部署与运维手册.md) 和 [`docs/阶段1部署清单-照着敲.md`](docs/阶段1部署清单-照着敲.md)。

简述：

```bash
# 1. 传源码到服务器（不要传 .env / data/install.json，这些在服务器本地生成）
# 2. 配置 api/.env（参考 api/.env.example），填入 MySQL 连接与安全密钥
# 3. 用生产模式构建并部署
sudo bash scripts/deploy.sh
# 4. 启动服务
sudo systemctl restart yangyuanhui
```

### 2. Web 安装向导

服务启动后，浏览器访问你的域名，会进入安装向导：配置数据库 → 建表 → 生成密钥 → 创建公司总管理员。完成后即可登录使用。

安装配置保存在服务器本地 `data/install.json`（**不入 git**，升级时不会被覆盖）。

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

当前版本需手动更新源码后重跑 `scripts/deploy.sh`。后台一键升级（连接 GitHub Releases）将在后续版本提供。
