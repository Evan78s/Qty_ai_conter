import { Injectable } from '@nestjs/common';
import { db, schema } from '../db';
import { newId } from '../db/schema';

export interface AuditCtx {
  userId?: string | null;
  tenantId?: string | null;
  storeId?: string | null;
  ip?: string;
  userAgent?: string;
  targetId?: string;
}

@Injectable()
export class AuditService {
  async log(action: string, module: string, ctx: AuditCtx = {}, result = 'success', targetId?: string) {
    await db.insert(schema.auditLogs).values({
      id: newId('aud'),
      tenantId: ctx.tenantId || null,
      userId: ctx.userId || null,
      storeId: ctx.storeId || null,
      action,
      module,
      targetId: targetId || ctx.targetId || null,
      result,
      ip: ctx.ip || '',
      userAgent: ctx.userAgent || '',
      createdAt: Date.now(),
    });
  }
}
