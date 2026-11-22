/**
 * 数据库单一出口：所有业务代码只从这里取 db，MySQL 系统库。
 * 支持安装向导：未安装时用占位配置（不实际连接），安装完成调用 reconfigure() 重建连接池。
 */
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';
import { getDbConfig, type DbConfig } from '../runtime-config';

function buildPool(cfg: DbConfig) {
  return mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.name,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
    queueLimit: 0,
    timezone: '+08:00',
  });
}

// 未安装时占位配置——createPool 是懒连接，不会立即连库，应用可正常启动进入安装向导。
const initial = getDbConfig() || { host: '127.0.0.1', port: 3306, user: '', password: '', name: '' };
export let pool = buildPool(initial);
export let db = drizzle(pool, { schema, mode: 'default' } as any);
export { schema };
export type DB = typeof db;

/** 用临时配置建一个一次性连接（安装向导测试连接/建库用），用完即关。 */
export async function tempConnection(cfg: DbConfig, includeDatabase = true) {
  return mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    ...(includeDatabase ? { database: cfg.name } : {}),
    charset: 'utf8mb4', timezone: '+08:00',
  });
}

/** 安装完成/重配后重建全局连接池，让新配置立即生效。 */
export async function reconfigure(cfg: DbConfig) {
  const old = pool;
  pool = buildPool(cfg);
  db = drizzle(pool, { schema, mode: 'default' } as any);
  try { await old.end(); } catch { /* ignore */ }
}

/** 关闭连接池（脚本收尾用）。 */
export async function closeDb() {
  await pool.end();
}
