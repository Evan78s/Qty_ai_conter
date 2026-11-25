import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [MetaController],
  providers: [MetaService, AuditService],
})
export class MetaModule {}
