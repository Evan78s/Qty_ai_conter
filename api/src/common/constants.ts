/** 角色编码与权限位定义（与种子数据/前端一致）。
 *  连锁店版部署模型：一套系统服务一家公司的多家分店，无「租户/平台」层级。 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',   // 公司总管理员（管理本公司所有分店）
  STORE_MANAGER: 'store_manager', // 分店店长
  STAFF: 'staff',               // 员工
  AUDITOR: 'auditor',           // 只读审计
} as const;
export type RoleCode = typeof ROLES[keyof typeof ROLES];

export const PERM = { VIEW: 1, EDIT: 2, APPROVE: 4, EXPORT: 8 } as const;
// 模块 key 与前端导航一致
export const MODULES = ['overview', 'store', 'reconcile', 'ads', 'service', 'social', 'system'] as const;

export const COOKIE_REFRESH = 'yyh_refresh';
export const ACCESS_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
