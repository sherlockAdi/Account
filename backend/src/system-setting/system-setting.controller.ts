import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UpdateSystemModulesDto } from './dto/update-system-modules.dto';
import { SystemSettingService } from './system-setting.service';

@ApiTags('System Setting')
@Controller('system-setting')
export class SystemSettingController {
  constructor(private readonly systemSettingService: SystemSettingService) {}

  @Get('modules')
  @ApiOkResponse({
    schema: {
      example: {
        key: 'enabledModules',
        modules: {
          budget: true,
          grant: true,
          payroll: true,
          sales: true,
          purchase: true,
          costCenter: true,
        },
      },
    },
  })
  getModules() {
    return this.systemSettingService.getModules();
  }

  @Put('modules')
  updateModules(@Body() dto: UpdateSystemModulesDto) {
    return this.systemSettingService.updateModules(dto);
  }
}
