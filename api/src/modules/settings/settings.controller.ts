import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SettingsService } from './settings.service';
import type { AuditCtx } from '../../common/audit.service';

@Controller('api/settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  private ctx(req: Request): AuditCtx {
    const u = (req as any).authUser;
    return { userId: u?.id, tenantId: u?.tenantId, storeId: u?.storeId, ip: req.ip, userAgent: req.headers['user-agent'] };
  }
  private user(req: Request) { return (req as any).authUser; }

  /* 飞书凭证 */
  @Get('integrations/feishu')
  listIntegrations(@Req() req: Request) { return this.settings.listIntegrations(this.ctx(req)); }

  @Post('integrations/feishu')
  @HttpCode(200)
  saveCredential(@Req() req: Request, @Body() body: any) {
    return this.settings.saveFeishuCredential(body, this.user(req), this.ctx(req));
  }

  @Delete('integrations/feishu/:id')
  deleteCredential(@Req() req: Request, @Param('id') id: string) {
    return this.settings.deleteCredential(id, this.user(req), this.ctx(req));
  }

  /* 门店 base 绑定 */
  @Get('bindings')
  listBindings(@Req() req: Request) { return this.settings.listBindings(); }

  @Get('stores')
  listStores(@Req() req: Request) { return this.settings.listStores(); }

  @Post('bindings')
  @HttpCode(200)
  saveBinding(@Req() req: Request, @Body() body: any) {
    return this.settings.saveBinding(body, this.user(req), this.ctx(req));
  }

  @Delete('bindings/:id')
  deleteBinding(@Req() req: Request, @Param('id') id: string) {
    return this.settings.deleteBinding(id, this.user(req), this.ctx(req));
  }

  /* 品牌 */
  @Get('brand')
  getBrand() { return this.settings.getBrand(); }

  @Post('brand')
  @HttpCode(200)
  saveBrand(@Req() req: Request, @Body() body: any) {
    return this.settings.saveBrand(body, this.user(req), this.ctx(req));
  }

  /* 数据库状态 */
  @Get('database')
  dbStatus() { return this.settings.dbStatus(); }
}
