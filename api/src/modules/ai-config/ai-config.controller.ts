import {
  Controller, Get, Post, Patch, Param, Body, Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../db';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthUser } from '../../common/context';
import { PERM } from '../../common/constants';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';
import { AuditService } from '../../common/audit.service';
import { newId } from '../../db/schema';
import { encrypt, decrypt, maskSecret } from '../../common/crypto';

/** AI 模型与密钥：全局配置 + 场景绑定，Key 加密存储，测试连接走后端代理不暴露 Key。 */
@Controller('api/ai-config')
@UseGuards(AuthGuard)
export class AiConfigController {
  constructor(private audit: AuditService) {}

  @Get()
  async get(@Req() req: Request) {
    const user = (req as any).authUser as AuthUser;
    const all = await db.select().from(schema.aiConfigs);
    const global = all.find((c) => c.scope === 'platform') || all.find((c) => c.isDefault);
    const personal = all.find((c) => c.scope === 'user' && c.scopeId === user.id);
    const scenes = await db.select().from(schema.aiScenes);
    const mask = (c: any) => c ? ({
      provider: c.provider, baseUrl: c.baseUrl, model: c.model, temperature: c.temperature,
      apiKeyMasked: c.apiKeyEnc ? maskSecret(decrypt(c.apiKeyEnc)) : '', hasKey: !!c.apiKeyEnc,
    }) : null;
    return {
      ok: true,
      global: mask(global),
      personal: mask(personal),
      scenes: scenes.map((s) => ({
        code: s.sceneCode, name: s.name, model: s.modelOverride,
        temperature: s.temperature, enabled: s.enabled,
      })),
      canEditGlobal: user.isSuper,
    };
  }

  /** 保存全局默认配置（仅超管）。 */
  @Post('global')
  @RequirePerm('system', PERM.EDIT)
  async saveGlobal(@Req() req: Request, @Body() body: {
    provider: string; baseUrl?: string; model: string; temperature?: string; apiKey?: string;
  }) {
    const user = (req as any).authUser as AuthUser;
    if (!user.isSuper) throw new BadRequestException('仅总管理员可修改全局配置');
    const all = await db.select().from(schema.aiConfigs);
    const existing = all.find((c) => c.scope === 'platform');
    const patch: any = {
      provider: body.provider, baseUrl: body.baseUrl || '', model: body.model,
      temperature: body.temperature || '0.3', isDefault: true,
    };
    if (body.apiKey) patch.apiKeyEnc = encrypt(body.apiKey);
    if (existing) await db.update(schema.aiConfigs).set(patch).where(eq(schema.aiConfigs.id, existing.id));
    else await db.insert(schema.aiConfigs).values({ id: newId('aic'), tenantId: user.tenantId || '', scope: 'platform', scopeId: '', ...patch, createdAt: Date.now() });
    await this.audit.log('保存全局 AI 配置', 'system', { userId: user.id, ip: req.ip });
    return { ok: true };
  }

  /** 保存个人自带 Key（优先级高于全局）。传空字符串清空。 */
  @Post('personal')
  @RequirePerm('system', PERM.EDIT)
  async savePersonal(@Req() req: Request, @Body() body: { apiKey: string; provider?: string; model?: string; baseUrl?: string }) {
    const user = (req as any).authUser as AuthUser;
    const all = await db.select().from(schema.aiConfigs);
    const existing = all.find((c) => c.scope === 'user' && c.scopeId === user.id);
    const patch: any = {
      provider: body.provider || 'deepseek', model: body.model || '', baseUrl: body.baseUrl || '',
      apiKeyEnc: body.apiKey ? encrypt(body.apiKey) : null, isDefault: false,
    };
    if (existing) await db.update(schema.aiConfigs).set(patch).where(eq(schema.aiConfigs.id, existing.id));
    else await db.insert(schema.aiConfigs).values({ id: newId('aic'), tenantId: user.tenantId || '', scope: 'user', scopeId: user.id, ...patch, createdAt: Date.now() });
    await this.audit.log('保存个人 AI Key', 'system', { userId: user.id, ip: req.ip });
    return { ok: true };
  }

  /** 更新场景绑定。 */
  @Patch('scene/:code')
  @RequirePerm('system', PERM.EDIT)
  async updateScene(@Req() req: Request, @Param('code') code: string, @Body() body: { model?: string; temperature?: string; enabled?: boolean }) {
    const user = (req as any).authUser as AuthUser;
    const [scene] = await db.select().from(schema.aiScenes).where(eq(schema.aiScenes.sceneCode, code)).limit(1);
    if (!scene) throw new BadRequestException('场景不存在');
    await db.update(schema.aiScenes).set({
      modelOverride: body.model ?? scene.modelOverride,
      temperature: body.temperature ?? scene.temperature,
      enabled: body.enabled ?? scene.enabled,
    }).where(eq(schema.aiScenes.sceneCode, code));
    await this.audit.log('更新 AI 场景绑定', 'system', { userId: user.id, ip: req.ip });
    return { ok: true, code };
  }

  /** 通用文本生成代理：用已保存的 Key 调 OpenAI 兼容 chat 接口（文案/脚本/解读等）。 */
  @Post('chat')
  @RequirePerm('social', PERM.EDIT)
  async chat(@Req() req: Request, @Body() body: { prompt: string; system?: string; scene?: string }) {
    const user = (req as any).authUser as AuthUser;
    if (!body.prompt?.trim()) throw new BadRequestException('提示词不能为空');
    const all = await db.select().from(schema.aiConfigs);
    // 优先个人 Key，其次全局
    const cfg = all.find((c) => c.scope === 'user' && c.scopeId === user.id && c.apiKeyEnc)
      || all.find((c) => c.scope === 'platform' && c.apiKeyEnc)
      || all.find((c) => c.isDefault && c.apiKeyEnc);
    if (!cfg?.apiKeyEnc) throw new BadRequestException('尚未配置 AI Key，请先到「AI 模型与密钥」页配置全局或个人 Key');
    let apiKey: string;
    try { apiKey = decrypt(cfg.apiKeyEnc); } catch { throw new BadRequestException('密钥解密失败，请重新保存 Key'); }
    const base = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    let model = cfg.model || 'deepseek-chat';
    if (body.scene) {
      const [scene] = await db.select().from(schema.aiScenes).where(eq(schema.aiScenes.sceneCode, body.scene)).limit(1);
      if (scene?.modelOverride) model = scene.modelOverride;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: body.system || '你是养生馆连锁品牌的运营助手，输出专业、简洁、可直接使用的中文内容。' },
            { role: 'user', content: body.prompt },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      } as any);
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${err.slice(0, 200)}`);
      }
      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      await this.audit.log('AI 内容生成', 'social', { userId: user.id, ip: req.ip });
      return { ok: true, content, model };
    } catch (e: any) {
      throw new BadRequestException(`生成失败：${e?.message || e}`);
    }
  }

  /** 测试连接：后端用已保存的 Key 调一次 OpenAI 兼容 chat 接口，不把 Key 返回前端。 */
  @Post('test')
  @RequirePerm('system', PERM.EDIT)
  async test(@Req() req: Request, @Body() body: { which?: 'global' | 'personal' }) {
    const user = (req as any).authUser as AuthUser;
    const all = await db.select().from(schema.aiConfigs);
    const cfg = body.which === 'personal'
      ? all.find((c) => c.scope === 'user' && c.scopeId === user.id)
      : (all.find((c) => c.scope === 'platform') || all.find((c) => c.isDefault));
    if (!cfg?.apiKeyEnc) throw new BadRequestException('尚未配置 API Key，请先在上方保存 Key 后再测试');
    let apiKey: string;
    try { apiKey = decrypt(cfg.apiKeyEnc); } catch { throw new BadRequestException('密钥解密失败，请重新保存 Key'); }
    const base = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/$/, '');
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: cfg.model || 'deepseek-chat', messages: [{ role: 'user', content: 'ping' }], max_tokens: 4 }),
        signal: AbortSignal.timeout(12000),
      } as any);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, provider: cfg.provider, model: cfg.model };
    } catch (e: any) {
      throw new BadRequestException(`连接失败：${e?.message || e}`);
    }
  }
}
