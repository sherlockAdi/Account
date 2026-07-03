import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { SystemSettingController } from './system-setting.controller';
import { SystemSettingService } from './system-setting.service';

@Module({
  imports: [IdentityModule],
  controllers: [SystemSettingController],
  providers: [SystemSettingService],
})
export class SystemSettingModule {}
