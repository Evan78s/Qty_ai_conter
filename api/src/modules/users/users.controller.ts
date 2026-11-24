import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { ROLES, PERM } from '../../common/constants';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../../common/audit.service';
import { getSecret } from '../../runtime-config';

@Controller('api/users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private authService: AuthService, private audit: AuditService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    const all = await db.select().from(schema.users);
    const links = await db.select().from(schema.userStores);
    const withStores = (rows: any[]) => rows.map((u) => ({
      ...this.sanitize(u),
      storeIds: links.filter((l) => l.userId === u.id).map((l) => l.storeId),
    }));
    // 连锁店版部署：公司总管理员看全部用户；店长/员工只看与自己同门店的用户
    if (user.isPlatform) return withStores(all);
    const inScopeStores = links.filter((l) => user.visibleStoreIds.includes(l.storeId)).map((l) => l.userId);
    const rows = all.filter((u) => inScopeStores.includes(u.id) || u.id === user.id);
    return withStores(rows);
  }

  @Post()
  @RequirePerm('system', PERM.EDIT)
  async create(@Req() req: Request, @Body() body: { username: string; displayName: string; password: string; roleCode: string; storeIds?: string[] }) {
    const user = (req as any).authUser as AuthUser;
    if (!body.password || body.password.length < 8) throw new BadRequestException('密码至少 8 位');
    // 连锁店版部署：tenantId 统一取公司内部占位，不接受前端传入
    const [company] = await db.select().from(schema.tenants).limit(1);
    const tenantId = company?.id || null;
    const id = await this.authService.createUser({ ...body, tenantId });
    await this.audit.log('新增用户', 'users', { userId: user.id, tenantId: user.tenantId, targetId: id, ip: req.ip });
    return { id, username: body.username };
  }

  /** 编辑用户：姓名/角色/状态/可访问门店；可选重置密码。 */
  @Patch(':id')
  @RequirePerm('system', PERM.EDIT)
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: {
    displayName?: string; roleCode?: string; status?: string; password?: string; storeIds?: string[];
  }) {
    const user = (req as any).authUser as AuthUser;
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) throw new NotFoundException('用户不存在');

    const patch: any = { displayName: body.displayName ?? target.displayName };
    if (body.roleCode !== undefined) patch.roleCode = body.roleCode;
    if (body.status !== undefined) patch.status = body.status;
    if (body.password) {
      if (body.password.length < 8) throw new BadRequestException('密码至少 8 位');
      patch.passwordHash = await bcrypt.hash(body.password + getSecret('passwordPepper'), 12);
      patch.mustChangePassword = true;
    }
    await db.update(schema.users).set(patch).where(eq(schema.users.id, id));

    if (body.storeIds !== undefined) {
      await db.delete(schema.userStores).where(eq(schema.userStores.userId, id));
      for (const storeId of body.storeIds) {
        await db.insert(schema.userStores).values({
          id: (await import('../../db/schema')).newId('us'),
          tenantId: target.tenantId || '', userId: id, storeId,
          roleCode: body.roleCode || target.roleCode, createdAt: Date.now(),
        });
      }
    }
    await this.audit.log('编辑用户', 'users', { userId: user.id, tenantId: user.tenantId, targetId: id, ip: req.ip });
    return { ok: true, id };
  }

  /** 删除用户：不可删自己。 */
  @Delete(':id')
  @RequirePerm('system', PERM.EDIT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).authUser as AuthUser;
    if (id === user.id) throw new BadRequestException('不能删除当前登录账号');
    const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!target) throw new NotFoundException('用户不存在');
    await db.delete(schema.userStores).where(eq(schema.userStores.userId, id));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    await db.delete(schema.users).where(eq(schema.users.id, id));
    await this.audit.log('删除用户', 'users', { userId: user.id, tenantId: user.tenantId, targetId: id, ip: req.ip });
    return { ok: true, id };
  }

  @Get('roles')
  async roles() {
    return db.select().from(schema.roles);
  }

  /** 更新角色权限矩阵（permissions JSON）。系统内置角色也可调，便于按实际调整。 */
  @Patch('roles/:code')
  @RequirePerm('system', PERM.EDIT)
  async updateRole(@Req() req: Request, @Param('code') code: string, @Body() body: { permissions: Record<string, number> }) {
    const user = (req as any).authUser as AuthUser;
    if (!body.permissions || typeof body.permissions !== 'object') throw new BadRequestException('权限格式错误');
    const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, code)).limit(1);
    if (!role) throw new NotFoundException('角色不存在');
    await db.update(schema.roles).set({ permissions: JSON.stringify(body.permissions) }).where(eq(schema.roles.code, code));
    await this.audit.log('更新角色权限', 'system', { userId: user.id, targetId: role.id, ip: req.ip });
    return { ok: true, code };
  }

  private sanitize(u: any) {
    const { passwordHash, ...rest } = u;
    return rest;
  }
}
