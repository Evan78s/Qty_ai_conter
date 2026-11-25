import { Injectable, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { newId } from '../../db/schema';
import type { AuthUser } from '../../common/context';
import type { AuditCtx } from '../../common/audit.service';
import { AuditService } from '../../common/audit.service';

const GRAPH = 'https://graph.facebook.com/v21.0';
const CONV_FALLBACK = ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'lead', 'complete_registration'];

interface MetaConfig {
  accessToken: string;
  businessId: string;
  accountId: string;
  exchangeRate: number;
  conversionAction: string;
}

function normalizeAct(id: string) {
  const s = String(id || '').trim().replace(/^act_/i, '');
  return s ? `act_${s}` : '';
}

/** 从 actions 里挑转化数：优先指定事件，其次常见事件，最后取第一个。 */
function pickConversions(actions: any[] | undefined, preferred: string): number {
  if (!Array.isArray(actions)) return 0;
  const sum = (pred: (t: string) => boolean) => actions.filter((a) => pred(String(a.action_type || '')))
    .reduce((n, a) => n + (Number(a.value) || 0), 0);
  if (preferred) {
    const v = sum((t) => t === preferred);
    if (v) return v;
  }
  for (const key of CONV_FALLBACK) {
    const v = sum((t) => t === key || t.endsWith('.' + key));
    if (v) return v;
  }
  return actions.reduce((n, a) => n + (Number(a.value) || 0), 0);
}

@Injectable()
export class MetaService {
  constructor(private audit: AuditService) {}

  private async row() {
    const rows = await db.select().from(schema.integrations).where(eq(schema.integrations.type, 'meta'));
    return rows[0];
  }

  private async cfg(): Promise<MetaConfig | null> {
    const row = await this.row();
    if (!row?.credentialsEnc) return null;
    try {
      const o = JSON.parse(decrypt(row.credentialsEnc));
      return {
        accessToken: o.accessToken || '',
        businessId: row.appId || '',
        accountId: row.accountId || '',
        exchangeRate: Number(o.exchangeRate) > 0 ? Number(o.exchangeRate) : 7.2,
        conversionAction: o.conversionAction || '',
      };
    } catch {
      return null;
    }
  }

  async getConfig() {
    const row = await this.row();
    const c = await this.cfg();
    return {
      ok: true,
      configured: !!c?.accessToken && !!c?.accountId,
      accessTokenMasked: c ? maskSecret(c.accessToken) : '',
      businessId: c?.businessId || row?.appId || '',
      accountId: c?.accountId || row?.accountId || '',
      exchangeRate: c?.exchangeRate ?? 7.2,
      conversionAction: c?.conversionAction || '',
      updatedAt: row?.createdAt || 0,
    };
  }

  async saveConfig(body: {
    accessToken?: string; businessId?: string; accountId?: string;
    exchangeRate?: number | string; conversionAction?: string;
  }, user: AuthUser, ctx: AuditCtx) {
    if (!user.isSuper) throw new BadRequestException('仅总管理员可修改 Meta 投流配置');
    const accountId = String(body.accountId || '').trim().replace(/^act_/i, '');
    if (!/^\d+$/.test(accountId)) throw new BadRequestException('广告账户 ID 应为纯数字（URL 里 act= 后面那段）');
    const rate = Number(body.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) throw new BadRequestException('汇率必须大于 0');
    const row = await this.row();
    const old = await this.cfg();
    const token = String(body.accessToken || '').trim() || old?.accessToken || '';
    if (!token) throw new BadRequestException('请填写 Meta Access Token');
    const enc = encrypt(JSON.stringify({
      accessToken: token,
      exchangeRate: rate,
      conversionAction: String(body.conversionAction || '').trim(),
    }));
    const patch: any = {
      appId: String(body.businessId || '').trim(),
      accountId,
      credentialsEnc: enc,
      status: 'active',
    };
    if (row) await db.update(schema.integrations).set(patch).where(eq(schema.integrations.id, row.id));
    else await db.insert(schema.integrations).values({
      id: newId('int'), tenantId: '', type: 'meta', scope: 'platform', ...patch, createdAt: Date.now(),
    } as any);
    await this.audit.log('保存 Meta 投流配置', 'system', ctx);
    return this.getConfig();
  }

  /** 测试：读广告账户名称与状态，验证 Token 与账户权限。 */
  async test(user: AuthUser, ctx: AuditCtx) {
    const c = await this.cfg();
    if (!c?.accessToken || !c.accountId) throw new BadRequestException('尚未配置 Meta Token 或广告账户 ID');
    const url = `${GRAPH}/${normalizeAct(c.accountId)}?fields=name,account_status,currency,timezone_name&access_token=${encodeURIComponent(c.accessToken)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) } as any);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      await this.audit.log('测试 Meta 投流连接', 'system', ctx, 'success');
      return { ok: true, name: data.name || '', accountStatus: data.account_status, currency: data.currency || '', timezone: data.timezone_name || '' };
    } catch (e: any) {
      await this.audit.log('测试 Meta 投流连接', 'system', ctx, 'failed');
      throw new BadRequestException(`连接失败：${e?.message || e}`);
    }
  }

  private async fetchInsights(c: MetaConfig, since: string, until: string) {
    const out: any[] = [];
    let next: string | undefined = `${GRAPH}/${normalizeAct(c.accountId)}/insights?`
      + new URLSearchParams({
        level: 'account',
        time_increment: '1',
        time_range: JSON.stringify({ since, until }),
        fields: 'date_start,spend,impressions,reach,clicks,actions',
        limit: '500',
        access_token: c.accessToken,
      }).toString();
    let guard = 0;
    while (next && guard++ < 10) {
      const res = await fetch(next, { signal: AbortSignal.timeout(60000) } as any);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      out.push(...(Array.isArray(data?.data) ? data.data : []));
      next = data?.paging?.next;
    }
    return out;
  }

  /** 按国家取花费与转化，供「投放国家/地区表现」使用；失败不影响主流程。 */
  private async fetchCountries(c: MetaConfig, since: string, until: string): Promise<string> {
    try {
      const url = `${GRAPH}/${normalizeAct(c.accountId)}/insights?` + new URLSearchParams({
        level: 'account', breakdowns: 'country',
        time_range: JSON.stringify({ since, until }),
        fields: 'country,spend,clicks,actions',
        limit: '500', access_token: c.accessToken,
      }).toString();
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) } as any);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) return '';
      const map = new Map<string, { spend: number; conv: number }>();
      for (const r of (data.data || [])) {
        const k = String(r.country || '其他');
        const v = map.get(k) || { spend: 0, conv: 0 };
        v.spend += Number(r.spend) || 0;
        v.conv += pickConversions(r.actions, c.conversionAction);
        map.set(k, v);
      }
      return [...map.entries()]
        .filter(([, v]) => v.spend > 0)
        .map(([k, v]) => `${k}:${(v.conv * 520 / v.spend).toFixed(1)}`)
        .slice(0, 8).join(', ');
    } catch {
      return '';
    }
  }

  /** Graph API 同步：按天 upsert 到 ads_daily，按汇率换算成人民币。 */
  async sync(body: { since?: string; until?: string }, user: AuthUser, ctx: AuditCtx) {
    const c = await this.cfg();
    if (!c?.accessToken || !c.accountId) throw new BadRequestException('尚未配置 Meta Token 或广告账户 ID，请先到「系统设置 → Meta 投流」配置');
    const until = body.until || new Date().toISOString().slice(0, 10);
    const since = body.since || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    let rows: any[];
    try {
      rows = await this.fetchInsights(c, since, until);
    } catch (e: any) {
      throw new BadRequestException(`Meta 接口拉取失败：${e?.message || e}`);
    }
    if (!rows.length) return { ok: true, added: 0, updated: 0, skipped: 0, since, until, message: '该时间段没有投放数据' };
    const countries = await this.fetchCountries(c, since, until);
    const existing = await db.select().from(schema.bizRecords).where(eq(schema.bizRecords.bizType, 'ads_daily'));
    const index = new Map<string, any>();
    for (const r of existing) {
      let p: any = {}; try { p = JSON.parse(r.payload || '{}'); } catch { /* ignore */ }
      if ((p.platform || 'meta') === 'meta') index.set(String(p.date || ''), r);
    }
    let added = 0, updated = 0;
    for (const r of rows) {
      const date = String(r.date_start || '').slice(0, 10);
      if (!date) continue;
      const spendUsd = Number(r.spend) || 0;
      const conv = pickConversions(r.actions, c.conversionAction);
      const payload = {
        platform: 'meta', date,
        spend: Number((spendUsd * c.exchangeRate).toFixed(2)),
        spendUsd, currency: 'USD', exchangeRate: c.exchangeRate,
        imp: Number(r.impressions) || 0,
        reach: Number(r.reach) || 0,
        clicks: Number(r.clicks) || 0,
        conv, countries,
        costPerResult: conv ? Number((spendUsd / conv).toFixed(2)) : 0,
        source: 'api', syncedAt: Date.now(),
      };
      const hit = index.get(date);
      if (hit) {
        await db.update(schema.bizRecords).set({ payload: JSON.stringify(payload), title: `Meta ${date}`, updatedAt: Date.now() }).where(eq(schema.bizRecords.id, hit.id));
        updated++;
      } else {
        const id = newId('biz');
        await db.insert(schema.bizRecords).values({
          id, tenantId: user.tenantId || '', storeId: '', bizType: 'ads_daily',
          title: `Meta ${date}`, payload: JSON.stringify(payload), status: 'active',
          createdAt: Date.now(), updatedAt: Date.now(),
        });
        index.set(date, { id });
        added++;
      }
    }
    await this.audit.log(`同步 Meta 投流数据 ${added}+${updated} 条`, 'ads', ctx);
    return { ok: true, added, updated, since, until, rate: c.exchangeRate };
  }

  /** CSV 导入：支持 Ads Manager 导出格式，按日期聚合后 upsert。 */
  async importCsv(body: { csv?: string; exchangeRate?: number | string }, user: AuthUser, ctx: AuditCtx) {
    const text = String(body.csv || '').replace(/^\uFEFF/, '').trim();
    if (!text) throw new BadRequestException('CSV 内容为空');
    const c = await this.cfg();
    const rate = Number(body.exchangeRate) > 0 ? Number(body.exchangeRate) : (c?.exchangeRate || 7.2);
    const lines = parseCsv(text);
    if (lines.length < 2) throw new BadRequestException('CSV 至少需要表头和一行数据');
    const head = lines[0].map((h) => normalizeHeader(h));
    const col = (names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
    const iDate = col(['date', '日期', 'report start', 'start']);
    const iSpend = col(['amount spent', 'spend', '花费', '花费金额', 'ad spend']);
    const iImp = col(['impressions', '曝光']);
    const iClick = col(['clicks', '点击']);
    const iConv = col(['results', 'conversions', '转化', '结果']);
    const iReach = col(['reach', '覆盖', '触达']);
    const iCountry = col(['country', '国家', '地区']);
    if (iDate < 0 || iSpend < 0) throw new BadRequestException('未找到「日期」或「花费」列，请确认是 Ads Manager 导出的 CSV');
    const agg = new Map<string, { spend: number; imp: number; clicks: number; conv: number; reach: number; countries: Map<string, number> }>();
    for (const line of lines.slice(1)) {
      const date = parseDate(line[iDate] || '');
      if (!date) continue;
      const v = agg.get(date) || { spend: 0, imp: 0, clicks: 0, conv: 0, reach: 0, countries: new Map() };
      v.spend += parseNum(line[iSpend]);
      v.imp += parseNum(line[iImp]);
      v.clicks += parseNum(line[iClick]);
      v.conv += parseNum(line[iConv]);
      v.reach += parseNum(line[iReach]);
      if (iCountry >= 0) {
        const k = String(line[iCountry] || '').trim();
        if (k) v.countries.set(k, (v.countries.get(k) || 0) + parseNum(line[iSpend]));
      }
      agg.set(date, v);
    }
    if (!agg.size) throw new BadRequestException('没有解析到有效日期行');
    const existing = await db.select().from(schema.bizRecords).where(eq(schema.bizRecords.bizType, 'ads_daily'));
    const index = new Map<string, any>();
    for (const r of existing) {
      let p: any = {}; try { p = JSON.parse(r.payload || '{}'); } catch { /* ignore */ }
      if ((p.platform || 'meta') === 'meta') index.set(String(p.date || ''), r);
    }
    let added = 0, updated = 0;
    for (const [date, v] of agg.entries()) {
      const payload = {
        platform: 'meta', date,
        spend: Number((v.spend * rate).toFixed(2)), spendUsd: v.spend, currency: 'USD', exchangeRate: rate,
        imp: v.imp, reach: v.reach, clicks: v.clicks, conv: v.conv,
        countries: [...v.countries.entries()].map(([k, s]) => `${k}:${(v.conv * 520 / (s || 1)).toFixed(1)}`).slice(0, 8).join(', '),
        costPerResult: v.conv ? Number((v.spend / v.conv).toFixed(2)) : 0,
        source: 'csv', syncedAt: Date.now(),
      };
      const hit = index.get(date);
      if (hit) {
        await db.update(schema.bizRecords).set({ payload: JSON.stringify(payload), updatedAt: Date.now() }).where(eq(schema.bizRecords.id, hit.id));
        updated++;
      } else {
        await db.insert(schema.bizRecords).values({
          id: newId('biz'), tenantId: user.tenantId || '', storeId: '', bizType: 'ads_daily',
          title: `Meta ${date}`, payload: JSON.stringify(payload), status: 'active',
          createdAt: Date.now(), updatedAt: Date.now(),
        });
        added++;
      }
    }
    await this.audit.log(`导入 Meta CSV ${added}+${updated} 天`, 'ads', ctx);
    return { ok: true, added, updated, days: agg.size, rate };
  }
}

function normalizeHeader(h: string) { return String(h || '').toLowerCase().replace(/[\s_"']/g, ''); }
function parseNum(v: any) { const n = Number(String(v ?? '').replace(/[¥$,%\s,]/g, '')); return Number.isFinite(n) ? n : 0; }
function parseDate(v: any) {
  const s = String(v || '').trim();
  if (!s) return '';
  let m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return '';
}

/** 轻量 CSV 解析：支持引号包裹、字段内逗号、换行。 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}
