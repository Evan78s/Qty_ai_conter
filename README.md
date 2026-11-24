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
scripts/   部署与运维脚本（含 web-deploy.sh 网站目录部署）
docker/    Docker 一键部署（Dockerfile / compose / install.sh）
deploy/    systemd 服务文件
docs/      部署与运维手册
index.html 高保真原型（单文件，可直接浏览器打开看效果）
```

---

## 部署：两种方式任选其一

> 前提（两种方式通用）：Linux 服务器（CentOS / Ubuntu / 宝塔环境均可，内存 ≥ 2G），域名已解析到本机，仓库为公开。
>
> **两种方式都完整可用，选一种即可，不要混用**：它们各自初始化数据库，数据不通用。

### 方案一：网站目录部署（不用 Docker，宝塔环境推荐）

前端直接发布到网站目录，后端由 systemd 守护，域名 / SSL 交给宝塔。适合已经用宝塔建好站点、想"域名指向网站目录就能用"的场景。

```bash
curl -fsSL https://raw.githubusercontent.com/Evan78s/Qty_ai_conter/master/scripts/web-deploy.sh -o /tmp/qty-web-deploy.sh && sudo bash /tmp/qty-web-deploy.sh
```

脚本自动完成：**装 Node → 拉源码 → 构建前后端 → 前端放进网站目录 → 启动后端服务（systemd）**。默认网站目录 `/www/wwwroot/quetaiyiai`，可用 `QTY_WEB_ROOT=/你的/目录` 覆盖。

跑完后在宝塔做 3 件事：**建数据库**（库名/用户名 `quetaiyiai`）→ **加 `/api/` 反代和伪静态** → 打开 `https://你的域名/setup` 填数据库信息一键安装。完整步骤见 [`docs/网站目录部署-宝塔.md`](docs/网站目录部署-宝塔.md)。

### 方案二：Docker 一键部署（一条命令全自动）

把前端 + 后端 + MySQL 打包成容器，**不用手动建库、不用配 Nginx**。

```bash
curl -fsSL https://raw.githubusercontent.com/Evan78s/Qty_ai_conter/master/docker/boot.sh -o /tmp/qty-boot.sh && sudo bash /tmp/qty-boot.sh
```

这一行自动完成：**装 Docker → 拉源码 → 问你 3 个问题（端口 / 管理员账号 / 密码）→ 起 MySQL+后端+前端 → 建表建管理员 → 输出网址和账号密码**。

> 🌐 **80 端口被宝塔/Nginx 占用？** 不用停宝塔，指定空闲端口：`sudo HTTP_PORT=8080 bash /tmp/qty-boot.sh`（访问 `http://IP:8080`）。中途失败也能用同样命令续装，密码和数据库配置会复用，不会重新生成。
>
> 🔑 **密码输不了数字或特殊字符？** 用环境变量写进命令（单引号包住），例如 `sudo ADMIN_PASSWORD='你的密码' bash /tmp/qty-boot.sh`；或直接交互输入（密码可见）。

完整步骤（私有仓库令牌、HTTPS、备份、续装）见 [`docs/Docker一键部署.md`](docs/Docker一键部署.md)。

> **私有仓库注意**：上面纯链接命令要求仓库为**公开**（代码无敏感信息，`install.json`、`.env` 均未入库）。若保持私有，改用带只读令牌的方式（见 Docker 文档的「私有仓库」小节）。

> 传统手动部署（原生 MySQL + systemd，旧方案）仍保留，见 [`docs/部署与运维手册.md`](docs/部署与运维手册.md)。

---

## 各端使用（PWA，无需下载 App）

系统内置 PWA：手机/平板用浏览器打开网址后「添加到主屏幕」、电脑用 Chrome/Edge「安装」，即可像原生 App 一样全屏使用，且每次打开都是最新版。配 HTTPS 域名后体验完整。

## 本地开发预览（演示模式）

```bash
cd web
npm install
VITE_DEMO=true npm run dev
```

演示模式使用内置模拟数据，仅供看界面和流程，**不保存任何数据**。账号 `admin` / `demo1234`。

## 安全须知

- `.env`、`data/install.json`、数据库文件**绝不提交到 git**。
- 生产环境的 JWT_SECRET / KEY_ENCRYPTION_KEY / PASSWORD_PEPPER 请用 `openssl rand -hex 32` 生成随机值（网页安装向导会自动生成）。
- MySQL 不要开放公网 3306，同机部署填 `127.0.0.1:3306`。

## 升级

按当初选用的部署方式对应执行，数据都会保留：

**网站目录部署：**
```bash
curl -fsSL https://raw.githubusercontent.com/Evan78s/Qty_ai_conter/master/scripts/web-deploy.sh -o /tmp/qty-web-deploy.sh && sudo QTY_API_PORT=3100 bash /tmp/qty-web-deploy.sh
```
（端口按你实际的填；脚本会自动 `git pull`，无需手动执行。这条也会顺带安装后台一键升级组件。）

**Docker 部署：**
```bash
cd /www/docker/qtyai && git pull && docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
```

数据卷 / 数据库 / `install.json` 都保留，数据不丢。

**后台一键升级（推荐，网站目录版）：** 总管理员登录后台 → **系统设置 → 系统升级**，点「一键升级」即可，进度实时可见，不用登录服务器。首次使用需先重跑一次网站目录部署脚本以安装升级组件，详见 [`docs/后台一键升级.md`](docs/后台一键升级.md)。Docker 版暂不支持后台按钮升级，用上面的命令行。
