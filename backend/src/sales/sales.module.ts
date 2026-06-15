import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { GstModule } from '../gst/gst.module';

@Module({
  imports: [IdentityModule, GstModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
