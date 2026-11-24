/**
 * 鵲太醫 · 数据库 Schema（Drizzle ORM / MySQL）
 *
 * v5 架构：MySQL 只做「系统库」——账号/角色/权限/会话/飞书凭证/品牌设置/审计/同步映射。
 * 业务数据（业绩/投流/知识库/AI回复等）全部存飞书表格，本地不留副本（仅 sync_mappings 存只读降级快照）。
 * 连锁店版部署：tenants 表与各表 tenant_id 字段仅作内部占位保留（平滑升级，不动表结构），不对外暴露"租户"概念。
 *
 * 约束：varchar(36) 文本主键、bigint 毫秒时间戳、boolean 布尔、TEXT 存 JSON 字符串、
 *       各表保留 tenant_id 字段作为内部占位（全库唯一公司，平滑升级），门店级数据叠加 store_id。
 */
import { mysqlTable, varchar, text, bigint, int, boolean, uniqueIndex, index } from 'drizzle-orm/mysql-core';

/** 生成 cuid2 风格主键（两端通用，迁移友好） */
export function newId(prefix = ''): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}${prefix ? '_' : ''}${t}${r}`;
}

const id = (prefix = 'id') => varchar(prefix, { length: 36 }).primaryKey();
const createdAt = () => bigint('created_at', { mode: 'number' }).notNull();
const tenantId = () => varchar('tenant_id', { length: 36 });
const storeId = () => varchar('store_id', { length: 36 });

/* ---------- 租户与角色 ---------- */
/** 租户（店/连锁主体）。飞书绑定、品牌覆盖、用户都挂在租户下。 */
export const tenants = mysqlTable('tenants', {
  id: id('id'),
  name: varchar('name', { length: 128 }).notNull(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  contactName: varchar('contact_name', { length: 64 }).notNull().default(''), // 联系人
  phone: varchar('phone', { length: 32 }).notNull().default(''), // 联系电话
  remark: text('remark'), // 备注
  plan: varchar('plan', { length: 32 }).notNull().default('standard'), // 套餐：trial/standard/pro
  status: varchar('status', { length: 16 }).notNull().default('active'), // active/disabled
  createdAt: createdAt(),
});

export const roles = mysqlTable('roles', {
  id: id('id'),
  code: varchar('code', { length: 48 }).notNull().unique(), // super_admin/store_manager/staff/auditor（连锁店版：无租户/平台角色）
  name: varchar('name', { length: 64 }).notNull(),
  permissions: text('permissions').notNull().default('{}'), // JSON: 模块 -> VEAX 位
  isSystem: boolean('is_system').notNull().default(true),
  createdAt: createdAt(),
});

/** 门店（属于某租户） */
export const stores = mysqlTable('stores', {
  id: id('id'),
  tenantId: tenantId().notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  address: varchar('address', { length: 255 }).notNull().default(''),
  managerName: varchar('manager_name', { length: 64 }).notNull().default(''),
  staffCount: int('staff_count').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: createdAt(),
}, (t) => ({ byTenant: index('idx_store_tenant').on(t.tenantId) }));

/* ---------- 用户与会话 ---------- */
export const users = mysqlTable('users', {
  id: id('id'),
  tenantId: tenantId(), // NULL = 平台级用户（如平台超管）
  username: varchar('username', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 64 }).notNull(),
  phone: varchar('phone', { length: 32 }).notNull().default(''),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  roleCode: varchar('role_code', { length: 48 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  lastLoginAt: bigint('last_login_at', { mode: 'number' }),
  createdAt: createdAt(),
}, (t) => ({ byTenant: index('idx_user_tenant').on(t.tenantId) }));

export const userStores = mysqlTable('user_stores', {
  id: id('id'),
  tenantId: tenantId().notNull(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  storeId: storeId().notNull().references(() => stores.id),
  roleCode: varchar('role_code', { length: 48 }).notNull(), // 该店内的角色
  createdAt: createdAt(),
}, (t) => ({ uniq: uniqueIndex('uniq_user_store').on(t.userId, t.storeId) }));

export const sessions = mysqlTable('sessions', {
  id: id('id'),
  tenantId: tenantId(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id),
  refreshHash: varchar('refresh_hash', { length: 64 }).notNull().unique(), // SHA-256 of refresh token
  familyId: varchar('family_id', { length: 36 }).notNull(), // 同家族，重用检测时整族吊销
  deviceId: varchar('device_id', { length: 64 }).notNull().default(''),
  userAgent: varchar('user_agent', { length: 255 }).notNull().default(''),
  ip: varchar('ip', { length: 64 }).notNull().default(''),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  revokedAt: bigint('revoked_at', { mode: 'number' }),
  createdAt: createdAt(),
}, (t) => ({ byUser: index('idx_session_user').on(t.userId) }));

/* ---------- AI 配置（系统配置，留 MySQL） ---------- */
export const aiConfigs = mysqlTable('ai_configs', {
  id: id('id'),
  tenantId: tenantId(),
  scope: varchar('scope', { length: 16 }).notNull(), // platform / tenant / store / user
  scopeId: varchar('scope_id', { length: 36 }).notNull().default(''),
  provider: varchar('provider', { length: 32 }).notNull(), // deepseek / arkplan / ark / bailian / custom
  baseUrl: varchar('base_url', { length: 255 }).notNull().default(''),
  model: varchar('model', { length: 64 }).notNull().default(''),
  apiKeyEnc: text('api_key_enc'), // AES-256-GCM: {iv,authTag,ciphertext} JSON
  temperature: varchar('temperature', { length: 16 }).notNull().default('0.3'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: createdAt(),
}, (t) => ({ byTenant: index('idx_aicfg_tenant').on(t.tenantId) }));

export const aiScenes = mysqlTable('ai_scenes', {
  id: id('id'),
  tenantId: tenantId(),
  sceneCode: varchar('scene_code', { length: 48 }).notNull().unique(), // reconcile / ads / social / service / video
  name: varchar('name', { length: 64 }).notNull(),
  configId: varchar('config_id', { length: 36 }),
  modelOverride: varchar('model_override', { length: 64 }).notNull().default(''),
  temperature: varchar('temperature', { length: 16 }).notNull().default('0.3'),
  /** 管理员统一配置的 Agent Skill 系统提示词（留空用内置默认）。 */
  systemPrompt: text('system_prompt'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: createdAt(),
});

/* ---------- 集成凭证 / 品牌设置 / 同步映射 ---------- */
/** 第三方集成凭证（飞书/Meta/Google/视频供应商），AES-256-GCM 加密存储。 */
export const integrations = mysqlTable('integrations', {
  id: id('id'),
  tenantId: tenantId(), // NULL = 平台级
  type: varchar('type', { length: 32 }).notNull(), // feishu / meta / google / video_*
  scope: varchar('scope', { length: 16 }).notNull().default('tenant'), // platform / tenant
  appId: varchar('app_id', { length: 128 }).notNull().default(''),
  accountId: varchar('account_id', { length: 128 }).notNull().default(''),
  credentialsEnc: text('credentials_enc'), // AES-256-GCM JSON（app_secret 等）
  tokenExpiresAt: bigint('token_expires_at', { mode: 'number' }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: createdAt(),
}, (t) => ({ byTenantType: index('idx_integration_tenant_type').on(t.tenantId, t.type) }));

/** 平台全局设置（品牌名/logo/副标题/默认飞书配置）。 */
export const platformSettings = mysqlTable('platform_settings', {
  id: id('id'),
  platformName: varchar('platform_name', { length: 128 }).notNull().default('鵲太醫'),
  logoUrl: varchar('logo_url', { length: 255 }).notNull().default('/logo.ico'),
  logoText: varchar('logo_text', { length: 16 }).notNull().default('鵲'),
  subtitle: varchar('subtitle', { length: 128 }).notNull().default('AI OPERATION HUB'),
  defaultFeishuConfig: text('default_feishu_config'), // JSON，平台默认机器人配置（可选）
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  createdAt: createdAt(),
});

/**
 * 门店飞书绑定：一家店 = 一个飞书多维表格（base）。
 * 后台管理员授权后，把该店的 app_token + 各子表 table_id 映射存在这里。
 * credentialId 指向 integrations（用哪套凭证写），NULL = 用平台默认凭证。
 * 业务数据物理隔离在各自的 base 里，本表只存"房间号"，不存业务数据。
 */
export const storeFeishuBindings = mysqlTable('store_feishu_bindings', {
  id: id('id'),
  tenantId: tenantId().notNull(),
  storeId: storeId().notNull(),
  appToken: varchar('app_token', { length: 64 }).notNull().default(''), // 多维表格 app_token
  baseUrl: varchar('base_url', { length: 255 }).notNull().default(''), // 表格链接，便于后台跳转
  tableIds: text('table_ids'), // JSON: { performance, dsp, kb, replies, queue, ... } -> table_id
  credentialId: varchar('credential_id', { length: 36 }), // integrations.id，NULL=平台默认
  ownerName: varchar('owner_name', { length: 64 }).notNull().default(''), // 授权操作人
  status: varchar('status', { length: 16 }).notNull().default('active'), // active/disconnected
  lastCheckAt: bigint('last_check_at', { mode: 'number' }),
  lastError: text('last_error'),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  createdAt: createdAt(),
}, (t) => ({
  uniqStore: uniqueIndex('uniq_bind_store').on(t.storeId), // 一店一表
  byTenant: index('idx_bind_tenant').on(t.tenantId),
}));

/**
 * 飞书同步映射：biz_key 幂等 + 只读降级快照。
 * 业务数据以飞书为准；snapshotJson 仅用于飞书故障时的只读降级，不算业务副本。
 * 唯一键带 store_id：因为每个店有自己的 base，同一 biz_key 在不同店互不冲突。
 */
export const syncMappings = mysqlTable('sync_mappings', {
  id: id('id'),
  tenantId: tenantId().notNull(),
  storeId: storeId().notNull(),
  bizType: varchar('biz_type', { length: 32 }).notNull(), // performance/dsp_insights/ai_kb/...
  bizKey: varchar('biz_key', { length: 128 }).notNull(), // 业务幂等键
  feishuAppToken: varchar('feishu_app_token', { length: 64 }).notNull().default(''),
  feishuTableId: varchar('feishu_table_id', { length: 64 }).notNull().default(''),
  feishuRecordId: varchar('feishu_record_id', { length: 64 }).notNull().default(''),
  status: varchar('status', { length: 16 }).notNull().default('synced'), // synced/failed/pending
  contentHash: varchar('content_hash', { length: 64 }).notNull().default(''), // sha256，避免重复写
  snapshotJson: text('snapshot_json'), // 最近一次读取结果（只读降级）
  lastSyncedAt: bigint('last_synced_at', { mode: 'number' }),
  lastError: text('last_error'),
  createdAt: createdAt(),
}, (t) => ({
  uniq: uniqueIndex('uniq_sync_biz').on(t.storeId, t.bizType, t.bizKey),
  byStoreBiz: index('idx_sync_store_biz').on(t.storeId, t.bizType),
}));

/* ---------- 审计 ---------- */
export const auditLogs = mysqlTable('audit_logs', {
  id: id('id'),
  tenantId: tenantId(),
  userId: varchar('user_id', { length: 36 }),
  storeId: storeId(),
  action: varchar('action', { length: 64 }).notNull(),
  module: varchar('module', { length: 48 }).notNull().default(''),
  targetId: varchar('target_id', { length: 36 }),
  result: varchar('result', { length: 16 }).notNull().default('success'),
  ip: varchar('ip', { length: 64 }).notNull().default(''),
  userAgent: varchar('user_agent', { length: 255 }).notNull().default(''),
  createdAt: createdAt(),
}, (t) => ({ byTime: index('idx_audit_time').on(t.createdAt) }));

/**
 * 通用业务记录表：各功能模块的本地真实数据统一存这里。
 * biz_type 区分模块（kb / reconcile / price / material / service_reply / service_queue /
 *   push_config / social_post / social_reply / social_account / ads_account / ads_daily / ...），
 * payload 存该类型专属字段 JSON；store_id 支持门店隔离（'' = 公司级）。
 */
export const bizRecords = mysqlTable('biz_records', {
  id: id('id'),
  tenantId: tenantId(),
  storeId: storeId().notNull().default(''),
  bizType: varchar('biz_type', { length: 48 }).notNull(),
  title: varchar('title', { length: 255 }).notNull().default(''),
  payload: text('payload'),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (t) => ({
  byTypeStore: index('idx_biz_type_store').on(t.bizType, t.storeId),
  byTenant: index('idx_biz_tenant').on(t.tenantId),
}));

export const schema = {
  tenants, roles, stores, users, userStores, sessions,
  aiConfigs, aiScenes, integrations, platformSettings, storeFeishuBindings, syncMappings, auditLogs,
  bizRecords,
};
