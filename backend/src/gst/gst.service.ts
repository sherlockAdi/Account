import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { GstQueryDto } from './dto/gst-query.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';

@Injectable()
export class GstService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listTaxRates(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.taxRate.findMany({ where: { companyId: company.id, deletedAt: null }, orderBy: { rate: 'asc' } });
  }

  async createTaxRate(companyId: string | undefined, dto: CreateTaxRateDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.taxRate.create({
      data: {
        companyId: company.id,
        name: dto.name,
        code: dto.code,
        rate: new Prisma.Decimal(dto.rate),
        cgstRate: new Prisma.Decimal(dto.cgstRate ?? dto.rate / 2),
        sgstRate: new Prisma.Decimal(dto.sgstRate ?? dto.rate / 2),
        igstRate: new Prisma.Decimal(dto.igstRate ?? dto.rate),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTaxRate(id: string, dto: UpdateTaxRateDto) {
    await this.findTaxRate(id);
    return this.prisma.taxRate.update({
      where: { id },
      data: {
        ...dto,
        rate: dto.rate === undefined ? undefined : new Prisma.Decimal(dto.rate),
        cgstRate: dto.cgstRate === undefined ? undefined : new Prisma.Decimal(dto.cgstRate),
        sgstRate: dto.sgstRate === undefined ? undefined : new Prisma.Decimal(dto.sgstRate),
        igstRate: dto.igstRate === undefined ? undefined : new Prisma.Decimal(dto.igstRate),
      },
    });
  }

  async gstr1(query: GstQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { companyId: company.id, deletedAt: null, invoiceDate: this.dateFilter(query) },
      include: { customer: true, lines: { include: { item: true } } },
      orderBy: { invoiceDate: 'asc' },
    });

    return {
      company: { id: company.id, name: company.name, gstin: company.gstin },
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        customerName: invoice.customer.name,
        customerGstin: invoice.customer.gstin,
        taxableValue: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        totalAmount: Number(invoice.totalAmount),
      })),
      summary: this.sumInvoices(invoices),
    };
  }

  async itcSummary(query: GstQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { companyId: company.id, deletedAt: null, invoiceDate: this.dateFilter(query) },
      include: { vendor: true, lines: { include: { item: true } } },
      orderBy: { invoiceDate: 'asc' },
    });

    return {
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        vendorName: invoice.vendor.name,
        vendorGstin: invoice.vendor.gstin,
        taxableValue: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        inputTax: Number(invoice.taxAmount),
        totalAmount: Number(invoice.totalAmount),
      })),
      summary: this.sumInvoices(invoices),
    };
  }

  async gstr3b(query: GstQueryDto) {
    const sales = await this.gstr1(query);
    const purchases = await this.itcSummary(query);
    const outputTax = sales.summary.taxAmount;
    const inputTax = purchases.summary.taxAmount;
    return {
      outwardTaxableValue: sales.summary.taxableValue,
      outputTax,
      inwardTaxableValue: purchases.summary.taxableValue,
      inputTaxCredit: inputTax,
      inputTax,
      netTaxPayable: Number((outputTax - inputTax).toFixed(2)),
    };
  }

  async hsnSummary(query: GstQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const sales = await this.prisma.salesInvoiceLine.findMany({
      where: { invoice: { companyId: company.id, deletedAt: null, invoiceDate: this.dateFilter(query) } },
      include: { item: { include: { unit: true } } },
    });
    const purchases = await this.prisma.purchaseInvoiceLine.findMany({
      where: { invoice: { companyId: company.id, deletedAt: null, invoiceDate: this.dateFilter(query) } },
      include: { item: { include: { unit: true } } },
    });

    return {
      sales: this.groupByHsn(sales),
      purchases: this.groupByHsn(purchases),
    };
  }

  private groupByHsn(lines: Array<{ item: { hsnSac: string | null; name: string; unit: { code: string } }; quantity: Prisma.Decimal; amount: Prisma.Decimal; taxAmount: Prisma.Decimal; totalAmount: Prisma.Decimal }>) {
    const groups = new Map<string, { hsnSac: string; description: string; unit: string; quantity: number; taxableValue: number; taxAmount: number; totalAmount: number }>();
    for (const line of lines) {
      const key = line.item.hsnSac || 'UNMAPPED';
      const current = groups.get(key) || { hsnSac: key, description: line.item.name, unit: line.item.unit.code, quantity: 0, taxableValue: 0, taxAmount: 0, totalAmount: 0 };
      current.quantity += Number(line.quantity);
      current.taxableValue += Number(line.amount);
      current.taxAmount += Number(line.taxAmount);
      current.totalAmount += Number(line.totalAmount);
      groups.set(key, current);
    }
    return [...groups.values()].map((row) => ({
      ...row,
      quantity: Number(row.quantity.toFixed(3)),
      taxableValue: Number(row.taxableValue.toFixed(2)),
      taxAmount: Number(row.taxAmount.toFixed(2)),
      totalAmount: Number(row.totalAmount.toFixed(2)),
    }));
  }

  private sumInvoices(invoices: Array<{ subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; totalAmount: Prisma.Decimal }>) {
    return {
      count: invoices.length,
      taxableValue: Number(invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal), 0).toFixed(2)),
      taxAmount: Number(invoices.reduce((sum, invoice) => sum + Number(invoice.taxAmount), 0).toFixed(2)),
      totalAmount: Number(invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0).toFixed(2)),
    };
  }

  private dateFilter(query: GstQueryDto) {
    if (!query.from && !query.to) return undefined;
    return {
      gte: query.from ? new Date(query.from) : undefined,
      lte: query.to ? new Date(query.to) : undefined,
    };
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.prisma.company.findFirst({ where: { tenantId: tenant.id, deletedAt: null }, orderBy: { createdAt: 'asc' } });
    if (!company) throw new BadRequestException('Create a company before using GST');
    return company;
  }

  private async findTaxRate(id: string) {
    const rate = await this.prisma.taxRate.findFirst({ where: { id, deletedAt: null } });
    if (!rate) throw new NotFoundException('Tax rate not found');
    return rate;
  }
}
