import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../context';

/**
 * 门店隔离守卫：请求参数/查询里的 storeId 必须在可见集合内，否则 403。
 * 若未带 storeId，则由 scopedRepo 自动按可见集合过滤。
 */
@Injectable()
export class StoreScopeGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = (req as any).authUser as AuthUser;
    // 未认证路由（如 /api/health、/api/auth/login）由 AuthGuard 自行决定是否放行，这里不拦截
    if (!user) return true;
    if (user.visibleStoreIds[0] === '*') return true;
    const storeId = (req.query as any)?.storeId || (req.params as any)?.storeId || (req.body as any)?.storeId;
    if (storeId && !user.visibleStoreIds.includes(String(storeId))) {
      throw new ForbiddenException('无权访问该门店数据');
    }
    return true;
  }
}
