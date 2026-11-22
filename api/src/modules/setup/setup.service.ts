/**
 * 安装向导：用户在网页填入 MySQL 连接信息 → 测试 → 一键建库建表 + 初始化超管。
 * 全程用临时连接，不依赖全局 pool；完成后写 install.json 并重建全局连接池。
 */
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { DDL } from '../../db/migrate';
import { runSeed } from '../../db/seed';
import { reconfigure, tempConnection } from '../../db';
import { db, schema } from '../../db';
import { newId } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  isInstalled, writeInstall, generateSecrets, getDbConfig, invalidateConfig,
  type DbConfig,
} from '../../runtime-config';

export interface TestDbDto extends Partial<DbConfig> {
  host?: string; port?: number; user?: string; password?: string; name?: string;
  createDatabase?: boolean;
}
export interface InstallDto extends TestDbDto {
  adminUsername?: string;
  adminPassword?: string;
  adminName?: string;
  platformName?: string;
}

function normalize(cfg: TestDbDto): DbConfig {
  const name = (cfg.name || '').trim();
  if (!cfg.host || !cfg.user || !name) throw new BadRequestException('请填写数据库地址、账号和库名');
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new BadRequestException('库名只能包含字母、数字、下划线');
  return {
    host: cfg.host.trim(),
    port: Number(cfg.port || 3306),
    user: cfg.user.trim(),
    password: cfg.password || '',
    name,
  };
}

@Injectable()
export class SetupService {
  status() {
    const cfg = getDbConfig();
    return {
      installed: isInstalled(),
      configPath: require('../../runtime-config').configFilePath(),
      db: cfg ? { host: cfg.host, port: cfg.port, name: cfg.name, user: cfg.user } : null,
    };
  }

  /** 测试连接：可先不指定库（建库前），再检查建表所需权限。 */
  async testDb(dto: TestDbDto) {
    const cfg = normalize(dto);
    let conn: Awaited<ReturnType<typeof tempConnection>> | null = null;
    try {
      conn = await tempConnection(cfg, !!dto.createDatabase);
      if (dto.createDatabase) {
        // 反引号包裹库名，防注入（normalize 已校验字符）
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await conn.query(`USE \`${cfg.name}\``);
      }
      const [rows] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS user');
      const info = (rows as any[])[0] || {};
      // 检查建表/改表权限（不真的建，读权限列表）
      const [grants] = await conn.query('SHOW GRANTS FOR CURRENT_USER()');
      const grantText = (grants as any[]).map((g: any) => Object.values(g)[0]).join(' ').toUpperCase();
      const canWrite = grantText.includes('ALL PRIVILEGES') || grantText.includes('CREATE') || grantText.includes('GRANT ALL');
      return { ok: true, server: info.version || '', database: info.db || cfg.name, user: info.user || cfg.user, canWrite };
    } catch (e: any) {
      throw new BadRequestException(`连接失败：${e?.message || e}`);
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  }

  /** 一键安装：建表 → 种子 → 超管 → 写配置 → 重连。 */
  async install(dto: InstallDto) {
    if (isInstalled()) throw new ConflictException('系统已完成安装，如需重配请使用系统设置里的数据库管理');
    const cfg = normalize(dto);
    let conn: Awaited<ReturnType<typeof tempConnection>> | null = null;
    try {
      // 1. 连接（含库；库不存在则先建）
      conn = await tempConnection(cfg, false);
      if (dto.createDatabase) {
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      }
      await conn.query(`USE \`${cfg.name}\``);

      // 2. 建表（用临时连接执行，避开全局 pool）
      for (const sql of DDL) await conn.query(sql);

      // 3. 写配置 + 生成密钥 → 让全局 db 指向新库
      const secrets = generateSecrets();
      writeInstall({ installed: true, installedAt: Date.now(), db: cfg, secrets });
      invalidateConfig();
      await reconfigure(cfg);

      // 4. 种子数据（用新 pool）
      await runSeed();

      // 5. 建公司总管理员（bcrypt + pepper，pepper 来自新配置）
      const username = (dto.adminUsername || 'admin').trim();
      const password = dto.adminPassword || require('crypto').randomBytes(9).toString('base64url');
      if (password.length < 8) throw new BadRequestException('管理员密码至少 8 位');
      const exists = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
      if (exists.length) throw new ConflictException(`账号 ${username} 已存在`);
      const hash = await bcrypt.hash(password + secrets.passwordPepper, 12);
      await db.insert(schema.users).values({
        id: newId('usr'), tenantId: null, username,
        displayName: (dto.adminName || '总管理员').trim(),
        passwordHash: hash, roleCode: 'super_admin', mustChangePassword: true,
        createdAt: Date.now(),
      });

      // 6. 平台名（可选）
      if (dto.platformName) {
        const setting = (await db.select().from(schema.platformSettings).limit(1))[0];
        if (setting) await db.update(schema.platformSettings).set({ platformName: dto.platformName.trim(), updatedAt: Date.now() }).where(eq(schema.platformSettings.id, setting.id));
      }

      return {
        ok: true,
        admin: { username, password, mustChangePassword: true },
        db: { host: cfg.host, port: cfg.port, name: cfg.name },
      };
    } catch (e: any) {
      // 安装失败：回滚配置文件，避免留下半装状态
      try { writeInstall({ installed: false, installedAt: 0, db: cfg, secrets: { jwtSecret: '', keyEncryptionKey: '', passwordPepper: '' } }); } catch { /* ignore */ }
      throw new BadRequestException(`安装失败：${e?.message || e}`);
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  }
}
