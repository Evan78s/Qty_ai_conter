import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AuthModule } from './modules/auth/auth.module';
import { StoresModule } from './modules/stores/stores.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { SetupModule } from './modules/setup/setup.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BizModule } from './modules/biz/biz.module';
import { AiConfigModule } from './modules/ai-config/ai-config.module';
import { UpgradeModule } from './modules/upgrade/upgrade.module';
import { ReconcileModule } from './modules/reconcile/reconcile.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { StoreScopeGuard } from './common/guards/store-scope.guard';
import { InstallGuard } from './common/guards/install.guard';
import { Reflector } from '@nestjs/core';
import { isInstalled } from './runtime-config';
import { runMigrate } from './db/migrate';
import './db/index'; // 初始化数据库连接池（未安装时用占位配置，不实际连接）

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SetupModule, SettingsModule, AuthModule, StoresModule, UsersModule, HealthModule, AuditModule, BizModule, AiConfigModule, UpgradeModule, ReconcileModule,
  ],
})
class AppModule {}

async function bootstrap() {
  // 已安装实例：启动时跑一次幂等增量迁移，平滑升级（新列/新索引缺则补，不动已有数据）。
  // 未安装时跳过：此时 DB 尚未配置，建表由安装向导 install() 负责。
  if (isInstalled()) {
    try {
      await runMigrate();
      console.log('[API] 数据库增量迁移已检查（幂等）');
    } catch (e: any) {
      console.error('[API] 增量迁移失败（服务仍将启动，请检查 DB）:', e?.message || e);
    }
  }

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const reflector = app.get(Reflector);
  // 守卫顺序至关重要：
  // 1) InstallGuard — 未安装只放行安装向导
  // 2) AuthGuard    — 必须先注入 req.authUser（公开路由在守卫内部放行）
  // 3) RolesGuard   — 依赖 authUser.isSuper / permissions 做权限校验
  // 4) StoreScopeGuard — 依赖 authUser.visibleStoreIds 做门店隔离
  app.useGlobalGuards(new InstallGuard(), new AuthGuard(), new RolesGuard(reflector), new StoreScopeGuard());

  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://localhost:5175'], credentials: true });
  }
  const port = Number(process.env.PORT || 3000);
  // 默认：生产只监听本机（前置 Nginx 同机反代）；Docker 容器需监听 0.0.0.0，用 HOST 覆盖。
  const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
  await app.listen(port, host);
  console.log(`[API] running on http://${host}:${port}`);
  console.log(`[API] 安装状态: ${isInstalled() ? '已安装' : '未安装 → 访问 /setup 完成初始化'}`);
}
bootstrap();
