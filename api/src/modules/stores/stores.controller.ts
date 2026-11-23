import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { resolveStoreIds } from '../../common/scoped-repo';
import { AuditService } from '../../common/audit.service';
import { newId } from '../../db/schema';
import { PERM } from '../../common/constants';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';

interface StoreBody {
  name: string;
  address?: string;
  managerName?: string;
  staffCount?: number;
  status?: string;
}

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
  async create(@Req() req: Request, @Body() body: StoreBody) {
    const user = (req as any).authUser as AuthUser;
    if (!body.name?.trim()) throw new ForbiddenException('门店名称不能为空');
    // 连锁店版部署：tenantId 取公司内部占位的那条记录，不对外暴露"选租户"
    const [company] = await db.select().from(schema.tenants).limit(1);
    const tenantId = company?.id || user.tenantId || '';
    const id = newId('sto');
    await db.insert(schema.stores).values({
      id, tenantId, name: body.name.trim(), address: body.address || '', managerName: body.managerName || '',
      staffCount: body.staffCount || 0, status: 'active', createdAt: Date.now(),
    });
    await this.audit.log('新增门店', 'stores', { userId: user.id, tenantId, storeId: id, ip: req.ip }, 'success', id);
    return { id, tenantId, name: body.name.trim(), address: body.address || '', managerName: body.managerName || '', staffCount: body.staffCount || 0, status: 'active' };
  }

  /** 编辑门店：仅能改自己可见范围内的门店，防止跨店越权。 */
  @Patch(':id')
  @RequirePerm('system', PERM.EDIT)
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: StoreBody) {
    const user = (req as any).authUser as AuthUser;
    if (!body.name?.trim()) throw new ForbiddenException('门店名称不能为空');
    const ids = await resolveStoreIds(user);
    if (!ids.includes(id)) throw new ForbiddenException('无权操作该门店');

    const [target] = await db.select().from(schema.stores).where(eq(schema.stores.id, id)).limit(1);
    if (!target) throw new NotFoundException('门店不存在');

    await db.update(schema.stores).set({
      name: body.name.trim(),
      address: body.address ?? target.address,
      managerName: body.managerName ?? target.managerName,
      staffCount: body.staffCount ?? target.staffCount,
      status: body.status ?? target.status,
    }).where(eq(schema.stores.id, id));

    await this.audit.log('编辑门店', 'stores', { userId: user.id, tenantId: target.tenantId, storeId: id, ip: req.ip }, 'success', id);
    return { id, ...body };
  }

  /** 删除门店：仅能删自己可见范围内的门店。 */
  @Delete(':id')
  @RequirePerm('system', PERM.EDIT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).authUser as AuthUser;
    const ids = await resolveStoreIds(user);
    if (!ids.includes(id)) throw new ForbiddenException('无权操作该门店');

    const [target] = await db.select().from(schema.stores).where(eq(schema.stores.id, id)).limit(1);
    if (!target) throw new NotFoundException('门店不存在');

    await db.delete(schema.stores).where(eq(schema.stores.id, id));
    await this.audit.log('删除门店', 'stores', { userId: user.id, tenantId: target.tenantId, storeId: id, ip: req.ip }, 'success', id);
    return { ok: true, id };
  }
}
