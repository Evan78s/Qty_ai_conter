/**
 * 统一门店隔离仓储：所有带 store_id 的查询都经此层。
 * 从 AuthUser.visibleStoreIds 自动注入过滤；'*' 表示全部。
 * 单公司部署：visibleStoreIds 已由 AuthGuard 按门店授权生成，这里只做展开与校验。
 */
import { db, schema } from '../db';
import { AuthUser } from './context';
import { ForbiddenException } from '@nestjs/common';

export function visibleCondition(user: AuthUser) {
  if (user.visibleStoreIds[0] === '*') return undefined;
  return user.visibleStoreIds;
}

/** 返回可见门店 ID 列表（公司总管理员返回全部门店实际 id）。 */
export async function resolveStoreIds(user: AuthUser): Promise<string[]> {
  if (user.visibleStoreIds[0] === '*') {
    const rows = await db.select({ id: schema.stores.id }).from(schema.stores);
    return rows.map((s) => s.id);
  }
  return user.visibleStoreIds;
}

/** 校验并规范化请求的 storeId：'all' 或空 -> 可见全部；越权 -> 403。 */
export async function normalizeStoreId(user: AuthUser, requested?: string): Promise<string[]> {
  const all = await resolveStoreIds(user);
  if (!requested || requested === 'all') return all;
  if (!all.includes(requested)) throw new ForbiddenException('无权访问该门店数据');
  return [requested];
}
