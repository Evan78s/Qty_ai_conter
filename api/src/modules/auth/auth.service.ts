import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { signAccess } from '../../common/guards/auth.guard';
import { sha256, randomToken } from '../../common/crypto';
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from '../../common/constants';
import { newId } from '../../db/schema';
import { AuditService } from '../../common/audit.service';
import { getSecret } from '../../runtime-config';

function peppered(password: string) {
  return password + getSecret('passwordPepper');
}

export interface LoginCtx { ip: string; userAgent: string; deviceId: string }

@Injectable()
export class AuthService {
  constructor(private audit: AuditService) {}

  async login(username: string, password: string, ctx: LoginCtx) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    // 不区分"用户不存在/密码错误"
    const invalid = new UnauthorizedException('账号或密码错误');
    if (!user || user.status !== 'active') throw invalid;
    const ok = await bcrypt.compare(peppered(password), user.passwordHash);
    if (!ok) throw invalid;

    const accessToken = await signAccess(user.id);
    const refresh = randomToken(32);
    const familyId = randomToken(16);
    await db.insert(schema.sessions).values({
      id: newId('ses'), tenantId: user.tenantId, userId: user.id, refreshHash: sha256(refresh), familyId,
      deviceId: ctx.deviceId, userAgent: ctx.userAgent, ip: ctx.ip,
      expiresAt: Date.now() + REFRESH_TTL_MS, createdAt: Date.now(),
    });
    await db.update(schema.users).set({ lastLoginAt: Date.now() }).where(eq(schema.users.id, user.id));
    await this.audit.log('登录', 'auth', { userId: user.id, tenantId: user.tenantId, ip: ctx.ip, userAgent: ctx.userAgent });

    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, user.roleCode)).limit(1);
    const [tenant] = user.tenantId
      ? await db.select().from(schema.tenants).where(eq(schema.tenants.id, user.tenantId)).limit(1)
      : [];
    return {
      accessToken,
      refreshToken: refresh,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id, username: user.username, displayName: user.displayName,
        roleCode: user.roleCode, roleName: role?.name || user.roleCode,
        tenantId: user.tenantId, tenantName: tenant?.name || '',
      },
    };
  }

  async refresh(refreshToken: string, ctx: LoginCtx) {
    if (!refreshToken) throw new UnauthorizedException('缺少刷新凭证');
    const hash = sha256(refreshToken);
    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.refreshHash, hash)).limit(1);
    if (!session) throw new UnauthorizedException('刷新凭证无效');
    if (session.revokedAt) {
      // 旧 token 只是失效，不再连带吊销整个家族：
      // 多标签 / Cookie 与本地兜底并存时，偶尔用到旧 token 不应把其它正常设备一起踢下线。
      throw new UnauthorizedException('刷新凭证已失效，请重新登录');
    }
    if (session.expiresAt < Date.now()) throw new UnauthorizedException('登录已过期，请重新登录');

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1);
    if (!user || user.status !== 'active') throw new UnauthorizedException('账号不可用');

    // 轮转：旧 token 吊销，签发新 refresh（同一家族）
    const newRefresh = randomToken(32);
    await db.update(schema.sessions).set({ revokedAt: Date.now() }).where(eq(schema.sessions.id, session.id));
    await db.insert(schema.sessions).values({
      id: newId('ses'), tenantId: user.tenantId, userId: user.id, refreshHash: sha256(newRefresh), familyId: session.familyId,
      deviceId: ctx.deviceId, userAgent: ctx.userAgent, ip: ctx.ip,
      expiresAt: Date.now() + REFRESH_TTL_MS, createdAt: Date.now(),
    });
    return { accessToken: await signAccess(user.id), refreshToken: newRefresh };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      const hash = sha256(refreshToken);
      const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.refreshHash, hash)).limit(1);
      if (session) await db.update(schema.sessions).set({ revokedAt: Date.now() }).where(eq(schema.sessions.familyId, session.familyId));
    }
    return { ok: true };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string, ctx?: LoginCtx) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('新密码至少 8 位');
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(peppered(oldPassword), user.passwordHash);
    if (!ok) throw new BadRequestException('原密码错误');
    const hash = await bcrypt.hash(peppered(newPassword), 12);
    await db.update(schema.users).set({ passwordHash: hash, mustChangePassword: false }).where(eq(schema.users.id, userId));
    // 改密后吊销所有会话，强制重新登录
    await db.update(schema.sessions).set({ revokedAt: Date.now() }).where(eq(schema.sessions.userId, userId));
    await this.audit.log('修改密码', 'auth', { userId, tenantId: user.tenantId, ip: ctx?.ip, userAgent: ctx?.userAgent });
    return { ok: true };
  }

  /** 供 bootstrap/用户管理调用的建用户逻辑。 */
  async createUser(params: { username: string; displayName: string; password: string; roleCode: string; tenantId?: string | null; storeIds?: string[] }) {
    const [exists] = await db.select().from(schema.users).where(eq(schema.users.username, params.username)).limit(1);
    if (exists) throw new ConflictException('账号已存在');
    const hash = await bcrypt.hash(peppered(params.password), 12);
    const userId = newId('usr');
    await db.insert(schema.users).values({
      id: userId, tenantId: params.tenantId ?? null, username: params.username, displayName: params.displayName,
      passwordHash: hash, roleCode: params.roleCode, mustChangePassword: true, createdAt: Date.now(),
    });
    for (const storeId of params.storeIds || []) {
      await db.insert(schema.userStores).values({ id: newId('us'), tenantId: params.tenantId ?? '', userId, storeId, roleCode: params.roleCode, createdAt: Date.now() });
    }
    return userId;
  }

  async me(user: any) {
    const links = await db.select().from(schema.userStores).where(eq(schema.userStores.userId, user.id));
    const allStores = await db.select().from(schema.stores);
    // 连锁店版部署：总管理员与审计看全部门店，其余只按 user_stores 授权（不再按 tenant 过滤）
    const scoped = user.isPlatform || user.isSuper || user.roleCode === 'auditor'
      ? allStores
      : allStores.filter((s) => links.some((l) => l.storeId === s.id));
    const [tenant] = user.tenantId
      ? await db.select().from(schema.tenants).where(eq(schema.tenants.id, user.tenantId)).limit(1)
      : [];
    const [freshUser] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
    return {
      user: {
        id: user.id, username: user.username, displayName: user.displayName, roleCode: user.roleCode,
        permissions: user.permissions, tenantId: user.tenantId, tenantName: tenant?.name || '',
        isPlatform: !!user.isPlatform, isTenantAdmin: !!user.isTenantAdmin,
        mustChangePassword: freshUser?.mustChangePassword ?? false,
      },
      stores: scoped.map((s) => ({ id: s.id, name: s.name, tenantId: s.tenantId })),
    };
  }
}
