const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

const D = (value) => new Prisma.Decimal(value);

async function main() {
  const tenant =
    (await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } })) ||
    (await prisma.tenant.create({
      data: {
        name: 'Default Tenant',
        slug: 'default',
      },
    }));

  const company = await prisma.company.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MSSPL' } },
    update: {
      name: 'Multifacet Software Systems Pvt. Ltd.',
      legalName: 'Multifacet Software Systems Pvt. Ltd.',
      gstin: null,
      pan: null,
      email: 'msspl.mspl@gmail.com',
      phone: '+91-9336810652, 9335148620',
      addressLine1: '109/421, 80 feet road',
      addressLine2: null,
      city: 'Kanpur',
      state: 'U.P.',
      country: 'India',
      pincode: null,
      financialYearStart: new Date('2026-04-01T00:00:00.000Z'),
      booksStartDate: new Date('2026-04-01T00:00:00.000Z'),
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      name: 'Multifacet Software Systems Pvt. Ltd.',
      legalName: 'Multifacet Software Systems Pvt. Ltd.',
      code: 'MSSPL',
      email: 'msspl.mspl@gmail.com',
      phone: '+91-9336810652, 9335148620',
      addressLine1: '109/421, 80 feet road',
      city: 'Kanpur',
      state: 'U.P.',
      country: 'India',
      financialYearStart: new Date('2026-04-01T00:00:00.000Z'),
      booksStartDate: new Date('2026-04-01T00:00:00.000Z'),
      isActive: true,
    },
  });

  const branchesData = [
    {
      name: 'Head Office',
      code: 'HO',
      isPrimary: true,
      addressLine1: '109/421, 80 feet road',
      city: 'Kanpur',
      state: 'U.P.',
    },
    { name: 'Kanpur Branch', code: 'KP', addressLine1: 'B-12, Civil Lines', city: 'Kanpur', state: 'U.P.' },
    { name: 'Lucknow Branch', code: 'LK', addressLine1: '21, Hazratganj', city: 'Lucknow', state: 'U.P.' },
    { name: 'Delhi Branch', code: 'DL', addressLine1: '44, Connaught Place', city: 'Delhi', state: 'Delhi' },
    { name: 'Mumbai Branch', code: 'MB', addressLine1: '99, Andheri East', city: 'Mumbai', state: 'Maharashtra' },
  ];

  const branches = [];
  for (const branchData of branchesData) {
    const branch = await prisma.branch.upsert({
      where: { companyId_code: { companyId: company.id, code: branchData.code } },
      update: {
        name: branchData.name,
        isPrimary: !!branchData.isPrimary,
        isActive: true,
        addressLine1: branchData.addressLine1,
        city: branchData.city,
        state: branchData.state,
        country: 'India',
      },
      create: {
        companyId: company.id,
        name: branchData.name,
        code: branchData.code,
        isPrimary: !!branchData.isPrimary,
        isActive: true,
        addressLine1: branchData.addressLine1,
        city: branchData.city,
        state: branchData.state,
        country: 'India',
      },
    });
    branches.push(branch);
  }

  for (const [index, branch] of branches.entries()) {
    await prisma.warehouse.upsert({
      where: { branchId_code: { branchId: branch.id, code: 'MAIN' } },
      update: {
        name: `${branchesData[index].name} Warehouse`,
        isPrimary: true,
        isActive: true,
      },
      create: {
        branchId: branch.id,
        name: `${branchesData[index].name} Warehouse`,
        code: 'MAIN',
        isPrimary: true,
        isActive: true,
      },
    });
  }

  const groupsData = [
    { name: 'Capital Account', code: 'CAPITAL', nature: 'EQUITY' },
    { name: 'Bank Accounts', code: 'BANK_ACCOUNTS', nature: 'ASSET' },
    { name: 'Cash-in-Hand', code: 'CASH_IN_HAND', nature: 'ASSET' },
    { name: 'Direct Income', code: 'DIRECT_INCOME', nature: 'INCOME' },
    { name: 'Indirect Expenses', code: 'INDIRECT_EXPENSES', nature: 'EXPENSE' },
  ];

  const groups = {};
  for (const groupData of groupsData) {
    const group = await prisma.accountGroup.upsert({
      where: { companyId_code: { companyId: company.id, code: groupData.code } },
      update: {
        name: groupData.name,
        nature: groupData.nature,
        isSystem: true,
      },
      create: {
        companyId: company.id,
        name: groupData.name,
        code: groupData.code,
        nature: groupData.nature,
        isSystem: true,
      },
    });
    groups[groupData.code] = group;
  }

  const ledgersData = [
    {
      name: 'Main Cash',
      code: 'MAIN_CASH',
      groupCode: 'CASH_IN_HAND',
      ledgerType: 'CASH',
      openingBalance: 0,
      openingType: 'DEBIT',
    },
    {
      name: 'HDFC Bank',
      code: 'HDFC_BANK',
      groupCode: 'BANK_ACCOUNTS',
      ledgerType: 'BANK',
      openingBalance: 0,
      openingType: 'DEBIT',
      bankName: 'HDFC Bank',
    },
    {
      name: 'Sales Revenue',
      code: 'SALES_REVENUE',
      groupCode: 'DIRECT_INCOME',
      ledgerType: 'INCOME',
      openingBalance: 0,
      openingType: 'CREDIT',
    },
    {
      name: 'Salary Expense',
      code: 'SALARY_EXPENSE',
      groupCode: 'INDIRECT_EXPENSES',
      ledgerType: 'EXPENSE',
      openingBalance: 0,
      openingType: 'DEBIT',
    },
    {
      name: 'Owner Capital',
      code: 'OWNER_CAPITAL',
      groupCode: 'CAPITAL',
      ledgerType: 'CAPITAL',
      openingBalance: 0,
      openingType: 'CREDIT',
    },
  ];

  const ledgers = {};
  for (const ledgerData of ledgersData) {
    const ledger = await prisma.ledger.upsert({
      where: { companyId_code: { companyId: company.id, code: ledgerData.code } },
      update: {
        name: ledgerData.name,
        groupId: groups[ledgerData.groupCode].id,
        ledgerType: ledgerData.ledgerType,
        openingBalance: D(ledgerData.openingBalance),
        openingType: ledgerData.openingType,
        bankName: ledgerData.bankName || null,
        isActive: true,
      },
      create: {
        companyId: company.id,
        name: ledgerData.name,
        code: ledgerData.code,
        groupId: groups[ledgerData.groupCode].id,
        ledgerType: ledgerData.ledgerType,
        openingBalance: D(ledgerData.openingBalance),
        openingType: ledgerData.openingType,
        bankName: ledgerData.bankName || null,
        isActive: true,
      },
    });
    ledgers[ledgerData.code] = ledger;
  }

  const costCentersData = [
    { name: 'Administration', code: 'ADM' },
    { name: 'Sales', code: 'SAL' },
    { name: 'Marketing', code: 'MKT' },
    { name: 'Operations', code: 'OPS' },
    { name: 'HR', code: 'HR' },
  ];

  const costCenters = [];
  for (const costCenterData of costCentersData) {
    const costCenter = await prisma.costCenter.upsert({
      where: { companyId_code: { companyId: company.id, code: costCenterData.code } },
      update: {
        name: costCenterData.name,
        notes: `${costCenterData.name} cost center`,
        isActive: true,
      },
      create: {
        companyId: company.id,
        name: costCenterData.name,
        code: costCenterData.code,
        notes: `${costCenterData.name} cost center`,
        isActive: true,
      },
    });
    costCenters.push(costCenter);
  }

  const voucherTypesData = [
    { name: 'Journal', code: 'journal', category: 'accounting', prefix: 'JV-' },
    { name: 'Payment', code: 'payment', category: 'accounting', prefix: 'PY-' },
    { name: 'Receipt', code: 'receipt', category: 'accounting', prefix: 'RC-' },
    { name: 'Contra', code: 'contra', category: 'accounting', prefix: 'CT-' },
    { name: 'Debit Note', code: 'debit_note', category: 'accounting', prefix: 'DN-' },
  ];

  const voucherTypes = {};
  for (const voucherTypeData of voucherTypesData) {
    const voucherType = await prisma.voucherType.upsert({
      where: { companyId_code: { companyId: company.id, code: voucherTypeData.code } },
      update: {
        name: voucherTypeData.name,
        category: voucherTypeData.category,
        prefix: voucherTypeData.prefix,
        nextNumber: 1,
        padding: 5,
        isActive: true,
      },
      create: {
        companyId: company.id,
        name: voucherTypeData.name,
        code: voucherTypeData.code,
        category: voucherTypeData.category,
        prefix: voucherTypeData.prefix,
        nextNumber: 1,
        padding: 5,
        isActive: true,
      },
    });
    voucherTypes[voucherTypeData.code] = voucherType;
  }

  const budgetTypesData = [
    { name: 'Annual Budget', code: 'ANNUAL', category: 'ANNUAL', totalAmount: 120000, isAnnual: true, grant: { name: 'Annual Grant', code: 'GRANT-ANNUAL', amount: 120000, isDefault: true } },
    { name: 'Sales Budget', code: 'SALES', category: 'MONTHLY', totalAmount: 60000, isAnnual: false, grant: { name: 'Sales Grant', code: 'GRANT-SALES', amount: 60000, isDefault: true } },
    { name: 'Marketing Budget', code: 'MARKETING', category: 'MONTHLY', totalAmount: 40000, isAnnual: false, grant: { name: 'Marketing Grant', code: 'GRANT-MKT', amount: 40000, isDefault: true } },
    { name: 'Operations Budget', code: 'OPERATIONS', category: 'MONTHLY', totalAmount: 50000, isAnnual: false, grant: { name: 'Operations Grant', code: 'GRANT-OPS', amount: 50000, isDefault: true } },
    { name: 'HR Budget', code: 'HR', category: 'MONTHLY', totalAmount: 30000, isAnnual: false, grant: { name: 'HR Grant', code: 'GRANT-HR', amount: 30000, isDefault: true } },
  ];

  const budgetTypes = [];
  const budgetGrants = [];
  for (const budgetTypeData of budgetTypesData) {
    const budgetType = await prisma.budgetType.upsert({
      where: { companyId_code: { companyId: company.id, code: budgetTypeData.code } },
      update: {
        name: budgetTypeData.name,
        category: budgetTypeData.category,
        totalAmount: D(budgetTypeData.totalAmount),
        isAnnual: budgetTypeData.isAnnual,
        isActive: true,
      },
      create: {
        companyId: company.id,
        name: budgetTypeData.name,
        code: budgetTypeData.code,
        category: budgetTypeData.category,
        totalAmount: D(budgetTypeData.totalAmount),
        isAnnual: budgetTypeData.isAnnual,
        isActive: true,
      },
    });
    budgetTypes.push(budgetType);

    const grant = await prisma.budgetGrant.upsert({
      where: {
        companyId_budgetTypeId_code: {
          companyId: company.id,
          budgetTypeId: budgetType.id,
          code: budgetTypeData.grant.code,
        },
      },
      update: {
        name: budgetTypeData.grant.name,
        amount: D(budgetTypeData.grant.amount),
        isDefault: budgetTypeData.grant.isDefault,
        isActive: true,
      },
      create: {
        companyId: company.id,
        budgetTypeId: budgetType.id,
        name: budgetTypeData.grant.name,
        code: budgetTypeData.grant.code,
        amount: D(budgetTypeData.grant.amount),
        isDefault: budgetTypeData.grant.isDefault,
        isActive: true,
      },
    });
    budgetGrants.push(grant);
  }

  const budgetPlansData = budgetTypes.map((budgetType, index) => ({
    name: `${budgetType.name} Plan`,
    code: `BUD-${String(index + 1).padStart(3, '0')}`,
    fiscalYear: '2026-27',
    periodFrom: new Date('2026-04-01T00:00:00.000Z'),
    periodTo: new Date('2027-03-31T23:59:59.999Z'),
    budgetTypeId: budgetType.id,
    costCenterId: costCenters[index].id,
    totalAmount: budgetType.totalAmount,
    notes: `${budgetType.name} for ${costCenters[index].name}`,
  }));

  const budgetPlans = [];
  for (const budgetPlanData of budgetPlansData) {
    const budgetPlan = await prisma.budgetPlan.upsert({
      where: { companyId_code: { companyId: company.id, code: budgetPlanData.code } },
      update: {
        name: budgetPlanData.name,
        budgetTypeId: budgetPlanData.budgetTypeId,
        costCenterId: budgetPlanData.costCenterId,
        fiscalYear: budgetPlanData.fiscalYear,
        periodFrom: budgetPlanData.periodFrom,
        periodTo: budgetPlanData.periodTo,
        totalAmount: D(budgetPlanData.totalAmount),
        notes: budgetPlanData.notes,
      },
      create: {
        companyId: company.id,
        name: budgetPlanData.name,
        code: budgetPlanData.code,
        budgetTypeId: budgetPlanData.budgetTypeId,
        costCenterId: budgetPlanData.costCenterId,
        fiscalYear: budgetPlanData.fiscalYear,
        periodFrom: budgetPlanData.periodFrom,
        periodTo: budgetPlanData.periodTo,
        totalAmount: D(budgetPlanData.totalAmount),
        notes: budgetPlanData.notes,
      },
    });
    budgetPlans.push(budgetPlan);
  }

  for (const [index, budgetPlan] of budgetPlans.entries()) {
    const ledger = [ledgers.MAIN_CASH, ledgers.HDFC_BANK, ledgers.SALES_REVENUE, ledgers.SALARY_EXPENSE, ledgers.OWNER_CAPITAL][index];
    const branch = branches[index];
    await prisma.budgetLine.upsert({
      where: { budgetId_ledgerId_branchId: { budgetId: budgetPlan.id, ledgerId: ledger.id, branchId: branch.id } },
      update: {
        allocatedAmount: D(budgetPlan.totalAmount),
        notes: `${budgetPlan.name} allocation`,
      },
      create: {
        budgetId: budgetPlan.id,
        ledgerId: ledger.id,
        branchId: branch.id,
        allocatedAmount: D(budgetPlan.totalAmount),
        notes: `${budgetPlan.name} allocation`,
      },
    });
  }

  const voucherSpecs = [
    {
      type: 'journal',
      no: 'JV-00001',
      branchId: branches[0].id,
      budgetTypeId: budgetTypes[0].id,
      budgetGrantId: budgetGrants[0].id,
      narration: 'Seed journal voucher',
      lines: [
        { ledgerId: ledgers.MAIN_CASH.id, type: 'DEBIT', amount: 12000, narration: 'Cash increased' },
        { ledgerId: ledgers.OWNER_CAPITAL.id, type: 'CREDIT', amount: 12000, narration: 'Owner capital' },
      ],
    },
    {
      type: 'payment',
      no: 'PY-00001',
      branchId: branches[1].id,
      budgetTypeId: budgetTypes[1].id,
      budgetGrantId: budgetGrants[1].id,
      narration: 'Seed payment voucher',
      lines: [
        { ledgerId: ledgers.SALARY_EXPENSE.id, type: 'DEBIT', amount: 8000, narration: 'Salary expense' },
        { ledgerId: ledgers.HDFC_BANK.id, type: 'CREDIT', amount: 8000, narration: 'Bank payment' },
      ],
    },
    {
      type: 'receipt',
      no: 'RC-00001',
      branchId: branches[2].id,
      budgetTypeId: budgetTypes[2].id,
      budgetGrantId: budgetGrants[2].id,
      narration: 'Seed receipt voucher',
      lines: [
        { ledgerId: ledgers.HDFC_BANK.id, type: 'DEBIT', amount: 15000, narration: 'Bank receipt' },
        { ledgerId: ledgers.SALES_REVENUE.id, type: 'CREDIT', amount: 15000, narration: 'Sales income' },
      ],
    },
    {
      type: 'contra',
      no: 'CT-00001',
      branchId: branches[3].id,
      budgetTypeId: budgetTypes[3].id,
      budgetGrantId: budgetGrants[3].id,
      narration: 'Seed contra voucher',
      lines: [
        { ledgerId: ledgers.HDFC_BANK.id, type: 'DEBIT', amount: 5000, narration: 'Cash deposited' },
        { ledgerId: ledgers.MAIN_CASH.id, type: 'CREDIT', amount: 5000, narration: 'Cash withdrawn' },
      ],
    },
    {
      type: 'debit_note',
      no: 'DN-00001',
      branchId: branches[4].id,
      budgetTypeId: budgetTypes[4].id,
      budgetGrantId: budgetGrants[4].id,
      narration: 'Seed debit note voucher',
      lines: [
        { ledgerId: ledgers.SALARY_EXPENSE.id, type: 'DEBIT', amount: 3000, narration: 'Adjustment expense' },
        { ledgerId: ledgers.HDFC_BANK.id, type: 'CREDIT', amount: 3000, narration: 'Bank adjustment' },
      ],
    },
  ];

  for (const spec of voucherSpecs) {
    const voucher = await prisma.voucher.upsert({
      where: { companyId_voucherType_voucherNo: { companyId: company.id, voucherType: spec.type, voucherNo: spec.no } },
      update: {
        branchId: spec.branchId,
        budgetTypeId: spec.budgetTypeId,
        budgetGrantId: spec.budgetGrantId,
        voucherDate: new Date('2026-04-01T00:00:00.000Z'),
        narration: spec.narration,
        budgetFlow: 'UTILIZATION',
        status: 'POSTED',
      },
      create: {
        companyId: company.id,
        branchId: spec.branchId,
        budgetTypeId: spec.budgetTypeId,
        budgetGrantId: spec.budgetGrantId,
        voucherType: spec.type,
        voucherNo: spec.no,
        voucherDate: new Date('2026-04-01T00:00:00.000Z'),
        narration: spec.narration,
        budgetFlow: 'UTILIZATION',
        status: 'POSTED',
      },
    });

    await prisma.voucherLine.deleteMany({ where: { voucherId: voucher.id } });

    for (const line of spec.lines) {
      await prisma.voucherLine.create({
        data: {
          voucherId: voucher.id,
          ledgerId: line.ledgerId,
          type: line.type,
          amount: D(line.amount),
          narration: line.narration,
        },
      });
    }
  }

  const counts = await Promise.all([
    prisma.company.count({ where: { tenantId: tenant.id } }),
    prisma.branch.count({ where: { companyId: company.id } }),
    prisma.warehouse.count({ where: { branch: { companyId: company.id } } }),
    prisma.accountGroup.count({ where: { companyId: company.id } }),
    prisma.ledger.count({ where: { companyId: company.id } }),
    prisma.costCenter.count({ where: { companyId: company.id } }),
    prisma.voucherType.count({ where: { companyId: company.id } }),
    prisma.budgetType.count({ where: { companyId: company.id } }),
    prisma.budgetGrant.count({ where: { companyId: company.id } }),
    prisma.budgetPlan.count({ where: { companyId: company.id } }),
    prisma.voucher.count({ where: { companyId: company.id } }),
    prisma.voucherLine.count({ where: { voucher: { companyId: company.id } } }),
  ]);

  console.log(
    JSON.stringify(
      {
        tenantId: tenant.id,
        companyId: company.id,
        counts: {
          companies: counts[0],
          branches: counts[1],
          warehouses: counts[2],
          accountGroups: counts[3],
          ledgers: counts[4],
          costCenters: counts[5],
          voucherTypes: counts[6],
          budgetTypes: counts[7],
          budgetGrants: counts[8],
          budgetPlans: counts[9],
          vouchers: counts[10],
          voucherLines: counts[11],
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
