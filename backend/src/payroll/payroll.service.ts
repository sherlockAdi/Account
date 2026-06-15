import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebitCredit, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { ProcessPayrollDto } from './dto/process-payroll.dto';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';

type PayrollLine = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string | null;
  workingDays: number;
  payableDays: number;
  basic: number;
  hra: number;
  specialAllowance: number;
  conveyanceAllowance: number;
  otherAllowance: number;
  overtimeAmount: number;
  grossEarnings: number;
  providentFund: number;
  esi: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listEmployees(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.employee.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        branch: true,
        salaryStructures: { orderBy: { effectiveFrom: 'desc' } },
      },
      orderBy: [{ status: 'asc' }, { employeeCode: 'asc' }],
    });
  }

  async createEmployee(companyId: string | undefined, dto: CreateEmployeeDto) {
    const company = await this.resolveCompany(companyId);
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, companyId: company.id, deletedAt: null, isActive: true },
    });
    if (!branch) throw new BadRequestException('Selected branch is invalid');
    return this.prisma.employee.create({
      data: {
        companyId: company.id,
        branchId: dto.branchId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        designation: dto.designation,
        department: dto.department,
        dateOfJoining: new Date(dto.dateOfJoining),
        pan: dto.pan,
        uan: dto.uan,
        esiNumber: dto.esiNumber,
        bankAccountNo: dto.bankAccountNo,
        bankIfsc: dto.bankIfsc,
        status: dto.status,
      },
      include: { branch: true, salaryStructures: true },
    });
  }

  async createSalaryStructure(employeeId: string, dto: CreateSalaryStructureDto) {
    const employee = await this.findEmployee(employeeId);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('Effective to date must be on or after effective from date');
    }
    const overlapping = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
      },
    });
    if (overlapping) {
      throw new BadRequestException('Salary structure overlaps an existing effective period');
    }
    return this.prisma.salaryStructure.create({
      data: {
        employeeId: employee.id,
        effectiveFrom,
        effectiveTo,
        basic: new Prisma.Decimal(dto.basic),
        hra: new Prisma.Decimal(dto.hra ?? 0),
        specialAllowance: new Prisma.Decimal(dto.specialAllowance ?? 0),
        conveyanceAllowance: new Prisma.Decimal(dto.conveyanceAllowance ?? 0),
        otherAllowance: new Prisma.Decimal(dto.otherAllowance ?? 0),
        pfPercent: new Prisma.Decimal(dto.pfPercent ?? 12),
        esiPercent: new Prisma.Decimal(dto.esiPercent ?? 0.75),
        professionalTax: new Prisma.Decimal(dto.professionalTax ?? 0),
        tds: new Prisma.Decimal(dto.tds ?? 0),
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
    });
  }

  async listAttendance(companyId: string | undefined, year: number, month: number) {
    this.validatePeriod(year, month);
    const company = await this.resolveCompany(companyId);
    return this.prisma.payrollAttendance.findMany({
      where: { year, month, employee: { companyId: company.id, deletedAt: null } },
      include: { employee: { include: { branch: true } } },
      orderBy: { employee: { employeeCode: 'asc' } },
    });
  }

  async upsertAttendance(dto: UpsertAttendanceDto) {
    this.validatePeriod(dto.year, dto.month);
    const employee = await this.findEmployee(dto.employeeId);
    if (dto.payableDays > dto.workingDays) {
      throw new BadRequestException('Payable days cannot exceed working days');
    }
    return this.prisma.payrollAttendance.upsert({
      where: { employeeId_year_month: { employeeId: employee.id, year: dto.year, month: dto.month } },
      update: {
        workingDays: new Prisma.Decimal(dto.workingDays),
        payableDays: new Prisma.Decimal(dto.payableDays),
        overtimeHours: new Prisma.Decimal(dto.overtimeHours ?? 0),
        overtimeAmount: new Prisma.Decimal(dto.overtimeAmount ?? 0),
        notes: dto.notes,
      },
      create: {
        employeeId: employee.id,
        year: dto.year,
        month: dto.month,
        workingDays: new Prisma.Decimal(dto.workingDays),
        payableDays: new Prisma.Decimal(dto.payableDays),
        overtimeHours: new Prisma.Decimal(dto.overtimeHours ?? 0),
        overtimeAmount: new Prisma.Decimal(dto.overtimeAmount ?? 0),
        notes: dto.notes,
      },
      include: { employee: true },
    });
  }

  async preview(companyId: string | undefined, year: number, month: number, branchId?: string) {
    this.validatePeriod(year, month);
    const company = await this.resolveCompany(companyId);
    const lines = await this.calculatePayroll(company.id, year, month, branchId);
    return {
      year,
      month,
      lines,
      totals: this.totals(lines),
    };
  }

  async listRuns(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.payrollRun.findMany({
      where: { companyId: company.id },
      include: {
        branch: true,
        payslips: { include: { employee: true }, orderBy: { employee: { employeeCode: 'asc' } } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async process(companyId: string | undefined, dto: ProcessPayrollDto) {
    this.validatePeriod(dto.year, dto.month);
    const company = await this.resolveCompany(companyId);
    const existing = await this.prisma.payrollRun.findFirst({
      where: { companyId: company.id, year: dto.year, month: dto.month, branchId: dto.branchId ?? null },
    });
    if (existing) throw new BadRequestException('Payroll is already processed for this period and branch');
    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, companyId: company.id, deletedAt: null },
      });
      if (!branch) throw new BadRequestException('Selected branch is invalid');
    }
    const lines = await this.calculatePayroll(company.id, dto.year, dto.month, dto.branchId);
    if (!lines.length) throw new BadRequestException('No payroll-ready employees found for this period');
    const totals = this.totals(lines);

    return this.prisma.$transaction(async (tx) => {
      const ledgers = await this.ensurePayrollLedgers(tx, company.id);
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          branchId: dto.branchId,
          voucherType: 'payroll',
          voucherNo: dto.runNo,
          voucherDate: new Date(dto.paymentDate),
          narration: dto.notes || `Payroll for ${dto.month}/${dto.year}`,
          lines: {
            create: [
              { ledgerId: ledgers.salaryExpense.id, type: DebitCredit.DEBIT, amount: totals.grossEarnings },
              { ledgerId: ledgers.salaryPayable.id, type: DebitCredit.CREDIT, amount: totals.netPay },
              ...(totals.providentFund ? [{ ledgerId: ledgers.pfPayable.id, type: DebitCredit.CREDIT, amount: totals.providentFund }] : []),
              ...(totals.esi ? [{ ledgerId: ledgers.esiPayable.id, type: DebitCredit.CREDIT, amount: totals.esi }] : []),
              ...(totals.professionalTax ? [{ ledgerId: ledgers.professionalTaxPayable.id, type: DebitCredit.CREDIT, amount: totals.professionalTax }] : []),
              ...(totals.tds ? [{ ledgerId: ledgers.tdsPayable.id, type: DebitCredit.CREDIT, amount: totals.tds }] : []),
            ],
          },
        },
      });

      return tx.payrollRun.create({
        data: {
          companyId: company.id,
          branchId: dto.branchId,
          year: dto.year,
          month: dto.month,
          runNo: dto.runNo,
          paymentDate: new Date(dto.paymentDate),
          status: 'PROCESSED',
          totalGross: totals.grossEarnings,
          totalDeductions: totals.totalDeductions,
          totalNet: totals.netPay,
          accountingVoucherId: voucher.id,
          notes: dto.notes,
          payslips: {
            create: lines.map((line) => ({
              employeeId: line.employeeId,
              workingDays: line.workingDays,
              payableDays: line.payableDays,
              basic: line.basic,
              hra: line.hra,
              specialAllowance: line.specialAllowance,
              conveyanceAllowance: line.conveyanceAllowance,
              otherAllowance: line.otherAllowance,
              overtimeAmount: line.overtimeAmount,
              grossEarnings: line.grossEarnings,
              providentFund: line.providentFund,
              esi: line.esi,
              professionalTax: line.professionalTax,
              tds: line.tds,
              otherDeductions: line.otherDeductions,
              totalDeductions: line.totalDeductions,
              netPay: line.netPay,
            })),
          },
        },
        include: { branch: true, payslips: { include: { employee: true } } },
      });
    });
  }

  async dashboard(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const [activeEmployees, runs, latestRun] = await Promise.all([
      this.prisma.employee.count({ where: { companyId: company.id, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.payrollRun.count({ where: { companyId: company.id, status: 'PROCESSED' } }),
      this.prisma.payrollRun.findFirst({
        where: { companyId: company.id, status: 'PROCESSED' },
        include: { payslips: { include: { employee: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
    ]);
    const attendanceCount = await this.prisma.payrollAttendance.count({
      where: { year, month, employee: { companyId: company.id, status: 'ACTIVE', deletedAt: null } },
    });
    return {
      activeEmployees,
      processedRuns: runs,
      attendanceReady: attendanceCount,
      currentPeriod: { year, month },
      latestRun,
    };
  }

  private async calculatePayroll(companyId: string, year: number, month: number, branchId?: string) {
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        branchId,
        status: 'ACTIVE',
        deletedAt: null,
        dateOfJoining: { lte: periodEnd },
      },
      include: {
        salaryStructures: {
          where: {
            isActive: true,
            effectiveFrom: { lte: periodEnd },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(Date.UTC(year, month - 1, 1)) } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        attendance: { where: { year, month }, take: 1 },
      },
      orderBy: { employeeCode: 'asc' },
    });

    return employees.flatMap((employee): PayrollLine[] => {
      const structure = employee.salaryStructures[0];
      const attendance = employee.attendance[0];
      if (!structure || !attendance || Number(attendance.workingDays) <= 0) return [];
      const ratio = Math.min(1, Number(attendance.payableDays) / Number(attendance.workingDays));
      const prorate = (value: Prisma.Decimal) => this.money(Number(value) * ratio);
      const basic = prorate(structure.basic);
      const hra = prorate(structure.hra);
      const specialAllowance = prorate(structure.specialAllowance);
      const conveyanceAllowance = prorate(structure.conveyanceAllowance);
      const otherAllowance = prorate(structure.otherAllowance);
      const overtimeAmount = this.money(Number(attendance.overtimeAmount));
      const grossEarnings = this.money(basic + hra + specialAllowance + conveyanceAllowance + otherAllowance + overtimeAmount);
      const providentFund = this.money((basic * Number(structure.pfPercent)) / 100);
      const esi = this.money((grossEarnings * Number(structure.esiPercent)) / 100);
      const professionalTax = this.money(Number(structure.professionalTax));
      const tds = this.money(Number(structure.tds));
      const otherDeductions = 0;
      const totalDeductions = this.money(providentFund + esi + professionalTax + tds + otherDeductions);
      return [{
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: `${employee.firstName}${employee.lastName ? ` ${employee.lastName}` : ''}`,
        designation: employee.designation,
        workingDays: Number(attendance.workingDays),
        payableDays: Number(attendance.payableDays),
        basic,
        hra,
        specialAllowance,
        conveyanceAllowance,
        otherAllowance,
        overtimeAmount,
        grossEarnings,
        providentFund,
        esi,
        professionalTax,
        tds,
        otherDeductions,
        totalDeductions,
        netPay: this.money(grossEarnings - totalDeductions),
      }];
    });
  }

  private totals(lines: PayrollLine[]) {
    const sum = (key: keyof PayrollLine) => this.money(lines.reduce((total, line) => total + Number(line[key]), 0));
    return {
      grossEarnings: sum('grossEarnings'),
      providentFund: sum('providentFund'),
      esi: sum('esi'),
      professionalTax: sum('professionalTax'),
      tds: sum('tds'),
      totalDeductions: sum('totalDeductions'),
      netPay: sum('netPay'),
    };
  }

  private async ensurePayrollLedgers(tx: Prisma.TransactionClient, companyId: string) {
    const [expenseGroup, liabilityGroup] = await Promise.all([
      tx.accountGroup.findFirst({ where: { companyId, code: 'INDIRECT_EXPENSES', deletedAt: null } }),
      tx.accountGroup.findFirst({ where: { companyId, code: 'CURRENT_LIABILITIES', deletedAt: null } }),
    ]);
    if (!expenseGroup || !liabilityGroup) throw new BadRequestException('Payroll account groups are not configured');
    const create = (code: string, name: string, groupId: string, openingType: DebitCredit = DebitCredit.CREDIT) =>
      tx.ledger.upsert({
        where: { companyId_code: { companyId, code } },
        update: {},
        create: { companyId, groupId, code, name, openingType },
      });
    const [salaryExpense, salaryPayable, pfPayable, esiPayable, professionalTaxPayable, tdsPayable] = await Promise.all([
      create('SALARY_EXPENSE', 'Salary and Wages', expenseGroup.id, DebitCredit.DEBIT),
      create('SALARY_PAYABLE', 'Salary Payable', liabilityGroup.id),
      create('PF_PAYABLE', 'Provident Fund Payable', liabilityGroup.id),
      create('ESI_PAYABLE', 'ESI Payable', liabilityGroup.id),
      create('PROFESSIONAL_TAX_PAYABLE', 'Professional Tax Payable', liabilityGroup.id),
      create('TDS_SALARY_PAYABLE', 'TDS on Salary Payable', liabilityGroup.id),
    ]);
    return { salaryExpense, salaryPayable, pfPayable, esiPayable, professionalTaxPayable, tdsPayable };
  }

  private validatePeriod(year: number, month: number) {
    if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('A valid payroll year and month are required');
    }
  }

  private money(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private async findEmployee(id: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async resolveCompany(companyId?: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Company not found');
      return company;
    }
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.prisma.company.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!company) throw new BadRequestException('Create a company before using payroll');
    return company;
  }
}
