import { Module } from '@nestjs/common';
import { BizController } from './biz.controller';
import { AuditService } from '../../common/audit.service';

@Module({ controllers: [BizController], providers: [AuditService] })
export class BizModule {}
