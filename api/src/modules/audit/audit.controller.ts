import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { desc } from 'drizzle-orm';

@Controller('api/audit')
@UseGuards(AuthGuard)
export class AuditController {
  @Get()
  async list(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    let rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
    if (!user.isPlatform) {
      // 单公司部署：非总管理员只看与自己可见门店相关的审计
      rows = rows.filter((r) => !r.storeId || user.visibleStoreIds.includes(r.storeId));
    }
    return rows;
  }
}
