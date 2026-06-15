import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ErpModuleDto } from './dto/erp-module.dto';
import { ModulesService } from './modules.service';

@ApiTags('ERP Modules')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get()
  @ApiOkResponse({ type: ErpModuleDto, isArray: true })
  findAll(): ErpModuleDto[] {
    return this.modulesService.findAll();
  }
}
