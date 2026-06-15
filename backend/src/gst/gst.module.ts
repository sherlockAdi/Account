import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { GstController } from './gst.controller';
import { GstService } from './gst.service';
import { ItemTaxResolverService } from './item-tax-resolver.service';

@Module({
  imports: [IdentityModule],
  controllers: [GstController],
  providers: [GstService, ItemTaxResolverService],
  exports: [ItemTaxResolverService],
})
export class GstModule {}
