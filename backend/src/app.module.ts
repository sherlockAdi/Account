import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountingModule } from './accounting/accounting.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { GstModule } from './gst/gst.module';
import { IdentityModule } from './identity/identity.module';
import { InventoryModule } from './inventory/inventory.module';
import { ModulesModule } from './modules/modules.module';
import { PurchaseModule } from './purchase/purchase.module';
import { SalesModule } from './sales/sales.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { PayrollModule } from './payroll/payroll.module';
import { BankingModule } from './banking/banking.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { BudgetModule } from './budget/budget.module';
import { SystemSettingModule } from './system-setting/system-setting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    IdentityModule,
    CompaniesModule,
    AccountingModule,
    InventoryModule,
    PurchaseModule,
    SalesModule,
    GstModule,
    ManufacturingModule,
    PayrollModule,
    BankingModule,
    ReportsModule,
    AuditModule,
    MarketplaceModule,
    ComplianceModule,
    ApprovalsModule,
    BudgetModule,
    SystemSettingModule,
    ModulesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
