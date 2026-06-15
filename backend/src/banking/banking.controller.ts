import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BankingService } from './banking.service';
import { CreateChequeDto, UpdateChequeStatusDto } from './dto/create-cheque.dto';
import { CreatePaymentAdviceDto } from './dto/create-payment-advice.dto';
import { ReconcileTransactionDto } from './dto/reconcile-transaction.dto';

@ApiTags('Banking')
@Controller('banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('dashboard')
  dashboard(@Query('companyId') companyId?: string) {
    return this.bankingService.dashboard(companyId);
  }

  @Get('accounts')
  accounts(@Query('companyId') companyId?: string) {
    return this.bankingService.accounts(companyId);
  }

  @Get('transactions')
  transactions(@Query('companyId') companyId?: string, @Query('bankLedgerId') bankLedgerId?: string) {
    return this.bankingService.transactions(companyId, bankLedgerId);
  }

  @Post('transactions/:voucherLineId/reconcile')
  reconcile(@Param('voucherLineId') voucherLineId: string, @Body() dto: ReconcileTransactionDto) {
    return this.bankingService.reconcile(voucherLineId, dto);
  }

  @Get('cheques')
  cheques(@Query('companyId') companyId?: string) {
    return this.bankingService.cheques(companyId);
  }

  @Post('cheques')
  createCheque(@Query('companyId') companyId: string | undefined, @Body() dto: CreateChequeDto) {
    return this.bankingService.createCheque(companyId, dto);
  }

  @Patch('cheques/:id/status')
  updateChequeStatus(@Param('id') id: string, @Body() dto: UpdateChequeStatusDto) {
    return this.bankingService.updateChequeStatus(id, dto);
  }

  @Get('payment-advices')
  paymentAdvices(@Query('companyId') companyId?: string) {
    return this.bankingService.paymentAdvices(companyId);
  }

  @Post('payment-advices')
  createPaymentAdvice(@Query('companyId') companyId: string | undefined, @Body() dto: CreatePaymentAdviceDto) {
    return this.bankingService.createPaymentAdvice(companyId, dto);
  }
}
