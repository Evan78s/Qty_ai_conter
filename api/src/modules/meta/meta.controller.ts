import { Controller, Get, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RequirePerm } from '../../common/decorators/require-perm.decorator';
import { PERM } from '../../common/constants';
import type { AuthUser } from '../../common/context';
import type { AuditCtx } from '../../common/audit.service';
import { MetaService } from './meta.service';

@Controller('api/meta')
@UseGuards(AuthGuard)
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  private ctx(req: Request): AuditCtx {
    const u = (req as any).authUser;
    return { userId: u?.id, tenantId: u?.tenantId, storeId: u?.storeId, ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Get('config')
  config() { return this.meta.getConfig(); }

  @Post('config')
  @HttpCode(200)
  @RequirePerm('system', PERM.EDIT)
  save(@Req() req: Request, @Body() body: any) {
    return this.meta.saveConfig(body, (req as any).authUser as AuthUser, this.ctx(req));
  }

  @Post('test')
  @HttpCode(200)
  @RequirePerm('ads', PERM.EDIT)
  test(@Req() req: Request) {
    return this.meta.test((req as any).authUser as AuthUser, this.ctx(req));
  }

  @Post('probe')
  @HttpCode(200)
  @RequirePerm('ads', PERM.EDIT)
  probe(@Req() req: Request) {
    return this.meta.probe((req as any).authUser as AuthUser, this.ctx(req));
  }

  @Post('sync')
  @HttpCode(200)
  @RequirePerm('ads', PERM.EDIT)
  sync(@Req() req: Request, @Body() body: { since?: string; until?: string }) {
    return this.meta.sync(body, (req as any).authUser as AuthUser, this.ctx(req));
  }

  @Post('import')
  @HttpCode(200)
  @RequirePerm('ads', PERM.EDIT)
  importCsv(@Req() req: Request, @Body() body: { csv?: string; exchangeRate?: number | string }) {
    return this.meta.importCsv(body, (req as any).authUser as AuthUser, this.ctx(req));
  }
}
