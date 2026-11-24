import { Module } from '@nestjs/common';
import { UpgradeController } from './upgrade.controller';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [UpgradeController],
  providers: [AuditService],
})
export class UpgradeModule {}
