/**
 * 建表迁移（幂等，可重复执行）——MySQL 系统库。
 * 只建系统表：租户/角色/门店/用户/会话/AI配置/集成/品牌/同步映射/审计。
 * 业务数据（业绩/投流/知识库/AI回复等）在飞书，本地不建表。
 */
import { pool, closeDb } from './index';

export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    contact_name VARCHAR(64) NOT NULL DEFAULT '',
    phone VARCHAR(32) NOT NULL DEFAULT '',
    remark TEXT NULL,
    plan VARCHAR(32) NOT NULL DEFAULT 'standard',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(48) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    permissions TEXT NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    address VARCHAR(255) NOT NULL DEFAULT '',
    manager_name VARCHAR(64) NOT NULL DEFAULT '',
    staff_count INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL,
    INDEX idx_store_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    phone VARCHAR(32) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    role_code VARCHAR(48) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    must_change_password TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at BIGINT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_user_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS user_stores (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    store_id VARCHAR(36) NOT NULL,
    role_code VARCHAR(48) NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uniq_user_store (user_id, store_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NOT NULL,
    refresh_hash VARCHAR(64) NOT NULL UNIQUE,
    family_id VARCHAR(36) NOT NULL,
    device_id VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    expires_at BIGINT NOT NULL,
    revoked_at BIGINT NULL,
    created_at BIGINT NOT NULL,
    INDEX idx_session_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS ai_configs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    scope VARCHAR(16) NOT NULL,
    scope_id VARCHAR(36) NOT NULL DEFAULT '',
    provider VARCHAR(32) NOT NULL,
    base_url VARCHAR(255) NOT NULL DEFAULT '',
    model VARCHAR(64) NOT NULL DEFAULT '',
    api_key_enc TEXT NULL,
    temperature VARCHAR(16) NOT NULL DEFAULT '0.3',
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    INDEX idx_aicfg_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS ai_scenes (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    scene_code VARCHAR(48) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL,
    config_id VARCHAR(36) NULL,
    model_override VARCHAR(64) NOT NULL DEFAULT '',
    temperature VARCHAR(16) NOT NULL DEFAULT '0.3',
    system_prompt TEXT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS integrations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    type VARCHAR(32) NOT NULL,
    scope VARCHAR(16) NOT NULL DEFAULT 'tenant',
    app_id VARCHAR(128) NOT NULL DEFAULT '',
    account_id VARCHAR(128) NOT NULL DEFAULT '',
    credentials_enc TEXT NULL,
    token_expires_at BIGINT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL,
    INDEX idx_integration_tenant_type (tenant_id, type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    id VARCHAR(36) PRIMARY KEY,
    platform_name VARCHAR(128) NOT NULL DEFAULT '鵲太醫',
    logo_url VARCHAR(255) NOT NULL DEFAULT '/logo.ico',
    logo_text VARCHAR(16) NOT NULL DEFAULT '鵲',
    subtitle VARCHAR(128) NOT NULL DEFAULT 'AI OPERATION HUB',
    default_feishu_config TEXT NULL,
    updated_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS store_feishu_bindings (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    store_id VARCHAR(36) NOT NULL,
    app_token VARCHAR(64) NOT NULL DEFAULT '',
    base_url VARCHAR(255) NOT NULL DEFAULT '',
    table_ids TEXT NULL,
    credential_id VARCHAR(36) NULL,
    owner_name VARCHAR(64) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    last_check_at BIGINT NULL,
    last_error TEXT NULL,
    updated_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uniq_bind_store (store_id),
    INDEX idx_bind_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS sync_mappings (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    store_id VARCHAR(36) NOT NULL,
    biz_type VARCHAR(32) NOT NULL,
    biz_key VARCHAR(128) NOT NULL,
    feishu_app_token VARCHAR(64) NOT NULL DEFAULT '',
    feishu_table_id VARCHAR(64) NOT NULL DEFAULT '',
    feishu_record_id VARCHAR(64) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'synced',
    content_hash VARCHAR(64) NOT NULL DEFAULT '',
    snapshot_json TEXT NULL,
    last_synced_at BIGINT NULL,
    last_error TEXT NULL,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uniq_sync_biz (store_id, biz_type, biz_key),
    INDEX idx_sync_store_biz (store_id, biz_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    user_id VARCHAR(36) NULL,
    store_id VARCHAR(36) NULL,
    action VARCHAR(64) NOT NULL,
    module VARCHAR(48) NOT NULL DEFAULT '',
    target_id VARCHAR(36) NULL,
    result VARCHAR(16) NOT NULL DEFAULT 'success',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    INDEX idx_audit_time (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // 通用业务记录表：承载各功能模块的本地真实数据（知识库/对账/价目/素材/客服/投流/自媒体等）。
  // payload 存该类型专属字段的 JSON；biz_type 区分模块；store_id 支持门店隔离（'' = 公司级）。
  `CREATE TABLE IF NOT EXISTS biz_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NULL,
    store_id VARCHAR(36) NOT NULL DEFAULT '',
    biz_type VARCHAR(48) NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    payload TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    INDEX idx_biz_type_store (biz_type, store_id),
    INDEX idx_biz_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

/**
 * 增量升级：给「已存在的旧库」补列/补索引。
 * CREATE TABLE IF NOT EXISTS 对已存在的表会静默跳过，新增列不会生效，
 * 因此这里通过 information_schema 判断列/索引是否存在，不存在才 ALTER（幂等）。
 * 全新安装时 DDL 已含全部列，这些检查会全部命中「已存在」而跳过，行为一致。
 */
type ColumnUpgrade = { table: string; column: string; ddl: string };
type IndexUpgrade = { table: string; index: string; ddl: string };

const COLUMN_UPGRADES: ColumnUpgrade[] = [
  // v2 (阶段2): 租户运营字段
  { table: 'tenants', column: 'contact_name', ddl: "ALTER TABLE tenants ADD COLUMN contact_name VARCHAR(64) NOT NULL DEFAULT '' AFTER code" },
  { table: 'tenants', column: 'phone', ddl: "ALTER TABLE tenants ADD COLUMN phone VARCHAR(32) NOT NULL DEFAULT '' AFTER contact_name" },
  { table: 'tenants', column: 'remark', ddl: 'ALTER TABLE tenants ADD COLUMN remark TEXT NULL AFTER phone' },
  { table: 'tenants', column: 'plan', ddl: "ALTER TABLE tenants ADD COLUMN plan VARCHAR(32) NOT NULL DEFAULT 'standard' AFTER remark" },
  // 存量索引补齐（老库可能缺）
  { table: 'sessions', column: 'tenant_id', ddl: "ALTER TABLE sessions ADD COLUMN tenant_id VARCHAR(36) NULL AFTER id" },
  { table: 'audit_logs', column: 'tenant_id', ddl: "ALTER TABLE audit_logs ADD COLUMN tenant_id VARCHAR(36) NULL AFTER id" },
  // Agent Skill：管理员统一配置的场景提示词
  { table: 'ai_scenes', column: 'system_prompt', ddl: 'ALTER TABLE ai_scenes ADD COLUMN system_prompt TEXT NULL AFTER temperature' },
];

const INDEX_UPGRADES: IndexUpgrade[] = [
  { table: 'sessions', index: 'idx_session_tenant', ddl: 'CREATE INDEX idx_session_tenant ON sessions (tenant_id)' },
  { table: 'audit_logs', index: 'idx_audit_tenant', ddl: 'CREATE INDEX idx_audit_tenant ON audit_logs (tenant_id)' },
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const dbName = process.env.DB_NAME || '';
  const [rows]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',
    [dbName, table, column],
  );
  return Number(rows?.[0]?.n || 0) > 0;
}

async function indexExists(table: string, index: string): Promise<boolean> {
  const dbName = process.env.DB_NAME || '';
  const [rows]: any = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?',
    [dbName, table, index],
  );
  return Number(rows?.[0]?.n || 0) > 0;
}

async function ensureSchemaVersionTable(): Promise<void> {
  await pool.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(32) PRIMARY KEY,
    description VARCHAR(255) NOT NULL DEFAULT '',
    applied_at BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function markVersion(version: string, description: string): Promise<void> {
  await pool.execute(
    'INSERT IGNORE INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)',
    [version, description, Date.now()],
  );
}

async function versionApplied(version: string): Promise<boolean> {
  const [rows]: any = await pool.query('SELECT COUNT(*) AS n FROM schema_migrations WHERE version=?', [version]);
  return Number(rows?.[0]?.n || 0) > 0;
}

/** 可被安装向导复用的建表 + 增量升级函数；不在此处关闭连接。 */
export async function runMigrate(): Promise<void> {
  // 1) 全新安装：建全部系统表（已存在则跳过）
  for (const sql of DDL) {
    await pool.execute(sql);
  }
  // 2) 版本表
  await ensureSchemaVersionTable();
  // 3) 增量升级：逐列/逐索引检查，缺什么补什么（幂等，可重复执行）
  for (const up of COLUMN_UPGRADES) {
    if (!(await columnExists(up.table, up.column))) {
      try {
        await pool.execute(up.ddl);
        console.log(`[migrate] 补列 ${up.table}.${up.column}`);
      } catch (e: any) {
        // 忽略「列已存在」竞态错误，其它错误抛出
        if (!/Duplicate column/i.test(e?.message || '')) throw e;
      }
    }
  }
  for (const up of INDEX_UPGRADES) {
    if (!(await indexExists(up.table, up.index))) {
      try {
        await pool.execute(up.ddl);
        console.log(`[migrate] 补索引 ${up.table}.${up.index}`);
      } catch (e: any) {
        if (!/Duplicate key name/i.test(e?.message || '')) throw e;
      }
    }
  }
  await markVersion('2.0.0', '阶段2：多租户运营字段与索引补齐');
}

/** 独立脚本入口：tsx src/db/migrate.ts */
if (require.main === module) {
  runMigrate().then(async () => {
    console.log(`[migrate] ${DDL.length} 张系统表 + 增量升级已就绪（幂等）`);
    await closeDb();
  }).catch(async (err) => {
    console.error('[migrate] 失败:', err?.message || err);
    await closeDb();
    process.exit(1);
  });
}
