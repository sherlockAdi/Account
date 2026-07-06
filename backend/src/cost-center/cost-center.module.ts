import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CostCenterController } from './cost-center.controller';
import { CostCenterService } from './cost-center.service';

@Module({
  imports: [IdentityModule],
  controllers: [CostCenterController],
  providers: [CostCenterService],
})
export class CostCenterModule {}
