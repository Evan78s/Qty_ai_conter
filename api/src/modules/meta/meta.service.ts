import { Injectable, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';
import { newId } from '../../db/schema';
import type { AuthUser } from '../../common/context';
import type { AuditCtx } from '../../common/audit.service';
import { AuditService } from '../../common/audit.service';

// 使用较新的稳定版本。v21.0 已较旧，Meta 自 2026-07 起启用 Marketing API 自动升级，
// 老版本 insights 的字段/行为可能已变化，导致「测试连接正常但 insights 为空」。
const GRAPH = 'https://graph.facebook.com/v24.0';

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

/**
 * 转化事件优先级组。关键教训：同一次咨询会被 Meta 记成多种 action_type
 * （total_messaging_connection / messaging_first_reply / messaging_conversation_started_7d 等），
 * 它们高度重叠——组内能取「最大值」，绝不能累加；组间命中即止，避免重复计数。
 * 更绝不能把 link_click / post_engagement / video_view 这类互动噪音当转化。
 */
const CONV_GROUPS: { key: string; label: string; match: (t: string) => boolean }[] = [
  { key: 'purchase', label: '购买', match: (t) => t === 'purchase' || t === 'omni_purchase' || t.endsWith('.fb_pixel_purchase') },
  { key: 'lead', label: '线索', match: (t) => t === 'lead' || t === 'onsite_conversion.lead' },
  // 私信咨询 / 本地生活留资：养生馆这类账户的核心转化
  { key: 'messaging', label: '私信咨询', match: (t) => t === 'onsite_conversion.total_messaging_connection' || t.startsWith('onsite_conversion.messaging_') || t === 'onsite_conversion.post_net_message' },
  { key: 'registration', label: '注册', match: (t) => t === 'complete_registration' },
];

export interface ConvPick {
  conv: number;
  event: string;
  label: string;
  candidates: Record<string, number>;
}

/**
 * 从 actions 挑出真实转化数。返回采用的事件与各候选计数，便于前端核对「转化口径」。
 * 顺序：用户指定事件优先 → 优先级组（组内取最大、组间命中即止）→ 兜底 0（绝不全加）。
 */
function pickConversions(actions: any[] | undefined, preferred: string): ConvPick {
  const empty: ConvPick = { conv: 0, event: '', label: '', candidates: {} };
  if (!Array.isArray(actions)) return empty;
  const candidates: Record<string, number> = {};
  for (const a of actions) {
    const t = String(a?.action_type || '');
    if (!t) continue;
    candidates[t] = (candidates[t] || 0) + (Number(a?.value) || 0);
  }
  // 用户明确指定的事件优先（精确匹配；其次按后缀匹配 fb_pixel_xxx）
  if (preferred) {
    let v = candidates[preferred] || 0;
    if (!v) for (const [k, n] of Object.entries(candidates)) if (k.endsWith('.' + preferred)) v += n;
    if (v > 0) return { conv: v, event: preferred, label: '自定义事件', candidates };
  }
  // 优先级组：组内取最大值，组间命中即止
  for (const g of CONV_GROUPS) {
    const members = Object.keys(candidates).filter((k) => g.match(k));
    if (!members.length) continue;
    const max = Math.max(0, ...members.map((k) => candidates[k]));
    if (max > 0) {
      const event = members.reduce((best, k) => (candidates[k] > candidates[best] ? k : best), members[0]);
      return { conv: max, event, label: g.label, candidates };
    }
  }
  // 没有任何可识别的转化事件 → 0，绝不把互动/播放数据加起来冒充转化
  return { conv: 0, event: '', label: '未识别到转化事件', candidates };
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

  /**
   * 诊断：把 Graph API 的原始响应透传出来，用于排查「测试连接正常但看板无数据」。
   * 分别请求账户信息、最简 insights、带 actions 的完整 insights，记录每步的 URL/状态/原始错误。
   */
  async probe(user: AuthUser, ctx: AuditCtx) {
    const c = await this.cfg();
    if (!c?.accessToken || !c.accountId) throw new BadRequestException('尚未配置 Meta Token 或广告账户 ID');
    const act = normalizeAct(c.accountId);
    const until = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const token = c.accessToken;
    const mask = (u: string) => u.replace(/access_token=[^&]+/, 'access_token=***');

    const call = async (label: string, url: string) => {
      const started = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) } as any);
        const rawText = await res.text();
        let data: any; try { data = JSON.parse(rawText); } catch { data = { raw: rawText.slice(0, 500) }; }
        const rows = Array.isArray(data?.data) ? data.data : [];
        return {
          label, ok: res.ok, status: res.status, url: mask(url),
          rowCount: rows.length,
          sample: rows.slice(0, 2),
          rawError: data?.error ? { message: data.error.message, code: data.error.code, type: data.error.type, subcode: data.error.error_subcode, fbtrace_id: data.error.fbtrace_id } : null,
          elapsedMs: Date.now() - started,
        };
      } catch (e: any) {
        return { label, ok: false, status: 0, url: mask(url), rowCount: 0, sample: [], rawError: { message: e?.message || String(e) }, elapsedMs: Date.now() - started };
      }
    };

    const accountUrl = `${GRAPH}/${act}?fields=name,account_status,currency,timezone_name&access_token=${encodeURIComponent(token)}`;
    const insightBase = `${GRAPH}/${act}/insights?` + new URLSearchParams({
      level: 'account', time_range: JSON.stringify({ since, until }), limit: '5', access_token: token,
    }).toString();
    const insightMinimal = `${GRAPH}/${act}/insights?` + new URLSearchParams({
      level: 'account', time_increment: '1', time_range: JSON.stringify({ since, until }),
      fields: 'date_start,spend,impressions,clicks', limit: '5', access_token: token,
    }).toString();
    const insightFull = `${GRAPH}/${act}/insights?` + new URLSearchParams({
      level: 'account', time_increment: '1', time_range: JSON.stringify({ since, until }),
      fields: 'date_start,spend,impressions,reach,clicks,actions', limit: '5', access_token: token,
    }).toString();
    const insightCountry = `${GRAPH}/${act}/insights?` + new URLSearchParams({
      level: 'account', breakdowns: 'country', time_range: JSON.stringify({ since, until }),
      // country 由 breakdowns 返回，不能写进 fields（新版 API 会报 #100）
      fields: 'spend,clicks,actions', limit: '5', access_token: token,
    }).toString();

    const checks = await Promise.all([
      call('账户信息', accountUrl),
      call('insights-最简(无time_increment/无字段)', insightBase),
      call('insights-按天(基础字段)', insightMinimal),
      call('insights-按天(含reach/actions)', insightFull),
      call('insights-按国家(breakdowns=country)', insightCountry),
    ]);
    // 从含 actions 的样本里直接算出转化口径，诊断时一眼可见「转化到底取的哪个事件」
    const fullCheck = checks.find((c) => c.label.includes('actions'));
    const convAnalysis = fullCheck?.sample?.length
      ? fullCheck.sample.map((s: any) => pickConversions(s?.actions, c.conversionAction))
          .map((p: ConvPick) => ({ event: p.event, label: p.label, conv: p.conv, candidates: p.candidates }))
      : [];
    await this.audit.log('Meta 连接诊断', 'system', ctx);
    return {
      ok: true, version: GRAPH, accountId: act, since, until, checks,
      configuredEvent: c.conversionAction || '', convAnalysis,
    };
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

  /**
   * 按国家取花费与转化，供「投放国家/地区表现」使用；失败不影响主流程。
   * 不同账户对 breakdowns=country 的字段组合支持不一，逐套尝试直到拿到数据。
   */
  private async fetchCountries(c: MetaConfig, since: string, until: string): Promise<string> {
    const base: any = {
      level: 'account', breakdowns: 'country',
      time_range: JSON.stringify({ since, until }),
      limit: '500', access_token: c.accessToken,
    };
    // 关键：新版 Graph API 下 country 由 breakdowns 返回，不能再写进 fields，
    // 否则报 "(#100) country is not valid for fields param"。fields 里只放指标。
    const variants = [
      { ...base, fields: 'spend,clicks,actions' },
      { ...base, fields: 'spend,impressions,clicks' },
      { ...base, fields: 'spend', time_increment: '1' },
      { ...base, fields: 'spend' },
    ];
    for (const params of variants) {
      try {
        const url = `${GRAPH}/${normalizeAct(c.accountId)}/insights?` + new URLSearchParams(params).toString();
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) } as any);
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) continue;
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!list.length) continue;
        const map = new Map<string, { spend: number; conv: number }>();
        for (const r of list) {
          const k = String(r.country || '其他');
          const v = map.get(k) || { spend: 0, conv: 0 };
          v.spend += Number(r.spend) || 0;
          v.conv += pickConversions(r.actions, c.conversionAction).conv;
          map.set(k, v);
        }
        const out = [...map.entries()]
          .filter(([, v]) => v.spend > 0)
          .map(([k, v]) => `${k}:${(v.conv * 520 / v.spend).toFixed(1)}`)
          .slice(0, 8).join(', ');
        if (out) return out;
      } catch { /* 尝试下一套 */ }
    }
    return '';
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
    if (!rows.length) return {
      ok: true, added: 0, updated: 0, skipped: 0, since, until, rawRows: 0,
      message: `Meta 接口在 ${since} ~ ${until} 返回 0 条数据。可点「诊断 Meta」查看原始响应，确认是账户无消耗、日期范围还是权限/版本问题。`,
    };
    const countries = await this.fetchCountries(c, since, until);
    const existing = await db.select().from(schema.bizRecords).where(eq(schema.bizRecords.bizType, 'ads_daily'));
    const index = new Map<string, any>();
    for (const r of existing) {
      let p: any = {}; try { p = JSON.parse(r.payload || '{}'); } catch { /* ignore */ }
      if ((p.platform || 'meta') === 'meta') index.set(String(p.date || ''), r);
    }
    let added = 0, updated = 0;
    const convEvents = new Set<string>();       // 本次实际采用的转化事件，供前端核对口径
    for (const r of rows) {
      const date = String(r.date_start || '').slice(0, 10);
      if (!date) continue;
      const spendUsd = Number(r.spend) || 0;
      const pick = pickConversions(r.actions, c.conversionAction);
      const conv = pick.conv;
      if (pick.event) convEvents.add(`${pick.event}（${pick.label}）`);
      const payload = {
        platform: 'meta', date,
        spend: Number((spendUsd * c.exchangeRate).toFixed(2)),
        spendUsd, currency: 'USD', exchangeRate: c.exchangeRate,
        imp: Number(r.impressions) || 0,
        reach: Number(r.reach) || 0,
        clicks: Number(r.clicks) || 0,
        conv, countries,
        // 转化口径透明化：采用的事件 + 所有候选计数，便于核对「转化是否算对」
        convEvent: pick.event, convLabel: pick.label, convCandidates: pick.candidates,
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
    return {
      ok: true, added, updated, rawRows: rows.length, since, until, rate: c.exchangeRate,
      convEvents: [...convEvents], configuredEvent: c.conversionAction || '',
    };
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
