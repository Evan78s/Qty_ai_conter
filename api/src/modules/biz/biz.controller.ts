import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { resolveStoreIds } from '../../common/scoped-repo';
import { AuditService } from '../../common/audit.service';
import { newId } from '../../db/schema';
import { PERM } from '../../common/constants';

/**
 * 通用业务数据接口：把各功能模块的本地真实数据统一落到 biz_records 表。
 * biz_type 决定模块归属与所需权限；store_id 支持门店隔离（'' = 公司级，仅超管可写）。
 */
const TYPE_MODULE: Record<string, string> = {
  kb: 'service', service_reply: 'service', service_queue: 'service', push_config: 'service',
  reconcile: 'reconcile', price: 'store', material: 'social',
  social_post: 'social', social_reply: 'social', social_account: 'social',
  ads_account: 'ads', ads_daily: 'ads',
};
function moduleOf(type: string): string { return TYPE_MODULE[type] || 'system'; }

/**
 * payload 在库里是 text 列、存的是 JSON 字符串；前端一律按对象访问（r.payload.date 等）。
 * 这里在出口统一解析成对象——否则字符串没有 .date/.spend 属性，前端过滤会把所有行剔除，
 * 表现为「同步/录入成功、看板却始终无数据」。兼容历史脏数据：对象/空串/非法 JSON 都能吞。
 */
function parsePayload(raw: any): any {
  if (raw === null || raw === undefined || raw === '') return {};
  if (typeof raw === 'object') return raw;
  try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : {}; }
  catch { return {}; }
}

interface BizBody {
  storeId?: string;
  title?: string;
  payload?: any;
  status?: string;
}

@Controller('api/biz')
@UseGuards(AuthGuard)
export class BizController {
  constructor(private audit: AuditService) {}

  /** 外部能力配置状态：供前端判断"真调用"还是"引导去配置"。 */
  @Get('capabilities/status')
  async capabilities(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    const tenantId = user.tenantId || '';
    const integrations = await db.select().from(schema.integrations);
    const bindings = await db.select().from(schema.storeFeishuBindings);
    const aiConfigs = await db.select().from(schema.aiConfigs);
    const has = (type: string) => integrations.some((i) => i.type === type && (i.status === 'active'));
    const feishuBindingCount = bindings.filter((b) => !!b.appToken).length;
    const aiKeyCount = aiConfigs.filter((c) => !!c.apiKeyEnc).length;
    return {
      ok: true,
      capabilities: {
        feishu: { credentials: has('feishu') || has('feishu_default'), bindings: feishuBindingCount, enabled: has('feishu') && feishuBindingCount > 0 },
        ai: { keys: aiKeyCount, enabled: aiKeyCount > 0 },
        metaAds: { enabled: has('meta') },
        googleAds: { enabled: has('google') },
        xiaohongshu: { enabled: has('xiaohongshu') },
      },
    };
  }

  /** 列表：按 biz_type + 门店可见范围过滤。 */
  @Get(':type')
  async list(@Req() req: Request, @Param('type') type: string, @Query('storeId') storeId?: string) {
    const user = (req as any).authUser as AuthUser;
    const visible = await resolveStoreIds(user);
    const rows = await db.select().from(schema.bizRecords).where(eq(schema.bizRecords.bizType, type));
    return rows
      .filter((r) => {
        if (storeId !== undefined && storeId !== 'all' && r.storeId !== storeId) return false;
        // 公司级记录（''）全员可见；门店级记录需在该用户可见范围内
        return r.storeId === '' || visible.includes(r.storeId) || user.isSuper;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ ...r, payload: parsePayload(r.payload) }));
  }

  /** 新增。 */
  @Post(':type')
  async create(@Req() req: Request, @Param('type') type: string, @Body() body: BizBody) {
    const user = (req as any).authUser as AuthUser;
    this.assertCanEdit(user, type);
    this.assertWritable(user, body.storeId);
    const [company] = await db.select().from(schema.tenants).limit(1);
    const id = newId('biz');
    const now = Date.now();
    await db.insert(schema.bizRecords).values({
      id, tenantId: company?.id || user.tenantId || '', storeId: body.storeId || '',
      bizType: type, title: body.title || '', payload: JSON.stringify(body.payload ?? {}),
      status: body.status || 'active', createdAt: now, updatedAt: now,
    });
    await this.audit.log(`新增${type}`, moduleOf(type), { userId: user.id, storeId: body.storeId, ip: req.ip }, 'success', id);
    return { id, ...body, createdAt: now };
  }

  /** 编辑。 */
  @Patch(':type/:id')
  async update(@Req() req: Request, @Param('type') type: string, @Param('id') id: string, @Body() body: BizBody) {
    const user = (req as any).authUser as AuthUser;
    this.assertCanEdit(user, type);
    const [target] = await db.select().from(schema.bizRecords).where(eq(schema.bizRecords.id, id)).limit(1);
    if (!target || target.bizType !== type) throw new BadRequestException('记录不存在');
    this.assertWritable(user, target.storeId);
    await db.update(schema.bizRecords).set({
      title: body.title ?? target.title,
      payload: body.payload !== undefined ? JSON.stringify(body.payload) : target.payload,
      status: body.status ?? target.status,
      updatedAt: Date.now(),
    }).where(eq(schema.bizRecords.id, id));
    await this.audit.log(`编辑${type}`, moduleOf(type), { userId: user.id, storeId: target.storeId, ip: req.ip }, 'success', id);
    return { ok: true, id };
  }

  /** 删除。 */
  @Delete(':type/:id')
  async remove(@Req() req: Request, @Param('type') type: string, @Param('id') id: string) {
    const user = (req as any).authUser as AuthUser;
    this.assertCanEdit(user, type);
    const [target] = await db.select().from(schema.bizRecords).where(eq(schema.bizRecords.id, id)).limit(1);
    if (!target || target.bizType !== type) throw new BadRequestException('记录不存在');
    this.assertWritable(user, target.storeId);
    await db.delete(schema.bizRecords).where(eq(schema.bizRecords.id, id));
    await this.audit.log(`删除${type}`, moduleOf(type), { userId: user.id, storeId: target.storeId, ip: req.ip }, 'success', id);
    return { ok: true, id };
  }

  /** 按业务类型对应模块的 EDIT 权限校验（超管恒放行）。 */
  private assertCanEdit(user: AuthUser, type: string) {
    if (user.isSuper) return;
    const module = moduleOf(type);
    const have = user.permissions[module] || 0;
    if ((have & PERM.EDIT) !== PERM.EDIT) throw new ForbiddenException(`无权维护${module}模块数据`);
  }

  /** 公司级记录（storeId=''）仅超管可写；门店级记录须在可见范围内。 */
  private assertWritable(user: AuthUser, storeId?: string) {
    const sid = storeId || '';
    if (sid === '') {
      if (!user.isSuper) throw new ForbiddenException('仅总管理员可修改公司级数据');
      return;
    }
    if (!user.isSuper && !user.visibleStoreIds.includes(sid)) throw new ForbiddenException('无权操作该门店数据');
  }
}
