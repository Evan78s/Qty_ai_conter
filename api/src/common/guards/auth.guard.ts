import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { AuthUser } from '../context';
import { getSecret } from '../../runtime-config';

const secret = () => new TextEncoder().encode(getSecret('jwtSecret'));

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new UnauthorizedException('未登录');

    let payload: any;
    try {
      payload = (await jwtVerify(token, secret(), { algorithms: ['HS256'] })).payload;
    } catch {
      throw new UnauthorizedException('登录已过期');
    }
    if (!payload?.sub) throw new UnauthorizedException('无效凭证');

    // 每次请求查库取最新用户与权限（不信 token 旧声明）
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub as string)).limit(1);
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, user.roleCode)).limit(1);
    let permissions: Record<string, number> = {};
    try { permissions = JSON.parse(role?.permissions || '{}'); } catch { /* ignore */ }

    // 单公司部署：一套系统 = 一家公司 = 一个数据库，不存在跨租户切换。
    // 历史库表仍保留 tenant_id 字段（平滑升级），但不再接受 X-Tenant-Id 指定其它公司。
    const isPlatform = user.roleCode === 'super_admin'; // 公司总管理员
    const tenantId: string | null = user.tenantId;

    // 可见门店：公司总管理员看全部；其他角色只按 user_stores 授权，不再按 tenant 过滤（全库同一家公司）
    let visibleStoreIds: string[];
    if (isPlatform) {
      visibleStoreIds = ['*'];
    } else {
      const links = await db.select().from(schema.userStores).where(eq(schema.userStores.userId, user.id));
      visibleStoreIds = links.map((l) => l.storeId);
    }

    (req as any).authUser = {
      id: user.id, username: user.username, displayName: user.displayName,
      roleCode: user.roleCode, permissions, visibleStoreIds,
      isSuper: isPlatform, isPlatform, isTenantAdmin: false, tenantId,
    } as AuthUser;
    return true;
  }
}

/** 生成 access token（仅含 sub，15 分钟）。 */
export async function signAccess(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret());
}
