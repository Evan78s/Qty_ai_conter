/**
 * 系统设置：飞书统一授权凭证、门店 base 绑定、品牌设置、数据库状态。
 * 所有写入均记录审计。凭证 AES-256-GCM 加密，前端只回传掩码。
 */
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { db, pool, schema } from '../../db';
import { newId } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { AuditService, type AuditCtx } from '../../common/audit.service';
import { getDbConfig, isInstalled } from '../../runtime-config';

/** 子表默认键（前端展示/建模板用） */
export const BIZ_TABLES = ['performance', 'dsp', 'kb', 'replies', 'queue', 'social', 'materials', 'push'] as const;

@Injectable()
export class SettingsService {
  constructor(private readonly audit: AuditService) {}

  private async requirePlatform(user: any) {
    if (!user?.isSuper) throw new ForbiddenException('仅公司总管理员可操作');
  }

  /* ---------- 飞书凭证（统一授权，一把钥匙） ---------- */
  async listIntegrations(ctx: AuditCtx) {
    const rows = await db.select().from(schema.integrations).where(eq(schema.integrations.type, 'feishu'));
    return rows.map((r) => ({
      id: r.id, tenantId: r.tenantId, scope: r.scope, appId: r.appId,
      credentialsMasked: r.credentialsEnc ? maskSecret(decryptSafe(r.credentialsEnc)) : '',
      status: r.status, createdAt: r.createdAt,
    }));
  }

  async saveFeishuCredential(body: {
    id?: string; tenantId?: string | null; scope?: string; appId: string; appSecret: string; status?: string;
  }, user: any, ctx: AuditCtx) {
    await this.requirePlatform(user);
    if (!body.appId || !body.appSecret) throw new BadRequestException('请填写 App ID 和 App Secret');
    const credentialsEnc = encrypt(JSON.stringify({ appSecret: body.appSecret }));
    const tenantId = body.tenantId || null;
    if (body.id) {
      await db.update(schema.integrations).set({
        appId: body.appId, credentialsEnc, scope: body.scope || 'platform',
        status: body.status || 'active',
      }).where(eq(schema.integrations.id, body.id));
      await this.audit.log('update_feishu_credential', 'system', ctx, 'success', body.id);
      return { id: body.id, updated: true };
    }
    const id = newId('int');
    await db.insert(schema.integrations).values({
      id, tenantId, type: 'feishu', scope: body.scope || 'platform',
      appId: body.appId, credentialsEnc, status: body.status || 'active', createdAt: Date.now(),
    });
    await this.audit.log('create_feishu_credential', 'system', ctx, 'success', id);
    return { id, created: true };
  }

  async deleteCredential(id: string, user: any, ctx: AuditCtx) {
    await this.requirePlatform(user);
    await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
    await this.audit.log('delete_feishu_credential', 'system', ctx, 'success', id);
    return { ok: true };
  }

  /* ---------- 门店 base 绑定（一店一表） ---------- */
  async listBindings() {
    const rows = await db.select().from(schema.storeFeishuBindings);
    const stores = await db.select().from(schema.stores);
    const storeMap = new Map(stores.map((s) => [s.id, s.name]));
    return rows.map((r) => ({
      id: r.id, storeId: r.storeId, storeName: storeMap.get(r.storeId) || r.storeId,
      appToken: r.appToken, baseUrl: r.baseUrl,
      tableIds: safeJson(r.tableIds), credentialId: r.credentialId,
      ownerName: r.ownerName, status: r.status, lastCheckAt: r.lastCheckAt,
      lastError: r.lastError, updatedAt: r.updatedAt,
    }));
  }

  async listStores() {
    const rows = await db.select().from(schema.stores);
    return rows.map((s) => ({ id: s.id, name: s.name, status: s.status }));
  }

  async saveBinding(body: {
    id?: string; storeId: string; appToken: string; baseUrl?: string;
    tableIds?: Record<string, string>; credentialId?: string | null; ownerName?: string; status?: string;
  }, user: any, ctx: AuditCtx) {
    await this.requirePlatform(user);
    if (!body.storeId || !body.appToken) throw new BadRequestException('请选择门店并填写多维表格 app_token');
    const data = {
      storeId: body.storeId,
      appToken: body.appToken.trim(),
      baseUrl: (body.baseUrl || '').trim(),
      tableIds: JSON.stringify(body.tableIds || {}),
      credentialId: body.credentialId || null,
      ownerName: (body.ownerName || user?.displayName || '').trim(),
      status: body.status || 'active',
      updatedAt: Date.now(),
    };
    if (body.id) {
      await db.update(schema.storeFeishuBindings).set(data).where(eq(schema.storeFeishuBindings.id, body.id));
      await this.audit.log('update_store_binding', 'system', ctx, 'success', body.id);
      return { id: body.id, updated: true };
    }
    const exists = await db.select().from(schema.storeFeishuBindings)
      .where(eq(schema.storeFeishuBindings.storeId, body.storeId)).limit(1);
    if (exists.length) throw new BadRequestException('该门店已绑定多维表格，请编辑现有绑定');
    const id = newId('bnd');
    const tenant = (await db.select().from(schema.stores).where(eq(schema.stores.id, body.storeId)).limit(1))[0];
    await db.insert(schema.storeFeishuBindings).values({
      id, ...data, tenantId: tenant?.tenantId || '', createdAt: Date.now(),
    });
    await this.audit.log('create_store_binding', 'system', ctx, 'success', id);
    return { id, created: true };
  }

  async deleteBinding(id: string, user: any, ctx: AuditCtx) {
    await this.requirePlatform(user);
    await db.delete(schema.storeFeishuBindings).where(eq(schema.storeFeishuBindings.id, id));
    await this.audit.log('delete_store_binding', 'system', ctx, 'success', id);
    return { ok: true };
  }

  /* ---------- 品牌设置 ---------- */
  async getBrand() {
    const row = (await db.select().from(schema.platformSettings).limit(1))[0];
    return row || { platformName: '鵲太醫', logoUrl: '/logo.ico', logoText: '鵲', subtitle: 'AI OPERATION HUB' };
  }

  async saveBrand(body: { platformName?: string; logoUrl?: string; logoText?: string; subtitle?: string }, user: any, ctx: AuditCtx) {
    await this.requirePlatform(user);
    const row = (await db.select().from(schema.platformSettings).limit(1))[0];
    const patch: any = { updatedAt: Date.now() };
    for (const k of ['platformName', 'logoUrl', 'logoText', 'subtitle'] as const) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (row) await db.update(schema.platformSettings).set(patch).where(eq(schema.platformSettings.id, row.id));
    else await db.insert(schema.platformSettings).values({ id: newId('set'), ...patch, createdAt: Date.now() } as any);
    await this.audit.log('update_brand', 'system', ctx, 'success');
    return { ok: true };
  }

  /* ---------- 数据库状态 ---------- */
  async dbStatus() {
    const cfg = getDbConfig();
    let tables: string[] = [];
    let reachable = false;
    try {
      const t = await pool.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name', [cfg?.name || '']);
      reachable = true;
      tables = (t[0] as any[] || []).map((x: any) => x.name);
    } catch { reachable = false; }
    return {
      installed: isInstalled(),
      reachable,
      config: cfg ? { host: cfg.host, port: cfg.port, name: cfg.name, user: cfg.user } : null,
      tableCount: tables.length,
      tables,
      systemTables: 13,
    };
  }
}

function decryptSafe(payload: string): string {
  try { return decrypt(payload); } catch { return ''; }
}
function safeJson(text: string | null): Record<string, string> {
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}
