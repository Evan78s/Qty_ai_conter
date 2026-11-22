import { Module } from '@nestjs/common';
import { StoresController } from './stores.controller';
import { AuditService } from '../../common/audit.service';
@Module({ controllers: [StoresController], providers: [AuditService] })
export class StoresModule {}
