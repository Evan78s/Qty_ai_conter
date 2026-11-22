import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuditService } from '../../common/audit.service';

@Module({ controllers: [AuthController], providers: [AuthService, AuditService], exports: [AuthService] })
export class AuthModule {}
