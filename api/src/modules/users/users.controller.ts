import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { ROLES, PERM } from '../../common/constants';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../../common/audit.service';

@Controller('api/users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private authService: AuthService, private audit: AuditService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    const all = await db.select().from(schema.users);
    // 连锁店版部署：公司总管理员看全部用户；店长/员工只看与自己同门店的用户
    if (user.isPlatform) return all.map(this.sanitize);
    const links = await db.select().from(schema.userStores);
    const inScopeStores = links.filter((l) => user.visibleStoreIds.includes(l.storeId)).map((l) => l.userId);
    const rows = all.filter((u) => inScopeStores.includes(u.id) || u.id === user.id);
    return rows.map(this.sanitize);
  }

  @Post()
  @RequirePerm('system', PERM.EDIT)
  async create(@Req() req: Request, @Body() body: { username: string; displayName: string; password: string; roleCode: string; storeIds?: string[] }) {
    const user = (req as any).authUser as AuthUser;
    // 连锁店版部署：tenantId 统一取公司内部占位，不接受前端传入
    const [company] = await db.select().from(schema.tenants).limit(1);
    const tenantId = company?.id || null;
    const id = await this.authService.createUser({ ...body, tenantId });
    await this.audit.log('新增用户', 'users', { userId: user.id, tenantId: user.tenantId, targetId: id, ip: req.ip });
    return { id, username: body.username };
  }

  @Get('roles')
  async roles() {
    return db.select().from(schema.roles);
  }

  private sanitize(u: any) {
    const { passwordHash, ...rest } = u;
    return rest;
  }
}
