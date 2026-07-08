import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TallySyncController } from './tally-sync.controller';
import { TallySyncService } from './tally-sync.service';

@Module({
  imports: [IdentityModule],
  controllers: [TallySyncController],
  providers: [TallySyncService],
})
export class TallySyncModule {}
