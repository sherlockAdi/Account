import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ManufacturingController } from './manufacturing.controller';
import { ManufacturingService } from './manufacturing.service';

@Module({
  imports: [IdentityModule],
  controllers: [ManufacturingController],
  providers: [ManufacturingService],
})
export class ManufacturingModule {}
