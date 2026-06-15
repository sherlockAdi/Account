import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOkResponse({
    description: 'Backend health status',
    schema: {
      example: {
        service: 'AccountERP API',
        status: 'ok',
        version: '0.1.0',
      },
    },
  })
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
