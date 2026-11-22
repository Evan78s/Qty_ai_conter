import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../../common/audit.service';
@Module({ controllers: [UsersController], providers: [AuthService, AuditService] })
export class UsersModule {}
