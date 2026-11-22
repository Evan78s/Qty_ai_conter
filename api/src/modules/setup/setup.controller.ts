import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { SetupService, TestDbDto, InstallDto } from './setup.service';

/** 安装向导：公开接口，无需登录（未安装时系统只有这些接口可用）。 */
@Controller('api/setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('status')
  status() { return this.setup.status(); }

  @Post('test-db')
  @HttpCode(200)
  testDb(@Body() body: TestDbDto) { return this.setup.testDb(body); }

  @Post('install')
  @HttpCode(200)
  install(@Body() body: InstallDto) { return this.setup.install(body); }
}
