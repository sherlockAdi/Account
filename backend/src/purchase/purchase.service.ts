import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { PurchaseQueryDto } from './dto/purchase-query.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ItemTaxResolverService } from '../gst/item-tax-resolver.service';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
    private readonly itemTaxResolver: ItemTaxResolverService,
  ) {}

  async listVendors(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.vendor.findMany({ where: { companyId: company.id, deletedAt: null }, include: { ledger: true }, orderBy: { name: 'asc' } });
  }

  async createVendor(companyId: string | undefined, dto: CreateVendorDto) {
    const company = await this.resolveCompany(companyId);
    const creditorGroup = await this.prisma.accountGroup.findFirst({ where: { companyId: company.id, code: 'SUNDRY_CREDITORS', deletedAt: null } });
    if (!creditorGroup) throw new BadRequestException('Sundry Creditors group not found');

    return this.prisma.$transaction(async (tx) => {
      const ledger = await tx.ledger.create({
        data: {
          companyId: company.id,
          groupId: creditorGroup.id,
          name: dto.name,
          code: `VENDOR_${dto.code}`,
          ledgerType: 'VENDOR',
          openingType: DebitCredit.CREDIT,
          gstin: dto.gstin,
          pan: dto.pan,
          email: dto.email,
          phone: dto.phone,
        },
      });

      return tx.vendor.create({ data: { companyId: company.id, ledgerId: ledger.id, ...dto }, include: { ledger: true } });
    });
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    const vendor = await this.findVendor(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.name || dto.gstin || dto.pan || dto.email || dto.phone) {
        await tx.ledger.update({
          where: { id: vendor.ledgerId },
          data: { name: dto.name, gstin: dto.gstin, pan: dto.pan, email: dto.email, phone: dto.phone },
        });
      }
      return tx.vendor.update({ where: { id }, data: dto, include: { ledger: true } });
    });
  }

  async createInvoice(companyId: string | undefined, dto: CreatePurchaseInvoiceDto) {
    const company = await this.resolveCompany(companyId);
    const vendor = await this.findVendor(dto.vendorId);
    const warehouse = await this.findWarehouse(dto.warehouseId);
    const inventoryLedger = await this.ensureInventoryLedger(company.id);

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
          voucherType: 'purchase_invoice',
          voucherNo: dto.invoiceNo,
          voucherDate: new Date(dto.invoiceDate),
          narration: dto.narration || `Purchase invoice ${dto.invoiceNo}`,
          lines: {
            create: [
              { ledgerId: inventoryLedger.id, type: DebitCredit.DEBIT, amount: new Prisma.Decimal(subtotal), narration: 'Inventory purchase' },
              { ledgerId: vendor.ledgerId, type: DebitCredit.CREDIT, amount: new Prisma.Decimal(totalAmount), narration: 'Vendor payable' },
              ...(taxAmount > 0 ? [{ ledgerId: inventoryLedger.id, type: DebitCredit.DEBIT, amount: new Prisma.Decimal(taxAmount), narration: 'Input tax placeholder' }] : []),
            ],
          },
        },
      });

      const invoice = await tx.purchaseInvoice.create({
        data: {
          companyId: company.id,
          vendorId: vendor.id,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          invoiceNo: dto.invoiceNo,
          invoiceDate: new Date(dto.invoiceDate),
          supplierInvoiceNo: dto.supplierInvoiceNo,
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
        include: { vendor: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      });

      await tx.stockMovement.createMany({
        data: lines.map((line) => ({
          itemId: line.itemId,
          warehouseId: warehouse.id,
          type: 'PURCHASE',
          quantity: new Prisma.Decimal(line.quantity),
          rate: new Prisma.Decimal(line.rate),
          amount: new Prisma.Decimal(line.amount),
          movementDate: new Date(dto.invoiceDate),
          referenceType: 'purchase_invoice',
          referenceNo: dto.invoiceNo,
          narration: dto.narration,
        })),
      });

      return invoice;
    });
  }

  async listInvoices(query: PurchaseQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    return this.prisma.purchaseInvoice.findMany({
      where: { companyId: company.id, vendorId: query.vendorId, deletedAt: null },
      include: { vendor: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      orderBy: { invoiceDate: 'desc' },
    });
  }

  async createReturn(companyId: string | undefined, dto: CreatePurchaseReturnDto) {
    const company = await this.resolveCompany(companyId);
    const vendor = await this.findVendor(dto.vendorId);
    const warehouse = await this.findWarehouse(dto.warehouseId);
    const inventoryLedger = await this.ensureInventoryLedger(company.id);

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
          voucherType: 'purchase_return',
          voucherNo: dto.returnNo,
          voucherDate: new Date(dto.returnDate),
          narration: dto.narration || `Purchase return ${dto.returnNo}`,
          lines: {
            create: [
              { ledgerId: vendor.ledgerId, type: DebitCredit.DEBIT, amount: new Prisma.Decimal(totalAmount), narration: 'Vendor debit' },
              { ledgerId: inventoryLedger.id, type: DebitCredit.CREDIT, amount: new Prisma.Decimal(subtotal), narration: 'Inventory returned' },
              ...(taxAmount > 0 ? [{ ledgerId: inventoryLedger.id, type: DebitCredit.CREDIT, amount: new Prisma.Decimal(taxAmount), narration: 'Input tax reversal placeholder' }] : []),
            ],
          },
        },
      });

      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          companyId: company.id,
          vendorId: vendor.id,
          branchId: dto.branchId,
          warehouseId: warehouse.id,
          returnNo: dto.returnNo,
          returnDate: new Date(dto.returnDate),
          supplierReturnNo: dto.supplierReturnNo,
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
        include: { vendor: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      });

      await tx.stockMovement.createMany({
        data: lines.map((line) => ({
          itemId: line.itemId,
          warehouseId: warehouse.id,
          type: 'PURCHASE_RETURN',
          quantity: new Prisma.Decimal(line.quantity),
          rate: new Prisma.Decimal(line.rate),
          amount: new Prisma.Decimal(line.amount),
          movementDate: new Date(dto.returnDate),
          referenceType: 'purchase_return',
          referenceNo: dto.returnNo,
          narration: dto.narration,
        })),
      });

      return purchaseReturn;
    });
  }

  async listReturns(query: PurchaseQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    return this.prisma.purchaseReturn.findMany({
      where: { companyId: company.id, vendorId: query.vendorId, deletedAt: null },
      include: { vendor: true, warehouse: true, lines: { include: { item: { include: { unit: true } } } } },
      orderBy: { returnDate: 'desc' },
    });
  }

  async vendorOutstanding(query: PurchaseQueryDto) {
    const vendors = await this.listVendors(query.companyId);
    const invoices = await this.listInvoices(query);
    const returns = await this.listReturns(query);
    return vendors.map((vendor) => {
      const total = invoices.filter((invoice) => invoice.vendorId === vendor.id).reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
      const returned = returns.filter((purchaseReturn) => purchaseReturn.vendorId === vendor.id).reduce((sum, purchaseReturn) => sum + Number(purchaseReturn.totalAmount), 0);
      return { vendorId: vendor.id, vendorName: vendor.name, totalPayable: Number((total - returned).toFixed(2)) };
    });
  }

  private async ensureInventoryLedger(companyId: string) {
    const group = await this.prisma.accountGroup.findFirst({ where: { companyId, code: 'CURRENT_ASSETS', deletedAt: null } });
    if (!group) throw new BadRequestException('Current Assets group not found');
    return this.prisma.ledger.upsert({
      where: { companyId_code: { companyId, code: 'PURCHASE_INVENTORY' } },
      update: {},
      create: { companyId, groupId: group.id, name: 'Purchase Inventory', code: 'PURCHASE_INVENTORY', ledgerType: 'GENERAL', openingType: DebitCredit.DEBIT },
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
    if (!company) throw new BadRequestException('Create a company before using purchase');
    return company;
  }

  private async findVendor(id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async findWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, deletedAt: null } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }
}
