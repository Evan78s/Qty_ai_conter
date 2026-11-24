import { Injectable, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { decrypt } from './crypto';

/**
 * 飞书开放平台客户端：只用已保存的企业自建应用凭证，Key 不出服务器。
 * 覆盖多维表格的「列子表 / 列字段 / 读记录 / 写记录」，供对账等功能对接。
 */
@Injectable()
export class FeishuService {
  private tokenCache = new Map<string, { token: string; expireAt: number }>();

  private async credential(binding: any): Promise<{ appId: string; appSecret: string }> {
    let row: any;
    if (binding?.credentialId) {
      row = (await db.select().from(schema.integrations)
        .where(eq(schema.integrations.id, binding.credentialId)).limit(1))[0];
    }
    if (!row) {
      row = (await db.select().from(schema.integrations)
        .where(eq(schema.integrations.type, 'feishu')).limit(1))
        .find((r: any) => r.status === 'active');
    }
    if (!row?.credentialsEnc) {
      throw new BadRequestException('尚未配置飞书凭证，请先到「系统设置 → 飞书授权」添加应用');
    }
    let payload: any;
    try { payload = JSON.parse(decrypt(row.credentialsEnc)); } catch { throw new BadRequestException('飞书凭证解密失败，请重新保存'); }
    if (!payload.appSecret) throw new BadRequestException('飞书 App Secret 缺失，请重新保存凭证');
    return { appId: row.appId, appSecret: payload.appSecret };
  }

  /** 获取 tenant_access_token（按凭证缓存，过期前 2 分钟刷新）。 */
  private async tenantToken(binding: any): Promise<string> {
    const cred = await this.credential(binding);
    const cacheKey = cred.appId;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expireAt > Date.now() + 120000) return cached.token;
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: cred.appId, app_secret: cred.appSecret }),
      signal: AbortSignal.timeout(15000),
    } as any);
    const data: any = await res.json().catch(() => ({}));
    if (data?.code !== 0 || !data?.tenant_access_token) {
      throw new BadRequestException(`飞书授权失败(${data?.code ?? res.status})：${data?.msg || '请检查 App ID/Secret 与版本发布状态'}`);
    }
    this.tokenCache.set(cacheKey, {
      token: data.tenant_access_token,
      expireAt: Date.now() + Number(data.expire || 7200) * 1000,
    });
    return data.tenant_access_token;
  }

  private async api(binding: any, path: string, init: RequestInit = {}): Promise<any> {
    const token = await this.tenantToken(binding);
    const res = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers as any || {}),
      },
      signal: AbortSignal.timeout(20000),
    } as any);
    const data: any = await res.json().catch(() => ({}));
    if (data?.code !== 0) {
      throw new BadRequestException(`飞书接口失败(${data?.code ?? res.status})：${data?.msg || '未知错误'}`);
    }
    return data.data || {};
  }

  /** 列出该 base 下的所有子表。 */
  async listTables(binding: any): Promise<{ tableId: string; name: string }[]> {
    const app = encodeURIComponent(binding.appToken);
    const data = await this.api(binding, `apps/${app}/tables?page_size=100`);
    return (data.items || []).map((t: any) => ({ tableId: t.table_id, name: t.name }));
  }

  /** 列出子表字段（写记录时过滤掉表里不存在的列名）。 */
  async listFields(binding: any, tableId: string): Promise<string[]> {
    const app = encodeURIComponent(binding.appToken);
    const tbl = encodeURIComponent(tableId);
    const data = await this.api(binding, `apps/${app}/tables/${tbl}/fields?page_size=100`);
    return (data.items || []).map((f: any) => String(f.field_name));
  }

  /** 读取子表记录（返回 fields 数组）。 */
  async listRecords(binding: any, tableId: string, pageSize = 100): Promise<any[]> {
    const app = encodeURIComponent(binding.appToken);
    const tbl = encodeURIComponent(tableId);
    const data = await this.api(binding, `apps/${app}/tables/${tbl}/records?page_size=${pageSize}`);
    return data.items || [];
  }

  /** 写入一条记录；自动丢弃该子表里不存在的字段。 */
  async createRecord(binding: any, tableId: string, fields: Record<string, any>): Promise<string> {
    const names = await this.listFields(binding, tableId);
    const kept: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (names.includes(k) && v !== undefined && v !== null && v !== '') kept[k] = v;
    }
    if (!Object.keys(kept).length) {
      throw new BadRequestException(`子表没有可写入的匹配字段（现有字段：${names.join('、') || '无'}）`);
    }
    const app = encodeURIComponent(binding.appToken);
    const tbl = encodeURIComponent(tableId);
    const data = await this.api(binding, `apps/${app}/tables/${tbl}/records`, {
      method: 'POST',
      body: JSON.stringify({ fields: kept }),
    });
    return data.record?.record_id || '';
  }

  /**
   * 解析「门店每日台账」子表：优先后台配置 tableIds.ledger；
   * 未配置则按名称自动匹配（门店每日台账 / 台账 / 对账）；再退回旧 reconciliation 映射。
   */
  async resolveLedgerTable(binding: any): Promise<string> {
    const ids = (() => { try { return JSON.parse(binding.tableIds || '{}'); } catch { return {}; } })();
    if (ids.ledger) return ids.ledger;
    if (ids.reconcile) return ids.reconcile;
    const tables = await this.listTables(binding);
    const hit = tables.find((t) => t.name.includes('门店每日台账'))
      || tables.find((t) => t.name.includes('台账'))
      || tables.find((t) => t.name.includes('对账'));
    if (hit) return hit.tableId;
    throw new BadRequestException('未找到「门店每日台账」子表，请在「系统设置 → 门店表格绑定」中选择对账子表');
  }
}
