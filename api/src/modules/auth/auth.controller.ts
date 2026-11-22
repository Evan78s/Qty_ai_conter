import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { COOKIE_REFRESH, REFRESH_TTL_MS } from '../../common/constants';
import { AuthUser } from '../../common/context';

function ctx(req: Request) {
  return {
    ip: (req.headers['x-real-ip'] as string) || req.ip || '',
    userAgent: req.headers['user-agent'] || '',
    deviceId: (req.headers['x-device-id'] as string) || 'web',
  };
}

@Controller('api/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { username: string; password: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(body.username, body.password, ctx(res.req));
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[COOKIE_REFRESH] || (req.body as any)?.refreshToken;
    const result = await this.auth.refresh(token, ctx(req));
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[COOKIE_REFRESH];
    res.clearCookie(COOKIE_REFRESH, { path: '/api/auth' });
    return this.auth.logout(token);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async changePassword(@Req() req: Request, @Body() body: { oldPassword: string; newPassword: string }) {
    const user = (req as any).authUser as AuthUser;
    return this.auth.changePassword(user.id, body.oldPassword, body.newPassword, ctx(req));
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: Request) {
    return this.auth.me((req as any).authUser);
  }

  private setRefreshCookie(res: Response, token: string) {
    const prod = process.env.NODE_ENV === 'production';
    res.cookie(COOKIE_REFRESH, token, {
      httpOnly: true,
      secure: prod,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TTL_MS,
    });
  }
}
