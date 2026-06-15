import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'AccountERP API',
      status: 'ok',
      version: '0.1.0',
    };
  }
}
