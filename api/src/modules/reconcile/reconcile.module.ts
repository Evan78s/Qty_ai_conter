import { Module } from '@nestjs/common';
import { ReconcileController } from './reconcile.controller';
import { FeishuService } from '../../common/feishu.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [ReconcileController],
  providers: [FeishuService, AuditService],
  exports: [FeishuService],
})
export class ReconcileModule {}
