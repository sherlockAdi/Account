import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TallySyncModule } from '../tally-sync/tally-sync.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [IdentityModule, TallySyncModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}
