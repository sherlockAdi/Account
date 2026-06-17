import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

@Module({
  imports: [IdentityModule],
  controllers: [BudgetController],
  providers: [BudgetService],
})
export class BudgetModule {}
