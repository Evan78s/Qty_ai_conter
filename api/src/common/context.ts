/** 请求上下文类型：由 AuthGuard 注入，供 RolesGuard / StoreScopeGuard / 控制器使用。 */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  roleCode: string;
  permissions: Record<string, number>;
  visibleStoreIds: string[]; // 公司总管理员为 ['*'] 表示全部门店
  isSuper: boolean;          // 兼容旧判断：等同 isPlatform
  isPlatform: boolean;       // 公司总管理员（super_admin，管理本公司所有分店）
  isTenantAdmin: boolean;    // 历史字段，始终为 false（单公司部署无此角色）
  tenantId: string | null;   // 本公司标识（历史字段，全库唯一，不再用于切换）
}

// Express Request 扩展
declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}
export {};
