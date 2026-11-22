import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from '../context';
import { PERM } from '../constants';

export const PERM_KEY = 'perm';
export const MODULE_KEY = 'module';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const need = this.reflector.get<number>(PERM_KEY, ctx.getHandler());
    const module = this.reflector.get<string>(MODULE_KEY, ctx.getHandler());
    if (need === undefined) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = (req as any).authUser as AuthUser;
    if (!user) throw new ForbiddenException('无权限');
    if (user.isSuper) return true;
    const have = user.permissions[module || ''] || 0;
    if ((have & need) !== need) throw new ForbiddenException('无权限执行此操作');
    return true;
  }
}
