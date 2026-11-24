import {
  Controller, Get, Post, Body, Query, Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';
import { PERM } from '../../common/constants';
import { AuthUser } from '../../common/context';
import { FeishuService } from '../../common/feishu.service';
import { decrypt } from '../../common/crypto';
import { newId } from '../../db/schema';
import { AuditService } from '../../common/audit.service';
import { getDefaultSkill } from '../../common/skill-presets';

const DEFAULT_SKILL = getDefaultSkill('reconcile');

/** 对账：读取/写入飞书「门店每日台账」，并提供调用管理员配置 Skill 的 Agent 对话。 */
@Controller('api/reconcile')
@UseGuards(AuthGuard)
export class ReconcileController {
  constructor(private readonly feishu: FeishuService, private readonly audit: AuditService) {}

  private async binding(storeId?: string) {
    const sid = !storeId || storeId === 'all' ? '' : String(storeId);
    const rows = await db.select().from(schema.storeFeishuBindings);
    if (sid) {
      const hit = rows.find((r) => r.storeId === sid);
      if (!hit) throw new BadRequestException('当前门店尚未绑定飞书多维表格，请先在「系统设置 → 门店表格绑定」中添加');
      return hit;
    }
    const hit = rows.find((r) => r.status === 'active');
    if (!hit) throw new BadRequestException('尚未绑定任何飞书多维表格，请先在「系统设置 → 门店表格绑定」中添加');
    return hit;
  }

  /** 列出该门店多维表格的子表，供后台选择「门店每日台账」。 */
  @Get('tables')
  @RequirePerm('reconcile', PERM.VIEW)
  async tables(@Query('storeId') storeId?: string) {
    const binding = await this.binding(storeId);
    const tables = await this.feishu.listTables(binding);
    const ids = (() => { try { return JSON.parse(binding.tableIds || '{}'); } catch { return {}; } })();
    return {
      ok: true,
      appToken: binding.appToken,
      suggestedId: ids.ledger || tables.find((t) => t.name.includes('门店每日台账'))?.tableId || '',
      tables,
    };
  }

  /** 读取「门店每日台账」内容。 */
  @Get('remote')
  @RequirePerm('reconcile', PERM.VIEW)
  async remote(@Query('storeId') storeId?: string) {
    const binding = await this.binding(storeId);
    const tableId = await this.feishu.resolveLedgerTable(binding);
    const items = await this.feishu.listRecords(binding, tableId);
    return {
      ok: true,
      appToken: binding.appToken,
      tableId,
      records: items.map((r: any) => ({ recordId: r.record_id, fields: r.fields || {} })),
    };
  }

  /** Agent 对话：使用管理员在「AI 模型与密钥 → 场景」里配置的「对账核对」Skill 提示词。 */
  @Post('agent')
  @RequirePerm('reconcile', PERM.EDIT)
  async agent(@Req() req: Request, @Body() body: {
    storeId?: string; messages?: { role: 'user' | 'assistant'; content: string }[]; text?: string;
  }) {
    const user = (req as any).authUser as AuthUser;
    const history = (body.messages || []).slice(-20)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    const text = (body.text || '').trim();
    if (!history.length && !text) throw new BadRequestException('请粘贴对账文本或输入问题');

    // 管理员统一配置的 Skill：场景 reconcile 的 system_prompt，未配置则用内置默认。
    const [scene] = await db.select().from(schema.aiScenes).where(eq(schema.aiScenes.sceneCode, 'reconcile')).limit(1);
    const system = (scene as any)?.systemPrompt || DEFAULT_SKILL;
    const cfg = (await db.select().from(schema.aiConfigs))
      .find((c: any) => c.scope === 'platform' && c.apiKeyEnc)
      || (await db.select().from(schema.aiConfigs)).find((c: any) => c.isDefault && c.apiKeyEnc);
    if (!cfg?.apiKeyEnc) throw new BadRequestException('尚未配置系统全局 AI Key，请到「AI 模型与密钥」页配置');
    let apiKey: string;
    try { apiKey = decrypt(cfg.apiKeyEnc); } catch { throw new BadRequestException('密钥解密失败，请重新保存全局 Key'); }
    const base = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const messages = history.length ? history : [{ role: 'user' as const, content: text }];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: (scene as any)?.modelOverride || cfg.model || 'deepseek-chat',
          messages: [{ role: 'system', content: system }, ...messages],
        }),
        signal: AbortSignal.timeout(60000),
      } as any);
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`HTTP ${res.status} ${data?.error?.message || ''}`);
      const content = data?.choices?.[0]?.message?.content || '（模型未返回内容）';
      await this.audit.log('对账 Agent 对话', 'reconcile', { userId: user.id, storeId: body.storeId, ip: req.ip });
      return { ok: true, content, model: (scene as any)?.modelOverride || cfg.model };
    } catch (e: any) {
      throw new BadRequestException(`AI 处理失败：${e?.message || e}`);
    }
  }

  /** 确认保存：同时写本地 MySQL 与飞书「门店每日台账」。 */
  @Post('sync')
  @RequirePerm('reconcile', PERM.EDIT)
  async sync(@Req() req: Request, @Body() body: {
    storeId?: string; date: string; revenue?: string | number;
    fields?: Record<string, any>; result?: string; text?: string; hasImage?: boolean;
  }) {
    const user = (req as any).authUser as AuthUser;
    if (!body.date) throw new BadRequestException('请填写对账日期');
    const storeId = !body.storeId || body.storeId === 'all' ? '' : body.storeId;
    const payload: any = {
      date: body.date,
      revenue: body.revenue || '',
      fields: body.fields || {},
      result: body.result || '通过',
      text: (body.text || '').slice(0, 20000),
      hasImage: !!body.hasImage,
    };
    const id = newId('rec');
    await db.insert(schema.bizRecords).values({
      id, tenantId: user.tenantId || '', storeId, bizType: 'reconcile',
      title: `对账 ${body.date}`, payload: JSON.stringify(payload),
      status: 'active', createdAt: Date.now(), updatedAt: Date.now(),
    });

    let feishuRecordId = '';
    let syncError = '';
    try {
      const binding = await this.binding(storeId);
      const tableId = await this.feishu.resolveLedgerTable(binding);
      const [store] = storeId
        ? await db.select().from(schema.stores).where(eq(schema.stores.id, storeId)).limit(1)
        : [];
      const fields: Record<string, any> = {
        日期: body.date,
        门店: store?.name || '全部门店',
        总营业额: body.revenue || '',
        核对结果: body.result || '通过',
        备注: (body.text || '').slice(0, 2000),
        ...(body.fields || {}),
      };
      feishuRecordId = await this.feishu.createRecord(binding, tableId, fields);
    } catch (e: any) {
      syncError = e?.message || '飞书写入失败';
    }
    payload.feishuRecordId = feishuRecordId;
    payload.syncError = syncError;
    await db.update(schema.bizRecords).set({ payload: JSON.stringify(payload) }).where(eq(schema.bizRecords.id, id));
    await this.audit.log('保存对账并同步飞书', 'reconcile', { userId: user.id, storeId, ip: req.ip }, syncError ? 'failed' : 'success', id);
    return { ok: true, id, feishuRecordId, syncError };
  }
}
