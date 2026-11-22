import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { resolveStoreIds } from '../../common/scoped-repo';
import { AuditService } from '../../common/audit.service';
import { newId } from '../../db/schema';
import { PERM } from '../../common/constants';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';

@Controller('api/stores')
@UseGuards(AuthGuard)
export class StoresController {
  constructor(private audit: AuditService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    const ids = await resolveStoreIds(user);
    if (ids.length === 0) return [];
    const all = await db.select().from(schema.stores);
    return all.filter((s) => ids.includes(s.id));
  }

  @Post()
  @RequirePerm('system', PERM.EDIT)
  async create(@Req() req: Request, @Body() body: { name: string; address?: string; managerName?: string; staffCount?: number }) {
    const user = (req as any).authUser as AuthUser;
    // 单公司部署：tenantId 取公司内部占位的那条记录，不对外暴露"选租户"
    const [company] = await db.select().from(schema.tenants).limit(1);
    const tenantId = company?.id || user.tenantId || '';
    const id = newId('sto');
    await db.insert(schema.stores).values({
      id, tenantId, name: body.name, address: body.address || '', managerName: body.managerName || '',
      staffCount: body.staffCount || 0, status: 'active', createdAt: Date.now(),
    });
    await this.audit.log('新增门店', 'stores', { userId: user.id, tenantId, storeId: id, ip: req.ip }, 'success', id);
    return { id, tenantId, ...body };
  }
}
