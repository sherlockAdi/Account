import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [IdentityModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
