import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports & MIS')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  dashboard(@Query() query: ReportsQueryDto) {
    return this.reportsService.dashboard(query);
  }

  @Get('profit-loss')
  profitLoss(@Query() query: ReportsQueryDto) {
    return this.reportsService.profitLoss(query);
  }

  @Get('balance-sheet')
  balanceSheet(@Query() query: ReportsQueryDto) {
    return this.reportsService.balanceSheet(query);
  }
}
