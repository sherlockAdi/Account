import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';

@Module({
  imports: [IdentityModule],
  controllers: [BankingController],
  providers: [BankingService],
})
export class BankingModule {}
