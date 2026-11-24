import { Module } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';
import { AuditService } from '../../common/audit.service';

@Module({ controllers: [AiConfigController], providers: [AuditService] })
export class AiConfigModule {}
