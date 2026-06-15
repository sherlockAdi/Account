import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [IdentityModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}
