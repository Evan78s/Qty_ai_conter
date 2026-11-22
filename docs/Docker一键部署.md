# 鵲太醫 AI 运营工作台 · Docker 一键部署（最简单）

> 一整套系统（前端 + 后端 + MySQL）打包成 Docker 容器，**一条命令全自动安装**。
> 不用手动建库、不用配 Nginx、不用配 systemd。数据库和密钥自动持久化，升级不影响数据。

---

## 前提（只做一次）

服务器需要 Docker。如果没有，先装：

```bash
curl -fsSL https://get.docker.com | bash
```

确认装好：

```bash
docker -v && docker compose version
```

> 系统：任何 Linux（CentOS / Ubuntu / 宝塔环境均可）。内存建议 ≥ 2G。

---

## 安装（一条命令）

### 1. 拉代码（私有仓库）

在服务器上生成一把只读 key（如果之前装过就跳过）：

```bash
ssh-keygen -t ed25519 -C "server-deploy" -f ~/.ssh/qty_ai_deploy -N ""
cat ~/.ssh/qty_ai_deploy.pub
```

把输出的公钥加到 GitHub 仓库 → Settings → Deploy keys → Add key（**不勾** Allow write access）。然后：

```bash
cat >> ~/.ssh/config <<'EOF'
Host qty-github
  HostName github.com
  User git
  IdentityFile ~/.ssh/qty_ai_deploy
EOF
chmod 600 ~/.ssh/config

git clone qty-github:Evan78s/Qty_ai_conter.git /opt/qty
cd /opt/qty
```

### 2. 一键安装

```bash
bash docker/install.sh
```

脚本会问你 3 个问题：

1. **对外端口**（默认 80，直接回车）
2. **管理员账号**（默认 admin）
3. **管理员密码**（≥8 位，留空自动随机生成）

然后它自动完成：生成随机数据库密码 → 写配置 → 拉起 MySQL + 后端 + 前端容器 → 建表 → 创建管理员 → 输出访问地址和账号密码。

**看到这个就算装好了：**

```
============================================
  安装完成！
  访问地址：http://服务器IP:80
  管理员：admin
  密码：xxxx
============================================
```

浏览器打开 `http://服务器IP` 即可登录（首次会强制改密）。

> 🔴 **立刻保存管理员密码**。密码也存在 `/opt/qty/docker/.env`，请妥善保管，别外传。

---

## 各端使用（PWA，无需下载 App）

系统已内置 PWA，客户不用去应用商店、不用下载安装包：

| 设备 | 操作 |
|---|---|
| **安卓手机** | Chrome 打开网址 → 菜单 → 「添加到主屏幕 / 安装应用」，桌面出现图标，点开全屏使用 |
| **iPhone/iPad** | Safari 打开网址 → 分享按钮 → 「添加到主屏幕」 |
| **电脑（Win/Mac）** | Chrome/Edge 地址栏右侧的「安装」图标 → 安装，桌面/程序坞出现图标 |

装完后就像原生 App：独立窗口、全屏、有图标，且**每次打开都是最新版**（升级无需客户更新）。

> ⚠️ PWA 的"安装"功能需要 **HTTPS**（或 localhost）。用 IP + HTTP 访问时可直接用网页，但浏览器可能不显示"安装"选项。要完整体验请配域名 + HTTPS（见下一节）。

---

## 配 HTTPS（推荐，PWA 完整功能需要）

有域名的话，装一个 Caddy 自动反代 + 免费证书，最简单：

```bash
# 在服务器上装 Caddy（或用宝塔的反代/证书功能）
# 把 80 端口让给 Caddy，把 docker 的 HTTP_PORT 改成 8080
cd /opt/qty
sed -i 's/^HTTP_PORT=.*/HTTP_PORT=8080/' docker/.env
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d

# Caddy 配置（/etc/caddy/Caddyfile）：
# 你的域名 {
#     reverse_proxy 127.0.0.1:8080
# }
systemctl reload caddy
```

Caddy 会自动申请和续期 Let's Encrypt 证书。之后 `https://你的域名` 访问，各端都能"安装到主屏幕"。

> 用宝塔的话，也可以用「网站 → 反代」+「SSL 申请 Let's Encrypt」，把请求反代到 `127.0.0.1:8080`，效果一样。

---

## 日常运维

```bash
cd /opt/qty

# 查看状态
docker compose -f docker/docker-compose.yml ps

# 重启
docker compose -f docker/docker-compose.yml restart

# 看日志
docker compose -f docker/docker-compose.yml logs -f api

# 手动备份（系统库 + install.json 密钥）
docker exec qty-mysql mysqldump -uroot -p$(grep MYSQL_ROOT_PASSWORD docker/.env | cut -d= -f2) yangyuanhui > backup_$(date +%F).sql
docker cp qty-api:/app/data/install.json install.json.bak_$(date +%F)

# 定时备份（每天凌晨2点）
crontab -e
# 0 2 * * * cd /opt/qty && docker exec qty-mysql mysqldump -uroot -p$(grep MYSQL_ROOT_PASSWORD docker/.env | cut -d= -f2) yangyuanhui | gzip > /opt/qty/backup_$(date +\%F).sql.gz
```

---

## 升级到新版本

以后我发布新版后，你只需：

```bash
cd /opt/qty
git pull
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --build
```

数据卷（MySQL 数据 + install.json）会保留，**数据不丢**。前端 SW 不缓存旧版，客户刷新即最新。

> 后台一键升级（在系统设置里点按钮自动完成上面几步）将在后续版本提供。

---

## 数据存在哪（都在卷里，删容器不丢）

| 数据 | 位置 |
|---|---|
| MySQL 系统库 | Docker 卷 `mysql-data` |
| 安装配置 + 密钥 | Docker 卷 `api-data` → `/app/data/install.json` |
| 飞书凭证 / 品牌 / 审计 | 都在上面的 MySQL 库里 |

⚠️ 备份时**必须包含 `install.json`**——里面的 3 个密钥丢失后所有加密数据无法解开，不可逆。

---

## 常见问题

| 现象 | 排查 |
|---|---|
| `install.sh` 提示无 Docker | 先执行前提里的安装命令 |
| 拉代码 Permission denied | Deploy key 没加或没生效；`ssh -T qty-github` 重测 |
| 端口 80 被占用 | 安装时改端口（如 8080），浏览器访问 `http://IP:8080` |
| 初始化失败 | `docker compose -f docker/docker-compose.yml logs api` 看日志 |
| 打不开网页 | `docker compose -f docker/docker-compose.yml ps` 确认 web 容器在跑 |
| 忘记管理员密码 | 见 `docker/.env` 的 ADMIN_PASSWORD；还没有就需删卷重装（会丢数据） |
| 各端没有"安装"选项 | 用 HTTPS 域名访问（HTTP+IP 浏览器不给装） |
