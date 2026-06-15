import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';
import { GstModule } from '../gst/gst.module';

@Module({
  imports: [IdentityModule, GstModule],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
