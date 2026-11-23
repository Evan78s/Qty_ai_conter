/**
 * 运行时配置层：安装向导写入的配置存 data/install.json，立即生效、重启后保持。
 * 读取优先级：install.json > process.env > 内置默认值。
 * 目的：用户开好 MySQL 后在网页后台填入即可一键连接建表，无需手改 .env。
 */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

export interface DbConfig {
  host: string; port: number; user: string; password: string; name: string;
}
export interface InstallConfig {
  installed: boolean;
  installedAt: number;
  db: DbConfig;
  secrets: {
    jwtSecret: string;
    keyEncryptionKey: string;
    passwordPepper: string;
  };
}

const CONFIG_PATH = process.env.INSTALL_CONFIG_PATH
  ? path.resolve(process.env.INSTALL_CONFIG_PATH)
  : path.resolve(process.cwd(), 'data', 'install.json');

let cached: InstallConfig | null | undefined;

/** 读取安装配置；文件不存在返回 null。 */
export function readInstall(): InstallConfig | null {
  if (cached !== undefined) return cached;
  try {
    if (!fs.existsSync(CONFIG_PATH)) { cached = null; return null; }
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    cached = parsed && parsed.installed ? parsed as InstallConfig : null;
  } catch { cached = null; }
  return cached;
}

export function isInstalled(): boolean {
  return readInstall() !== null;
}

/** 写安装配置（原子写），并刷新缓存。 */
export function writeInstall(cfg: InstallConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, CONFIG_PATH);
  cached = cfg;
}

export function configFilePath(): string { return CONFIG_PATH; }

/** 统一密钥读取：install.json > env > 默认（仅开发兜底）。 */
export function getSecret(name: 'jwtSecret' | 'keyEncryptionKey' | 'passwordPepper'): string {
  const inst = readInstall();
  if (inst?.secrets?.[name]) return inst.secrets[name];
  if (name === 'jwtSecret') return process.env.JWT_SECRET || 'dev-only-secret-change-me-32bytes-min';
  if (name === 'keyEncryptionKey') return process.env.KEY_ENCRYPTION_KEY || '';
  return process.env.PASSWORD_PEPPER || '';
}

/** 统一 DB 配置读取：install.json > env。未安装返回 null。 */
export function getDbConfig(): DbConfig | null {
  const inst = readInstall();
  if (inst?.db) return inst.db;
  if (process.env.DB_NAME) {
    return {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'quetaiyiai',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME,
    };
  }
  return null;
}

/** 生成安装所需的随机密钥。 */
export function generateSecrets(): InstallConfig['secrets'] {
  return {
    jwtSecret: randomBytes(32).toString('hex'),
    keyEncryptionKey: randomBytes(32).toString('hex'),
    passwordPepper: randomBytes(24).toString('base64url'),
  };
}

/** 清除缓存（安装/重配后调用，强制重读）。 */
export function invalidateConfig(): void { cached = undefined; }
