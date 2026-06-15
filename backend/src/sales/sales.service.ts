import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSalesInvoiceDto } from './dto/create-sales-invoice.dto';
import { CreateSalesReturnDto } from './dto/create-sales-return.dto';
import { SalesQueryDto } from './dto/sales-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ItemTaxResolverService } from '../gst/item-tax-resolver.service';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
    private readonly itemTaxResolver: ItemTaxResolverService,
  ) {}

  async listCustomers(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.customer.findMany({ where: { companyId: company.id, deletedAt: null }, include: { ledger: true }, orderBy: { name: 'asc' } });
  }

  async createCustomer(companyId: string | undefined, dto: CreateCustomerDto) {
    const company = await this.resolveCompany(companyId);
    const debtorGroup = await this.prisma.accountGroup.findFirst({ where: { companyId: company.id, code: 'SUNDRY_DEBTORS', deletedAt: null } });
    if (!debtorGroup) throw new BadRequestException('Sundry Debtors group not found');

    return this.prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.create({
        data: {
          companyId: company.id,
          groupId: debtorGroup.id,
          name: dto.name,
          code: `CUSTOMER_${dto.code}`,
          ledgerType: 'CUSTOMER',
          openingType: DebitCredit.DEBIT,
          gstin: dto.gstin,
          pan: dto.pan,
          email: dto.email,
          phone: dto.phone,
        },
      });
      return tx.customer.create({ data: { companyId: company.id, ledgerId: ledger.id, ...dto }, include: { ledger: true } });
    });
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const customer = await this.findCustomer(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.name || dto.gstin || dto.pan || dto.email || dto.phone) {
        await tx.ledger.update({ where: { id: customer.ledgerId }, data: { name: dto.name, gstin: dto.gstin, pan: dto.pan, email: dto.email, phone: dto.phone } });
      }
      return tx.customer.update({ where: { id }, data: dto, include: { ledger: true } });
    });
  }

  async createInvoice(companyId: string | undefined, dto: CreateSalesInvoiceDto) {
    const company = await this.resolveCompany(companyId);
    const customer = await this.findCustomer(dto.customerId);
    const warehouse = await this.findWarehouse(dto.warehouseId);
    const salesLedger = await this.ensureSalesLedger(company.id);

    const itemIds = dto.lines.map((line) => line.itemId);
    const items = await this.prisma.item.findMany({ where: { id: { in: itemIds }, companyId: company.id, deletedAt: null } });
    if (items.length !== new Set(itemIds).size) throw new BadRequestException('One or more items are invalid');
    const itemTaxes = await this.itemTaxResolver.resolve(itemIds, dto.invoiceDate);

    const lines = dto.lines.map((line) => {
      const amount = line.quantity * line.rate;
      const taxRate = Number(itemTaxes.get(line.itemId)!.taxRate.rate);
      const taxAmount = amount * (taxRate / 100);
      return { ...line, taxRate, amount, taxAmount, totalAmount: amount + taxAmount };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const taxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);
    const totalAmount = subtotal + taxAmount;

    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          branchId: dto.branchId,
          voucherType: 'sales_invoice',
          voucherNo: dto.invoiceNo,
          voucherDate: new Date(dto.invoiceDate),
          narration: dto.narration || `Sales invoice ${dto.invoiceNo}`,
          lines: {
            create: [
              { ledgerId: customer.ledgerId, type: DebitCredit.DEBIT, amount: new Prisma.Decimal(totalAmount), narration: 'Customer receivable' },
              { ledgerId: salesLedger.id, type: DebitCredit.CREDIT, amount: new Prisma.Decimal(subtotal), narration: 'Sales income' },
              ...(taxAmount > 0 ? [{ ledgerId: salesLedger.id, type: DebitCredit.CREDIT, amount: new Prisma.Decimal(taxAmount), narration: 'Output tax placeholder' }] : []),
            ],
          },
        },
      });

      const invoice = await tx.salesInvoice.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          invoiceNo: dto.invoiceNo,
          invoiceDate: new Date(dto.invoiceDate),
          subtotal: new Prisma.Decimal(subtotal),
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          narration: dto.narration,
          accountingVoucherId: voucher.id,
          lines: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              quantity: new Prisma.Decimal(line.quantity),
              rate: new Prisma.Decimal(line.rate),
              amount: new Prisma.Decimal(line.amount),
              taxRate: new Prisma.Decimal(line.taxRate ?? 0),
              taxAmount: new Prisma.Decimal(line.taxAmount),
              totalAmount: new Prisma.Decimal(line.totalAmount),
            })),
          },
        },
        include: { customer: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      });

      await tx.stockMovement.createMany({
        data: lines.map((line) => ({
          itemId: line.itemId,
          warehouseId: warehouse.id,
          type: 'SALE',
          quantity: new Prisma.Decimal(line.quantity),
          rate: new Prisma.Decimal(line.rate),
          amount: new Prisma.Decimal(line.amount),
          movementDate: new Date(dto.invoiceDate),
          referenceType: 'sales_invoice',
          referenceNo: dto.invoiceNo,
          narration: dto.narration,
        })),
      });

      return invoice;
    });
  }

  async listInvoices(query: SalesQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    return this.prisma.salesInvoice.findMany({
      where: { companyId: company.id, customerId: query.customerId, deletedAt: null },
      include: { customer: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async createReturn(companyId: string | undefined, dto: CreateSalesReturnDto) {
    const company = await this.resolveCompany(companyId);
    const customer = await this.findCustomer(dto.customerId);
    const warehouse = await this.findWarehouse(dto.warehouseId);
    const salesLedger = await this.ensureSalesLedger(company.id);

    const itemIds = dto.lines.map((line) => line.itemId);
    const items = await this.prisma.item.findMany({ where: { id: { in: itemIds }, companyId: company.id, deletedAt: null } });
    if (items.length !== new Set(itemIds).size) throw new BadRequestException('One or more items are invalid');
    const itemTaxes = await this.itemTaxResolver.resolve(itemIds, dto.returnDate);

    const lines = dto.lines.map((line) => {
      const amount = line.quantity * line.rate;
      const taxRate = Number(itemTaxes.get(line.itemId)!.taxRate.rate);
      const taxAmount = amount * (taxRate / 100);
      return { ...line, taxRate, amount, taxAmount, totalAmount: amount + taxAmount };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const taxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);
    const totalAmount = subtotal + taxAmount;

    return this.prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          branchId: dto.branchId,
          voucherType: 'sales_return',
          voucherNo: dto.returnNo,
          voucherDate: new Date(dto.returnDate),
          narration: dto.narration || `Sales return ${dto.returnNo}`,
          lines: {
            create: [
              { ledgerId: salesLedger.id, type: DebitCredit.DEBIT, amount: new Prisma.Decimal(subtotal), narration: 'Sales return' },
              { ledgerId: customer.ledgerId, type: DebitCredit.CREDIT, amount: new Prisma.Decimal(totalAmount), narration: 'Customer credit' },
              ...(taxAmount > 0 ? [{ ledgerId: salesLedger.id, type: DebitCredit.DEBIT, amount: new Prisma.Decimal(taxAmount), narration: 'Output tax reversal placeholder' }] : []),
            ],
          },
        },
      });

      const salesReturn = await tx.salesReturn.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          returnNo: dto.returnNo,
          returnDate: new Date(dto.returnDate),
          subtotal: new Prisma.Decimal(subtotal),
          taxAmount: new Prisma.Decimal(taxAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          narration: dto.narration,
          accountingVoucherId: voucher.id,
          lines: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              quantity: new Prisma.Decimal(line.quantity),
              rate: new Prisma.Decimal(line.rate),
              amount: new Prisma.Decimal(line.amount),
              taxRate: new Prisma.Decimal(line.taxRate ?? 0),
              taxAmount: new Prisma.Decimal(line.taxAmount),
              totalAmount: new Prisma.Decimal(line.totalAmount),
            })),
          },
        },
        include: { customer: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      });

      await tx.stockMovement.createMany({
        data: lines.map((line) => ({
          itemId: line.itemId,
          warehouseId: warehouse.id,
          type: 'SALES_RETURN',
          quantity: new Prisma.Decimal(line.quantity),
          rate: new Prisma.Decimal(line.rate),
          amount: new Prisma.Decimal(line.amount),
          movementDate: new Date(dto.returnDate),
          referenceType: 'sales_return',
          referenceNo: dto.returnNo,
          narration: dto.narration,
        })),
      });

      return salesReturn;
    });
  }

  async listReturns(query: SalesQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    return this.prisma.salesReturn.findMany({
      where: { companyId: company.id, customerId: query.customerId, deletedAt: null },
      include: { customer: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      orderBy: { returnDate: 'desc' },
    });
  }

  async customerOutstanding(query: SalesQueryDto) {
    const customers = await this.listCustomers(query.companyId);
    const invoices = await this.listInvoices(query);
    const returns = await this.listReturns(query);
    return customers.map((customer) => {
      const total = invoices.filter((invoice) => invoice.customerId === customer.id).reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
      const returned = returns.filter((salesReturn) => salesReturn.customerId === customer.id).reduce((sum, salesReturn) => sum + Number(salesReturn.totalAmount), 0);
      return { customerId: customer.id, customerName: customer.name, totalReceivable: Number((total - returned).toFixed(2)) };
    });
  }

  private async ensureSalesLedger(companyId: string) {
    const group = await this.prisma.accountGroup.findFirst({ where: { companyId, code: 'DIRECT_INCOME', deletedAt: null } });
    if (!group) throw new BadRequestException('Direct Income group not found');
    return this.prisma.ledger.upsert({
      where: { companyId_code: { companyId, code: 'SALES_INCOME' } },
      update: {},
      create: { companyId, groupId: group.id, name: 'Sales Income', code: 'SALES_INCOME', ledgerType: 'INCOME', openingType: DebitCredit.CREDIT },
    });
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.prisma.company.findFirst({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!company) throw new BadRequestException('Create a company before using sales');
    return company;
  }

  private async findCustomer(id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  private async findWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, deletedAt: null } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }
}
