/**
 * 一次性 ETL：SQLite(旧系统库) → MySQL(v4 系统库)
 *
 * 规则：
 *  - 建默认租户，旧 stores 归入该租户
 *  - users 迁 passwordHash 原样（用户无感），绑 tenant_id，super_admin→平台超管(tenant_id=null)
 *  - roles/ai_scenes 由 seed 重建，这里不迁
 *  - sessions 不迁（全员强制重新登录）
 *  - audit_logs 可选迁（默认迁）
 *  - 业务表(performance/dsp_insights/...)不迁——它们已在飞书，不在本地库
 *
 * 用法：配置好 .env（MySQL 目标）与 ETL_SQLITE_PATH（旧库路径，默认 ./data/app.db）后：
 *   npm run etl
 */
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { randomBytes } from 'crypto';

const sqlitePath = process.env.ETL_SQLITE_PATH || './data/app.db';
const hash = (s: string) => Buffer.from(s).toString('base64url');

async function main() {
  const src = new Database(sqlitePath, { readonly: true });
  const dst = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'yyh',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yangyuanhui',
    charset: 'utf8mb4',
  });

  const now = Date.now();
  const tenantId = 'ten_default_etl';

  try {
    // 1. 默认租户
    await dst.execute(
      'INSERT IGNORE INTO tenants (id,name,code,status,created_at) VALUES (?,?,?,?,?)',
      [tenantId, '默认租户', 'default', 'active', now],
    );

    // 2. 门店（带 tenant_id）
    const oldStores = src.prepare('SELECT * FROM stores').all() as any[];
    for (const s of oldStores) {
      await dst.execute(
        'INSERT IGNORE INTO stores (id,tenant_id,name,address,manager_name,staff_count,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [s.id, tenantId, s.name, s.address || '', s.manager_name || '', Number(s.staff_count) || 0, s.status || 'active', Number(s.created_at) || now],
      );
    }
    console.log(`[etl] 门店 ${oldStores.length} 条`);

    // 3. 用户（passwordHash 原样；super_admin 升为平台超管 tenant_id=null）
    const oldUsers = src.prepare('SELECT * FROM users').all() as any[];
    for (const u of oldUsers) {
      const isSuper = u.role_code === 'super_admin';
      await dst.execute(
        'INSERT IGNORE INTO users (id,tenant_id,username,display_name,phone,password_hash,role_code,status,must_change_password,last_login_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [u.id, isSuper ? null : tenantId, u.username, u.display_name, u.phone || '', u.password_hash, u.role_code, u.status || 'active', Number(u.must_change_password) || 0, u.last_login_at || null, Number(u.created_at) || now],
      );
    }
    console.log(`[etl] 用户 ${oldUsers.length} 条（密码哈希原样迁移）`);

    // 4. user_stores（带 tenant_id）
    try {
      const oldLinks = src.prepare('SELECT * FROM user_stores').all() as any[];
      for (const l of oldLinks) {
        await dst.execute(
          'INSERT IGNORE INTO user_stores (id,tenant_id,user_id,store_id,role_code,created_at) VALUES (?,?,?,?,?,?)',
          [l.id || `us_${hash(`${l.user_id}${l.store_id}`)}`, tenantId, l.user_id, l.store_id, l.role_code, Number(l.created_at) || now],
        );
      }
      console.log(`[etl] 用户-门店关联 ${oldLinks.length} 条`);
    } catch { /* 旧表可能无此表，忽略 */ }

    // 5. 审计日志（可选）
    try {
      const oldAudit = src.prepare('SELECT * FROM audit_logs').all() as any[];
      for (const a of oldAudit) {
        await dst.execute(
          'INSERT IGNORE INTO audit_logs (id,tenant_id,user_id,store_id,action,module,target_id,result,ip,user_agent,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [a.id, tenantId, a.user_id || null, a.store_id || null, a.action, a.module || '', a.target_id || null, a.result || 'success', a.ip || '', a.user_agent || '', Number(a.created_at) || now],
        );
      }
      console.log(`[etl] 审计 ${oldAudit.length} 条`);
    } catch { /* 忽略 */ }

    console.log('\n[etl] 完成。sessions 未迁移，全员需重新登录。roles/ai_scenes/品牌设置请运行 seed。');
    console.log('[etl] 业务数据未迁移——它们以飞书为准，无需从 SQLite 搬迁。');
  } finally {
    src.close();
    await dst.end();
  }
}

main().catch((err) => {
  console.error('[etl] 失败:', err?.message || err);
  process.exit(1);
});
