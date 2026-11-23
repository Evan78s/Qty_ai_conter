# 鵲太醫 · 养生馆 AI 运营工作台（连锁店版）

面向**连锁养生馆**的多分店运营管理系统：一套系统管理旗下所有分店，覆盖业绩看板、对账、境外投流、自媒体 AI、AI 客服接待等工作。多端（手机 / iPad / PC / Mac）通过浏览器登录使用。

> 版本：`v1.1.1` · 版本类型：**连锁店版** · 作者：Evan安导

## 架构约定（重要）

- **本系统为连锁店版**：一套系统 = 一家连锁企业 = 一个独立 MySQL 数据库，管理这家企业的所有分店。其他企业如需使用，需各自下载、独立部署、接自己的数据库，互不干扰。
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

## 一键部署（复制这一行到服务器，回车即可）

> 前提：Linux 服务器（CentOS / Ubuntu / 宝塔环境均可，内存 ≥ 2G），域名已解析到本机。

```bash
curl -fsSL https://raw.githubusercontent.com/Evan78s/Qty_ai_conter/master/docker/boot.sh -o /tmp/qty-boot.sh && sudo bash /tmp/qty-boot.sh
```

这一行会自动完成：**装 Docker → 拉源码 → 问你 3 个问题（端口 / 管理员账号 / 密码）→ 起 MySQL+后端+前端 → 建表建管理员 → 输出网址和账号密码**。全程不用手动建库、不用配 Nginx。

> 🌐 **服务器 80 端口已被宝塔/Nginx 占用？** 不用停宝塔，指定一个空闲端口即可：`sudo HTTP_PORT=8080 bash /tmp/qty-boot.sh`（安装后访问 `http://IP:8080`）。安装中途失败也能用同样命令续装，密码和数据库配置会复用，不会重新生成。

> 🔑 **密码输不了数字或特殊字符**：改用环境变量把密码写进命令（单引号包住），例如 `sudo ADMIN_PASSWORD='你的密码' bash /tmp/qty-boot.sh`；或直接交互输入（密码可见）。详见 [`docs/Docker一键部署.md`](docs/Docker一键部署.md)。

> **私有仓库注意**：上面这条纯链接命令要求仓库为**公开**（代码无敏感信息，`install.json`、`.env` 均未入库）。若保持私有，需先到 GitHub 仓库 Settings → General → 最底部 Danger Zone → **Change visibility → Public**，然后再复制执行。
> 若必须保持私有，则改用带只读令牌的方式（见 [`docs/Docker一键部署.md`](docs/Docker一键部署.md) 的「私有仓库」小节）。

**详细步骤见 [`docs/Docker一键部署.md`](docs/Docker一键部署.md)**（含私有仓库令牌、HTTPS、备份、各端安装）。

> **不用 Docker 也行**：用「网站目录部署」把前端直接发布到网站目录、后端由 systemd 守护，域名和 SSL 交给宝塔。见 [`docs/网站目录部署-宝塔.md`](docs/网站目录部署-宝塔.md)。

> 传统手动部署（原生 MySQL + systemd）仍保留，见 [`docs/部署与运维手册.md`](docs/部署与运维手册.md)。

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
cd /www/docker/qtyai
git pull
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
```

数据卷保留，数据不丢。后台一键升级（系统设置里点按钮）将在后续版本提供。

## 目录补充

```
docker/    Docker 一键部署（Dockerfile / compose / install.sh / 配置模板）
web/public/ PWA 资源（manifest / sw.js / 各尺寸图标）
```
