import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({ imports: [IdentityModule], controllers: [ComplianceController], providers: [ComplianceService] })
export class ComplianceModule {}
