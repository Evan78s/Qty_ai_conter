/**
 * 安装守卫：系统未安装时，只允许 /api/setup/* 与 /api/health，其余接口返回 503。
 * 这样未配库也能启动进入安装向导；装完写入 install.json 后立即放行。
 */
import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isInstalled } from '../../runtime-config';

@Injectable()
export class InstallGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (isInstalled()) return true;
    const req = ctx.switchToHttp().getRequest<{ path: string; url: string }>();
    const url = req.url || req.path || '';
    if (url.includes('/api/setup/') || url.includes('/api/health')) return true;
    throw new ServiceUnavailableException('系统尚未初始化，请完成安装向导');
  }
}
