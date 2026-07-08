import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RunTallySyncDto } from './dto/run-tally-sync.dto';
import { UpdateTallySyncSettingDto } from './dto/update-tally-sync-setting.dto';
import { TallySyncService } from './tally-sync.service';

@ApiTags('Tally Sync')
@Controller('tally-sync')
export class TallySyncController {
  constructor(private readonly tallySyncService: TallySyncService) {}

  @Get('status')
  @ApiOkResponse()
  getStatus() {
    return this.tallySyncService.getStatus();
  }

  @Put('settings')
  @ApiOkResponse()
  updateSettings(@Body() dto: UpdateTallySyncSettingDto) {
    return this.tallySyncService.updateSettings(dto);
  }

  @Post('test')
  @ApiOkResponse()
  testConnection() {
    return this.tallySyncService.testConnection();
  }

  @Post('sync')
  @ApiOkResponse()
  sync(@Body() dto: RunTallySyncDto) {
    return this.tallySyncService.syncNow(dto);
  }

  @Post('import-all')
  @ApiOkResponse()
  importAll() {
    return this.tallySyncService.importAllFromTally();
  }

  @Post('export-all')
  @ApiOkResponse()
  exportAll() {
    return this.tallySyncService.exportAllToTally();
  }

  @Post('pull')
  @ApiOkResponse()
  pull() {
    return this.tallySyncService.importAllFromTally();
  }

  @Post('push')
  @ApiOkResponse()
  push() {
    return this.tallySyncService.exportAllToTally();
  }
}
