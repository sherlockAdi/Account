import { MarketplaceAddon, Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHash } from 'crypto';
import { permissionCatalog } from '../src/identity/permission-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Company',
      slug: 'default',
    },
  });

  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }

  const permissions = await prisma.permission.findMany();
  const adminRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'admin' } },
    update: { name: 'Admin', isSystem: true },
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      code: 'admin',
      description: 'Full access to all modules.',
      isSystem: true,
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  const passwordHash = await hash('Admin@12345', 12);
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@accounterp.local' } },
    update: { fullName: 'System Admin', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      email: 'admin@accounterp.local',
      fullName: 'System Admin',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const company = await prisma.company.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'DEFAULT' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Default Company',
      legalName: 'Default Company',
      code: 'DEFAULT',
      country: 'India',
      financialYearStart: new Date('2026-04-01'),
      booksStartDate: new Date('2026-04-01'),
    },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'HO' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Head Office',
      code: 'HO',
      country: 'India',
      isPrimary: true,
    },
  });

  await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'MAIN' } },
    update: {},
    create: {
      branchId: branch.id,
      name: 'Main Godown',
      code: 'MAIN',
      isPrimary: true,
    },
  });

  for (const series of [
    { module: 'sales_invoice', prefix: 'SI-', nextNumber: 1, padding: 5 },
    { module: 'purchase_invoice', prefix: 'PI-', nextNumber: 1, padding: 5 },
    { module: 'journal_voucher', prefix: 'JV-', nextNumber: 1, padding: 5 },
  ]) {
    await prisma.voucherSeries.upsert({
      where: { companyId_module_prefix: { companyId: company.id, module: series.module, prefix: series.prefix } },
      update: {},
      create: {
        companyId: company.id,
        ...series,
      },
    });
  }

  for (const voucherType of [
    { name: 'Journal', code: 'journal', category: 'accounting', prefix: 'JV-', nextNumber: 1, padding: 5 },
    { name: 'Payment', code: 'payment', category: 'accounting', prefix: 'PAY-', nextNumber: 1, padding: 5 },
    { name: 'Receipt', code: 'receipt', category: 'accounting', prefix: 'REC-', nextNumber: 1, padding: 5 },
    { name: 'Contra', code: 'contra', category: 'accounting', prefix: 'CON-', nextNumber: 1, padding: 5 },
    { name: 'Debit Note', code: 'debit_note', category: 'accounting', prefix: 'DN-', nextNumber: 1, padding: 5 },
    { name: 'Credit Note', code: 'credit_note', category: 'accounting', prefix: 'CN-', nextNumber: 1, padding: 5 },
    { name: 'Sales Invoice', code: 'sales_invoice', category: 'sales', prefix: 'SI-', nextNumber: 1, padding: 5 },
    { name: 'Purchase Invoice', code: 'purchase_invoice', category: 'purchase', prefix: 'PI-', nextNumber: 1, padding: 5 },
  ]) {
    await prisma.voucherType.upsert({
      where: { companyId_code: { companyId: company.id, code: voucherType.code } },
      update: voucherType,
      create: { companyId: company.id, ...voucherType, isSystem: true },
    });
  }

  for (const taxRate of [
    { name: 'GST Exempt / Nil Rated', code: 'GST_0', rate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0 },
    { name: 'GST 5%', code: 'GST_5', rate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 },
    { name: 'GST 12%', code: 'GST_12', rate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12 },
    { name: 'GST 18%', code: 'GST_18', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18 },
    { name: 'GST 28%', code: 'GST_28', rate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28 },
  ]) {
    await prisma.taxRate.upsert({
      where: { companyId_code: { companyId: company.id, code: taxRate.code } },
      update: taxRate,
      create: { companyId: company.id, ...taxRate },
    });
  }

  const groups = [
    { name: 'Capital Account', code: 'CAPITAL', nature: 'EQUITY' },
    { name: 'Bank Accounts', code: 'BANK_ACCOUNTS', nature: 'ASSET' },
    { name: 'Cash-in-Hand', code: 'CASH_IN_HAND', nature: 'ASSET' },
    { name: 'Current Assets', code: 'CURRENT_ASSETS', nature: 'ASSET' },
    { name: 'Current Liabilities', code: 'CURRENT_LIABILITIES', nature: 'LIABILITY' },
    { name: 'Direct Expenses', code: 'DIRECT_EXPENSES', nature: 'EXPENSE' },
    { name: 'Direct Income', code: 'DIRECT_INCOME', nature: 'INCOME' },
    { name: 'Indirect Expenses', code: 'INDIRECT_EXPENSES', nature: 'EXPENSE' },
    { name: 'Indirect Income', code: 'INDIRECT_INCOME', nature: 'INCOME' },
    { name: 'Duties & Taxes', code: 'DUTIES_TAXES', nature: 'LIABILITY' },
    { name: 'Sundry Debtors', code: 'SUNDRY_DEBTORS', nature: 'ASSET' },
    { name: 'Sundry Creditors', code: 'SUNDRY_CREDITORS', nature: 'LIABILITY' },
  ] as const;

  for (const group of groups) {
    await prisma.accountGroup.upsert({
      where: { companyId_code: { companyId: company.id, code: group.code } },
      update: {},
      create: { companyId: company.id, ...group, isSystem: true },
    });
  }

  const currentAssets = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'CURRENT_ASSETS' } } });
  const bankAccounts = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'BANK_ACCOUNTS' } } });
  const cashInHand = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'CASH_IN_HAND' } } });
  const capital = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'CAPITAL' } } });

  for (const ledger of [
    { name: 'Main Cash', code: 'MAIN_CASH', groupId: cashInHand.id, ledgerType: 'CASH', openingBalance: 0, openingType: 'DEBIT' },
    { name: 'Petty Cash', code: 'PETTY_CASH', groupId: cashInHand.id, ledgerType: 'CASH', openingBalance: 0, openingType: 'DEBIT' },
    { name: 'SBI Bank', code: 'SBI_BANK', groupId: bankAccounts.id, ledgerType: 'BANK', bankName: 'State Bank of India', openingBalance: 0, openingType: 'DEBIT' },
    { name: 'HDFC Bank', code: 'HDFC_BANK', groupId: bankAccounts.id, ledgerType: 'BANK', bankName: 'HDFC Bank', openingBalance: 0, openingType: 'DEBIT' },
    { name: 'Owner Capital', code: 'OWNER_CAPITAL', groupId: capital.id, ledgerType: 'CAPITAL', openingBalance: 0, openingType: 'CREDIT' },
    { name: 'Cash', code: 'CASH', groupId: currentAssets.id, ledgerType: 'CASH', openingBalance: 0, openingType: 'DEBIT' },
    { name: 'Bank', code: 'BANK', groupId: bankAccounts.id, ledgerType: 'BANK', openingBalance: 0, openingType: 'DEBIT' },
    { name: 'Capital', code: 'CAPITAL_LEDGER', groupId: capital.id, ledgerType: 'CAPITAL', openingBalance: 0, openingType: 'CREDIT' },
  ] as const) {
    await prisma.ledger.upsert({
      where: { companyId_code: { companyId: company.id, code: ledger.code } },
      update: ledger,
      create: { companyId: company.id, ...ledger, isActive: true },
    });
  }

  for (const unit of [
    { name: 'Numbers', code: 'NOS', decimalPlaces: 0 },
    { name: 'Kilogram', code: 'KG', decimalPlaces: 3 },
    { name: 'Meter', code: 'MTR', decimalPlaces: 2 },
    { name: 'Piece', code: 'PCS', decimalPlaces: 0 },
  ]) {
    await prisma.unit.upsert({
      where: { companyId_code: { companyId: company.id, code: unit.code } },
      update: unit,
      create: { companyId: company.id, ...unit },
    });
  }

  for (const group of [
    { name: 'Raw Materials', code: 'RAW' },
    { name: 'Finished Goods', code: 'FINISHED' },
    { name: 'Packing Materials', code: 'PACKING' },
  ]) {
    await prisma.itemGroup.upsert({
      where: { companyId_code: { companyId: company.id, code: group.code } },
      update: group,
      create: { companyId: company.id, ...group },
    });
  }

  const kg = await prisma.unit.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'KG' } } });
  const pcs = await prisma.unit.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'PCS' } } });
  const raw = await prisma.itemGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'RAW' } } });
  const finished = await prisma.itemGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'FINISHED' } } });
  const mainWarehouse = await prisma.warehouse.findUniqueOrThrow({ where: { branchId_code: { branchId: branch.id, code: 'MAIN' } } });

  for (const item of [
    { name: 'MS Sheet 2mm', code: 'MS-SHEET-2MM', unitId: kg.id, groupId: raw.id, hsnSac: '7208', standardRate: 75, reorderLevel: 100 },
    { name: 'Finished Panel', code: 'FIN-PANEL', unitId: pcs.id, groupId: finished.id, hsnSac: '8538', standardRate: 1250, reorderLevel: 10 },
  ]) {
    const savedItem = await prisma.item.upsert({
      where: { companyId_code: { companyId: company.id, code: item.code } },
      update: item,
      create: { companyId: company.id, ...item },
    });

    const existingOpening = await prisma.stockMovement.findFirst({
      where: { itemId: savedItem.id, warehouseId: mainWarehouse.id, type: 'OPENING', referenceNo: `OPEN-${item.code}` },
    });
    if (!existingOpening) {
      const quantity = item.code === 'MS-SHEET-2MM' ? 500 : 25;
      await prisma.stockMovement.create({
        data: {
          itemId: savedItem.id,
          warehouseId: mainWarehouse.id,
          type: 'OPENING',
          quantity,
          rate: item.standardRate,
          amount: quantity * item.standardRate,
          movementDate: new Date('2026-04-01'),
          referenceType: 'opening',
          referenceNo: `OPEN-${item.code}`,
          narration: 'Opening stock',
        },
      });
    }
  }

  const msSheet = await prisma.item.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: 'MS-SHEET-2MM' } },
  });
  const finishedPanel = await prisma.item.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: 'FIN-PANEL' } },
  });
  const gst18 = await prisma.taxRate.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: 'GST_18' } },
  });

  await prisma.itemTaxRate.upsert({
    where: {
      itemId_effectiveFrom: {
        itemId: msSheet.id,
        effectiveFrom: new Date('2026-04-01'),
      },
    },
    update: { taxRateId: gst18.id, effectiveTo: null },
    create: {
      itemId: msSheet.id,
      taxRateId: gst18.id,
      effectiveFrom: new Date('2026-04-01'),
    },
  });

  const panelBom = await prisma.billOfMaterial.upsert({
    where: {
      companyId_code_version: {
        companyId: company.id,
        code: 'PANEL-STD',
        version: 1,
      },
    },
    update: {
      name: 'Standard Finished Panel',
      finishedItemId: finishedPanel.id,
      outputQuantity: 1,
      effectiveFrom: new Date('2026-04-01'),
      effectiveTo: null,
      isActive: true,
      notes: 'Standard production BOM for one finished electrical panel.',
    },
    create: {
      companyId: company.id,
      finishedItemId: finishedPanel.id,
      name: 'Standard Finished Panel',
      code: 'PANEL-STD',
      version: 1,
      outputQuantity: 1,
      effectiveFrom: new Date('2026-04-01'),
      isActive: true,
      notes: 'Standard production BOM for one finished electrical panel.',
    },
  });

  await prisma.bomComponent.upsert({
    where: { bomId_itemId: { bomId: panelBom.id, itemId: msSheet.id } },
    update: { quantity: 4, wastagePercent: 2 },
    create: {
      bomId: panelBom.id,
      itemId: msSheet.id,
      quantity: 4,
      wastagePercent: 2,
      notes: 'Sheet metal including normal cutting wastage.',
    },
  });

  const completedOrder = await prisma.productionOrder.upsert({
    where: { companyId_orderNo: { companyId: company.id, orderNo: 'MO-DEMO-001' } },
    update: {
      bomId: panelBom.id,
      warehouseId: mainWarehouse.id,
      branchId: branch.id,
      plannedQuantity: 10,
      completedQuantity: 10,
      status: 'COMPLETED',
    },
    create: {
      companyId: company.id,
      bomId: panelBom.id,
      warehouseId: mainWarehouse.id,
      branchId: branch.id,
      orderNo: 'MO-DEMO-001',
      orderDate: new Date('2026-06-01'),
      plannedStartDate: new Date('2026-06-02'),
      plannedEndDate: new Date('2026-06-05'),
      plannedQuantity: 10,
      completedQuantity: 10,
      status: 'COMPLETED',
      notes: 'Completed demo production batch.',
    },
  });

  const inProgressOrder = await prisma.productionOrder.upsert({
    where: { companyId_orderNo: { companyId: company.id, orderNo: 'MO-DEMO-002' } },
    update: {
      bomId: panelBom.id,
      warehouseId: mainWarehouse.id,
      branchId: branch.id,
      plannedQuantity: 20,
      completedQuantity: 8,
      status: 'IN_PROGRESS',
    },
    create: {
      companyId: company.id,
      bomId: panelBom.id,
      warehouseId: mainWarehouse.id,
      branchId: branch.id,
      orderNo: 'MO-DEMO-002',
      orderDate: new Date('2026-06-08'),
      plannedStartDate: new Date('2026-06-09'),
      plannedEndDate: new Date('2026-06-18'),
      plannedQuantity: 20,
      completedQuantity: 8,
      status: 'IN_PROGRESS',
      notes: 'Current production batch in progress.',
    },
  });

  await prisma.productionOrder.upsert({
    where: { companyId_orderNo: { companyId: company.id, orderNo: 'MO-DEMO-003' } },
    update: {
      bomId: panelBom.id,
      warehouseId: mainWarehouse.id,
      branchId: branch.id,
      plannedQuantity: 15,
      completedQuantity: 0,
      status: 'PLANNED',
    },
    create: {
      companyId: company.id,
      bomId: panelBom.id,
      warehouseId: mainWarehouse.id,
      branchId: branch.id,
      orderNo: 'MO-DEMO-003',
      orderDate: new Date('2026-06-13'),
      plannedStartDate: new Date('2026-06-16'),
      plannedEndDate: new Date('2026-06-22'),
      plannedQuantity: 15,
      status: 'PLANNED',
      notes: 'Upcoming planned production batch.',
    },
  });

  const rawMaterialLedger = await prisma.ledger.upsert({
    where: { companyId_code: { companyId: company.id, code: 'RAW_MATERIAL_INVENTORY' } },
    update: { groupId: currentAssets.id },
    create: {
      companyId: company.id,
      groupId: currentAssets.id,
      name: 'Raw Material Inventory',
      code: 'RAW_MATERIAL_INVENTORY',
      ledgerType: 'GENERAL',
      openingType: 'DEBIT',
    },
  });
  const finishedGoodsLedger = await prisma.ledger.upsert({
    where: { companyId_code: { companyId: company.id, code: 'FINISHED_GOODS_INVENTORY' } },
    update: { groupId: currentAssets.id },
    create: {
      companyId: company.id,
      groupId: currentAssets.id,
      name: 'Finished Goods Inventory',
      code: 'FINISHED_GOODS_INVENTORY',
      ledgerType: 'GENERAL',
      openingType: 'DEBIT',
    },
  });

  const completedEntry = await prisma.productionEntry.findUnique({
    where: {
      productionOrderId_entryNo: {
        productionOrderId: completedOrder.id,
        entryNo: 'PE-DEMO-001',
      },
    },
  });

  if (!completedEntry) {
    const consumedQuantity = 40.8;
    const materialCost = consumedQuantity * Number(msSheet.standardRate);
    const voucherNo = 'MO-DEMO-001-PE-DEMO-001';

    await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.upsert({
        where: {
          companyId_voucherType_voucherNo: {
            companyId: company.id,
            voucherType: 'production',
            voucherNo,
          },
        },
        update: {},
        create: {
          companyId: company.id,
          branchId: branch.id,
          voucherType: 'production',
          voucherNo,
          voucherDate: new Date('2026-06-05'),
          narration: 'Demo production completion for MO-DEMO-001',
          lines: {
            create: [
              {
                ledgerId: finishedGoodsLedger.id,
                type: 'DEBIT',
                amount: materialCost,
                narration: 'Finished panel production',
              },
              {
                ledgerId: rawMaterialLedger.id,
                type: 'CREDIT',
                amount: materialCost,
                narration: 'MS sheet consumption',
              },
            ],
          },
        },
      });

      const entry = await tx.productionEntry.create({
        data: {
          productionOrderId: completedOrder.id,
          outputItemId: finishedPanel.id,
          entryNo: 'PE-DEMO-001',
          productionDate: new Date('2026-06-05'),
          quantity: 10,
          materialCost,
          unitCost: materialCost / 10,
          accountingVoucherId: voucher.id,
          notes: 'Seeded completed production entry.',
          consumptions: {
            create: {
              itemId: msSheet.id,
              quantity: consumedQuantity,
              rate: msSheet.standardRate,
              amount: materialCost,
            },
          },
        },
      });

      await tx.stockMovement.createMany({
        data: [
          {
            itemId: msSheet.id,
            warehouseId: mainWarehouse.id,
            type: 'CONSUMPTION',
            quantity: consumedQuantity,
            rate: msSheet.standardRate,
            amount: materialCost,
            movementDate: new Date('2026-06-05'),
            referenceType: 'production_entry',
            referenceNo: voucherNo,
            narration: 'Seeded production material consumption',
          },
          {
            itemId: finishedPanel.id,
            warehouseId: mainWarehouse.id,
            type: 'PRODUCTION_IN',
            quantity: 10,
            rate: materialCost / 10,
            amount: materialCost,
            movementDate: new Date('2026-06-05'),
            referenceType: 'production_entry',
            referenceNo: voucherNo,
            narration: 'Seeded finished goods production',
          },
        ],
      });

      return entry;
    });
  }

  const partialEntry = await prisma.productionEntry.findUnique({
    where: {
      productionOrderId_entryNo: {
        productionOrderId: inProgressOrder.id,
        entryNo: 'PE-DEMO-002',
      },
    },
  });

  if (!partialEntry) {
    const consumedQuantity = 32.64;
    const materialCost = consumedQuantity * Number(msSheet.standardRate);
    const voucherNo = 'MO-DEMO-002-PE-DEMO-002';

    await prisma.$transaction(async (tx) => {
      const voucher = await tx.voucher.upsert({
        where: {
          companyId_voucherType_voucherNo: {
            companyId: company.id,
            voucherType: 'production',
            voucherNo,
          },
        },
        update: {},
        create: {
          companyId: company.id,
          branchId: branch.id,
          voucherType: 'production',
          voucherNo,
          voucherDate: new Date('2026-06-12'),
          narration: 'Partial demo production for MO-DEMO-002',
          lines: {
            create: [
              {
                ledgerId: finishedGoodsLedger.id,
                type: 'DEBIT',
                amount: materialCost,
                narration: 'Finished panel production',
              },
              {
                ledgerId: rawMaterialLedger.id,
                type: 'CREDIT',
                amount: materialCost,
                narration: 'MS sheet consumption',
              },
            ],
          },
        },
      });

      await tx.productionEntry.create({
        data: {
          productionOrderId: inProgressOrder.id,
          outputItemId: finishedPanel.id,
          entryNo: 'PE-DEMO-002',
          productionDate: new Date('2026-06-12'),
          quantity: 8,
          materialCost,
          unitCost: materialCost / 8,
          accountingVoucherId: voucher.id,
          notes: 'Seeded partial production entry.',
          consumptions: {
            create: {
              itemId: msSheet.id,
              quantity: consumedQuantity,
              rate: msSheet.standardRate,
              amount: materialCost,
            },
          },
        },
      });

      await tx.stockMovement.createMany({
        data: [
          {
            itemId: msSheet.id,
            warehouseId: mainWarehouse.id,
            type: 'CONSUMPTION',
            quantity: consumedQuantity,
            rate: msSheet.standardRate,
            amount: materialCost,
            movementDate: new Date('2026-06-12'),
            referenceType: 'production_entry',
            referenceNo: voucherNo,
            narration: 'Seeded partial production consumption',
          },
          {
            itemId: finishedPanel.id,
            warehouseId: mainWarehouse.id,
            type: 'PRODUCTION_IN',
            quantity: 8,
            rate: materialCost / 8,
            amount: materialCost,
            movementDate: new Date('2026-06-12'),
            referenceType: 'production_entry',
            referenceNo: voucherNo,
            narration: 'Seeded partial finished goods production',
          },
        ],
      });
    });
  }

  const sundryCreditors = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'SUNDRY_CREDITORS' } } });
  const vendorLedger = await prisma.ledger.upsert({
    where: { companyId_code: { companyId: company.id, code: 'VENDOR_STEEL_SUPPLIER' } },
    update: { ledgerType: 'VENDOR', groupId: sundryCreditors.id },
    create: {
      companyId: company.id,
      groupId: sundryCreditors.id,
      name: 'Steel Supplier Co.',
      code: 'VENDOR_STEEL_SUPPLIER',
      ledgerType: 'VENDOR',
      openingType: 'CREDIT',
    },
  });

  await prisma.vendor.upsert({
    where: { companyId_code: { companyId: company.id, code: 'STEEL_SUPPLIER' } },
    update: {},
    create: {
      companyId: company.id,
      ledgerId: vendorLedger.id,
      name: 'Steel Supplier Co.',
      code: 'STEEL_SUPPLIER',
      state: 'Maharashtra',
    },
  });

  const sundryDebtors = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'SUNDRY_DEBTORS' } } });
  const customerLedger = await prisma.ledger.upsert({
    where: { companyId_code: { companyId: company.id, code: 'CUSTOMER_ABC_INDUSTRIES' } },
    update: { ledgerType: 'CUSTOMER', groupId: sundryDebtors.id },
    create: {
      companyId: company.id,
      groupId: sundryDebtors.id,
      name: 'ABC Industries',
      code: 'CUSTOMER_ABC_INDUSTRIES',
      ledgerType: 'CUSTOMER',
      openingType: 'DEBIT',
    },
  });

  await prisma.customer.upsert({
    where: { companyId_code: { companyId: company.id, code: 'ABC_INDUSTRIES' } },
    update: {},
    create: {
      companyId: company.id,
      ledgerId: customerLedger.id,
      name: 'ABC Industries',
      code: 'ABC_INDUSTRIES',
      state: 'Maharashtra',
    },
  });

  const payrollEmployees = [
    {
      employeeCode: 'EMP-001', firstName: 'Aarav', lastName: 'Sharma', designation: 'Production Manager',
      department: 'Manufacturing', email: 'aarav.sharma@example.com', dateOfJoining: new Date('2024-04-15'),
      pan: 'ABCDE1234F', uan: '100000000001', bankAccountNo: '501001234501', bankIfsc: 'HDFC0000123',
      salary: { basic: 30000, hra: 12000, specialAllowance: 8000, conveyanceAllowance: 1600, otherAllowance: 0, pfPercent: 12, esiPercent: 0.75, professionalTax: 200, tds: 1000 },
      june: { workingDays: 26, payableDays: 26, overtimeHours: 0, overtimeAmount: 0 },
    },
    {
      employeeCode: 'EMP-002', firstName: 'Meera', lastName: 'Patel', designation: 'Accounts Executive',
      department: 'Finance', email: 'meera.patel@example.com', dateOfJoining: new Date('2025-01-06'),
      pan: 'FGHIJ5678K', uan: '100000000002', bankAccountNo: '501001234502', bankIfsc: 'HDFC0000123',
      salary: { basic: 22000, hra: 8800, specialAllowance: 5000, conveyanceAllowance: 1600, otherAllowance: 0, pfPercent: 12, esiPercent: 0.75, professionalTax: 200, tds: 0 },
      june: { workingDays: 26, payableDays: 24, overtimeHours: 0, overtimeAmount: 0 },
    },
    {
      employeeCode: 'EMP-003', firstName: 'Rohan', lastName: 'Verma', designation: 'Machine Operator',
      department: 'Manufacturing', email: 'rohan.verma@example.com', dateOfJoining: new Date('2025-07-21'),
      uan: '100000000003', esiNumber: '3100000001', bankAccountNo: '501001234503', bankIfsc: 'HDFC0000123',
      salary: { basic: 18000, hra: 7200, specialAllowance: 4000, conveyanceAllowance: 1600, otherAllowance: 0, pfPercent: 12, esiPercent: 0.75, professionalTax: 200, tds: 0 },
      june: { workingDays: 26, payableDays: 26, overtimeHours: 8, overtimeAmount: 1200 },
    },
    {
      employeeCode: 'EMP-004', firstName: 'Nisha', lastName: 'Singh', designation: 'Quality Inspector',
      department: 'Quality', email: 'nisha.singh@example.com', dateOfJoining: new Date('2026-02-02'),
      uan: '100000000004', esiNumber: '3100000002', bankAccountNo: '501001234504', bankIfsc: 'HDFC0000123',
      salary: { basic: 20000, hra: 8000, specialAllowance: 4500, conveyanceAllowance: 1600, otherAllowance: 0, pfPercent: 12, esiPercent: 0.75, professionalTax: 200, tds: 0 },
      june: { workingDays: 26, payableDays: 25, overtimeHours: 4, overtimeAmount: 600 },
    },
  ];

  const savedEmployees: Array<{
    employeeId: string;
    salary: (typeof payrollEmployees)[number]['salary'];
  }> = [];
  for (const employeeData of payrollEmployees) {
    const { salary, june, ...employee } = employeeData;
    const savedEmployee = await prisma.employee.upsert({
      where: { companyId_employeeCode: { companyId: company.id, employeeCode: employee.employeeCode } },
      update: { ...employee, branchId: branch.id, status: 'ACTIVE' },
      create: { companyId: company.id, branchId: branch.id, ...employee, status: 'ACTIVE' },
    });
    await prisma.salaryStructure.upsert({
      where: { employeeId_effectiveFrom: { employeeId: savedEmployee.id, effectiveFrom: new Date('2026-04-01') } },
      update: salary,
      create: { employeeId: savedEmployee.id, effectiveFrom: new Date('2026-04-01'), ...salary, notes: 'Seeded FY 2026-27 salary structure' },
    });
    await prisma.payrollAttendance.upsert({
      where: { employeeId_year_month: { employeeId: savedEmployee.id, year: 2026, month: 5 } },
      update: { workingDays: 26, payableDays: 26 },
      create: { employeeId: savedEmployee.id, year: 2026, month: 5, workingDays: 26, payableDays: 26, notes: 'Seeded full-month attendance' },
    });
    await prisma.payrollAttendance.upsert({
      where: { employeeId_year_month: { employeeId: savedEmployee.id, year: 2026, month: 6 } },
      update: june,
      create: { employeeId: savedEmployee.id, year: 2026, month: 6, ...june, notes: 'Seeded current-month attendance' },
    });
    savedEmployees.push({ employeeId: savedEmployee.id, salary });
  }

  const indirectExpenses = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'INDIRECT_EXPENSES' } } });
  const currentLiabilities = await prisma.accountGroup.findUniqueOrThrow({ where: { companyId_code: { companyId: company.id, code: 'CURRENT_LIABILITIES' } } });
  const payrollLedgerData = [
    { code: 'SALARY_EXPENSE', name: 'Salary and Wages', groupId: indirectExpenses.id, openingType: 'DEBIT' },
    { code: 'SALARY_PAYABLE', name: 'Salary Payable', groupId: currentLiabilities.id, openingType: 'CREDIT' },
    { code: 'PF_PAYABLE', name: 'Provident Fund Payable', groupId: currentLiabilities.id, openingType: 'CREDIT' },
    { code: 'ESI_PAYABLE', name: 'ESI Payable', groupId: currentLiabilities.id, openingType: 'CREDIT' },
    { code: 'PROFESSIONAL_TAX_PAYABLE', name: 'Professional Tax Payable', groupId: currentLiabilities.id, openingType: 'CREDIT' },
    { code: 'TDS_SALARY_PAYABLE', name: 'TDS on Salary Payable', groupId: currentLiabilities.id, openingType: 'CREDIT' },
  ] as const;
  const payrollLedgers = new Map<string, string>();
  for (const ledger of payrollLedgerData) {
    const saved = await prisma.ledger.upsert({
      where: { companyId_code: { companyId: company.id, code: ledger.code } },
      update: { name: ledger.name, groupId: ledger.groupId, openingType: ledger.openingType },
      create: { companyId: company.id, ...ledger },
    });
    payrollLedgers.set(ledger.code, saved.id);
  }

  const existingMayRun = await prisma.payrollRun.findFirst({
    where: { companyId: company.id, year: 2026, month: 5, branchId: null },
  });
  if (!existingMayRun) {
    const payslips = savedEmployees.map(({ employeeId, salary }) => {
      const grossEarnings = salary.basic + salary.hra + salary.specialAllowance + salary.conveyanceAllowance + salary.otherAllowance;
      const providentFund = Math.round(salary.basic * salary.pfPercent) / 100;
      const esi = Math.round(grossEarnings * salary.esiPercent) / 100;
      const totalDeductions = providentFund + esi + salary.professionalTax + salary.tds;
      return {
        employeeId, workingDays: 26, payableDays: 26,
        basic: salary.basic, hra: salary.hra, specialAllowance: salary.specialAllowance,
        conveyanceAllowance: salary.conveyanceAllowance, otherAllowance: salary.otherAllowance,
        overtimeAmount: 0, grossEarnings, providentFund, esi,
        professionalTax: salary.professionalTax, tds: salary.tds, otherDeductions: 0,
        totalDeductions, netPay: grossEarnings - totalDeductions,
      };
    });
    const total = (key: 'grossEarnings' | 'providentFund' | 'esi' | 'professionalTax' | 'tds' | 'totalDeductions' | 'netPay') =>
      payslips.reduce((sum, payslip) => sum + payslip[key], 0);
    const gross = total('grossEarnings');
    const voucher = await prisma.voucher.create({
      data: {
        companyId: company.id, voucherType: 'payroll', voucherNo: 'PAY-2026-05',
        voucherDate: new Date('2026-05-31'), narration: 'Seeded payroll for May 2026',
        lines: {
          create: [
            { ledgerId: payrollLedgers.get('SALARY_EXPENSE')!, type: 'DEBIT', amount: gross },
            { ledgerId: payrollLedgers.get('SALARY_PAYABLE')!, type: 'CREDIT', amount: total('netPay') },
            { ledgerId: payrollLedgers.get('PF_PAYABLE')!, type: 'CREDIT', amount: total('providentFund') },
            { ledgerId: payrollLedgers.get('ESI_PAYABLE')!, type: 'CREDIT', amount: total('esi') },
            { ledgerId: payrollLedgers.get('PROFESSIONAL_TAX_PAYABLE')!, type: 'CREDIT', amount: total('professionalTax') },
            { ledgerId: payrollLedgers.get('TDS_SALARY_PAYABLE')!, type: 'CREDIT', amount: total('tds') },
          ],
        },
      },
    });
    await prisma.payrollRun.create({
      data: {
        companyId: company.id, year: 2026, month: 5, runNo: 'PAY-2026-05',
        paymentDate: new Date('2026-05-31'), status: 'PROCESSED',
        totalGross: gross, totalDeductions: total('totalDeductions'), totalNet: total('netPay'),
        accountingVoucherId: voucher.id, notes: 'Seeded processed payroll',
        payslips: { create: payslips },
      },
    });
  }

  const sbiBank = await prisma.ledger.update({
    where: { companyId_code: { companyId: company.id, code: 'SBI_BANK' } },
    data: {
      bankName: 'State Bank of India',
      bankAccountNo: '000000451278',
      bankIfsc: 'SBIN0000451',
      bankBranch: 'Industrial Area',
      openingBalance: 250000,
      openingType: 'DEBIT',
    },
  });
  await prisma.ledger.update({
    where: { companyId_code: { companyId: company.id, code: 'HDFC_BANK' } },
    data: {
      bankName: 'HDFC Bank',
      bankAccountNo: '50100123456789',
      bankIfsc: 'HDFC0000123',
      bankBranch: 'Main Branch',
      openingBalance: 100000,
      openingType: 'DEBIT',
    },
  });
  await prisma.ledger.update({
    where: { companyId_code: { companyId: company.id, code: 'OWNER_CAPITAL' } },
    data: {
      openingBalance: 350000,
      openingType: 'CREDIT',
    },
  });
  const mainCash = await prisma.ledger.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: 'MAIN_CASH' } },
  });

  const bankingVouchers = [
    {
      voucherType: 'receipt', voucherNo: 'REC-BANK-001', voucherDate: new Date('2026-06-03'),
      narration: 'Customer receipt through NEFT', bankType: 'DEBIT', amount: 125000,
      partyLedgerId: customerLedger.id, partyType: 'CREDIT', bankReference: 'SBINR260603001',
    },
    {
      voucherType: 'payment', voucherNo: 'PAY-BANK-001', voucherDate: new Date('2026-06-08'),
      narration: 'Supplier payment through NEFT', bankType: 'CREDIT', amount: 45000,
      partyLedgerId: vendorLedger.id, partyType: 'DEBIT', bankReference: null,
    },
    {
      voucherType: 'contra', voucherNo: 'CON-BANK-001', voucherDate: new Date('2026-06-10'),
      narration: 'Cash withdrawn for petty expenses', bankType: 'CREDIT', amount: 10000,
      partyLedgerId: mainCash.id, partyType: 'DEBIT', bankReference: 'ATM26061092',
    },
  ] as const;

  const savedBankingVouchers: Array<{
    voucherNo: string;
    voucherDate: Date;
    bankReference: string | null;
    voucher: Prisma.VoucherGetPayload<{ include: { lines: true } }>;
  }> = [];
  for (const bankingVoucher of bankingVouchers) {
    const voucher = await prisma.voucher.upsert({
      where: {
        companyId_voucherType_voucherNo: {
          companyId: company.id,
          voucherType: bankingVoucher.voucherType,
          voucherNo: bankingVoucher.voucherNo,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        branchId: branch.id,
        voucherType: bankingVoucher.voucherType,
        voucherNo: bankingVoucher.voucherNo,
        voucherDate: bankingVoucher.voucherDate,
        narration: bankingVoucher.narration,
        lines: {
          create: [
            { ledgerId: sbiBank.id, type: bankingVoucher.bankType, amount: bankingVoucher.amount, narration: bankingVoucher.bankReference },
            { ledgerId: bankingVoucher.partyLedgerId, type: bankingVoucher.partyType, amount: bankingVoucher.amount, narration: bankingVoucher.narration },
          ],
        },
      },
      include: { lines: true },
    });
    savedBankingVouchers.push({ ...bankingVoucher, voucher });
  }

  for (const bankEntry of savedBankingVouchers.filter((entry) => entry.bankReference)) {
    const bankLine = bankEntry.voucher.lines.find((line) => line.ledgerId === sbiBank.id)!;
    await prisma.bankReconciliation.upsert({
      where: { voucherLineId: bankLine.id },
      update: {},
      create: {
        companyId: company.id,
        bankLedgerId: sbiBank.id,
        voucherLineId: bankLine.id,
        clearedDate: bankEntry.voucherDate,
        bankReference: bankEntry.bankReference,
        notes: 'Seeded bank statement match',
      },
    });
  }

  await prisma.cheque.upsert({
    where: { bankLedgerId_chequeNo: { bankLedgerId: sbiBank.id, chequeNo: '000341' } },
    update: {},
    create: {
      companyId: company.id, bankLedgerId: sbiBank.id, partyLedgerId: vendorLedger.id,
      chequeNo: '000341', chequeDate: new Date('2026-06-15'), amount: 28000,
      direction: 'ISSUED', status: 'PENDING', payeeName: 'Steel Supplier Co.', notes: 'Material payment cheque',
    },
  });
  await prisma.cheque.upsert({
    where: { bankLedgerId_chequeNo: { bankLedgerId: sbiBank.id, chequeNo: '884201' } },
    update: {},
    create: {
      companyId: company.id, bankLedgerId: sbiBank.id, partyLedgerId: customerLedger.id,
      chequeNo: '884201', chequeDate: new Date('2026-06-11'), amount: 32000,
      direction: 'RECEIVED', status: 'DEPOSITED', payeeName: 'ABC Industries', notes: 'Customer cheque deposited',
    },
  });

  const supplierPayment = savedBankingVouchers.find((entry) => entry.voucherNo === 'PAY-BANK-001')!.voucher;
  await prisma.paymentAdvice.upsert({
    where: { companyId_adviceNo: { companyId: company.id, adviceNo: 'ADV-DEMO-001' } },
    update: {},
    create: {
      companyId: company.id,
      bankLedgerId: sbiBank.id,
      beneficiaryLedgerId: vendorLedger.id,
      voucherId: supplierPayment.id,
      adviceNo: 'ADV-DEMO-001',
      adviceDate: new Date('2026-06-08'),
      paymentDate: new Date('2026-06-08'),
      amount: 45000,
      paymentMode: 'NEFT',
      bankReference: 'SBINP260608442',
      status: 'PAID',
      narration: 'Payment against steel supplies',
    },
  });

  const seededAudit = await prisma.auditLog.findFirst({
    where: { tenantId: tenant.id, description: 'Seeded company configuration review' },
  });
  if (!seededAudit) {
    await prisma.auditLog.createMany({
      data: [
        {
          tenantId: tenant.id, companyId: company.id, userId: adminUser.id,
          module: 'companies', action: 'UPDATE', entityType: 'company', entityId: company.id,
          description: 'Seeded company configuration review', method: 'PATCH', path: `/api/v1/companies/${company.id}`,
          outcome: 'SUCCESS', statusCode: 200, changes: { financialYearStart: '2026-04-01', booksStartDate: '2026-04-01' },
          metadata: { source: 'seed' }, createdAt: new Date('2026-06-10T09:15:00Z'),
        },
        {
          tenantId: tenant.id, companyId: company.id, userId: adminUser.id,
          module: 'accounting', action: 'CREATE', entityType: 'vouchers',
          description: 'Created payment voucher', method: 'POST', path: '/api/v1/accounting/vouchers',
          outcome: 'SUCCESS', statusCode: 201, changes: { voucherType: 'payment', amount: 45000 },
          metadata: { number: 'PAY-BANK-001', source: 'seed' }, createdAt: new Date('2026-06-11T06:30:00Z'),
        },
        {
          tenantId: tenant.id, companyId: company.id, userId: adminUser.id,
          module: 'inventory', action: 'UPDATE', entityType: 'items', entityId: finishedPanel.id,
          description: 'Updated finished panel master', method: 'PATCH', path: `/api/v1/inventory/items/${finishedPanel.id}`,
          outcome: 'SUCCESS', statusCode: 200, changes: { reorderLevel: 10, standardRate: 1250 },
          metadata: { source: 'seed' }, createdAt: new Date('2026-06-12T08:20:00Z'),
        },
        {
          tenantId: tenant.id, companyId: company.id, userId: adminUser.id,
          module: 'auth', action: 'LOGIN', entityType: 'session',
          description: 'Successful administrator login', method: 'POST', path: '/api/v1/auth/login',
          ipAddress: '127.0.0.1', userAgent: 'Local browser', outcome: 'SUCCESS', statusCode: 200,
          changes: { email: 'admin@accounterp.local', password: '[REDACTED]' },
          metadata: { source: 'seed' }, createdAt: new Date('2026-06-13T04:45:00Z'),
        },
        {
          tenantId: tenant.id, companyId: company.id,
          module: 'auth', action: 'LOGIN', entityType: 'session',
          description: 'Failed login attempt', method: 'POST', path: '/api/v1/auth/login',
          ipAddress: '127.0.0.1', userAgent: 'Local browser', outcome: 'FAILURE', statusCode: 401,
          changes: { email: 'unknown@example.com', password: '[REDACTED]' },
          metadata: { error: 'Invalid email or password', source: 'seed' }, createdAt: new Date('2026-06-13T04:40:00Z'),
        },
      ],
    });
  }

  const vouchersForVerification = await prisma.voucher.findMany({
    where: { companyId: company.id, deletedAt: null },
    orderBy: { voucherDate: 'asc' },
    take: 3,
  });
  if (vouchersForVerification[0]) {
    await prisma.voucherVerification.upsert({
      where: { voucherId: vouchersForVerification[0].id },
      update: {},
      create: {
        voucherId: vouchersForVerification[0].id, status: 'VERIFIED',
        verifiedById: adminUser.id, verifiedAt: new Date('2026-06-12T10:00:00Z'),
        remarks: 'Supporting documents and ledger posting checked.',
      },
    });
  }
  if (vouchersForVerification[1]) {
    await prisma.voucherVerification.upsert({
      where: { voucherId: vouchersForVerification[1].id },
      update: {},
      create: {
        voucherId: vouchersForVerification[1].id, status: 'REJECTED',
        verifiedById: adminUser.id, verifiedAt: new Date('2026-06-12T10:15:00Z'),
        remarks: 'Reference document requires correction.',
      },
    });
  }

  const addonCatalog = [
    {
      slug: 'gst-autopilot', name: 'GST Autopilot', publisher: 'Multifacet Labs',
      description: 'Automate GST checks, return preparation, HSN validation, and filing reminders.',
      category: 'COMPLIANCE', pricingModel: 'MONTHLY', price: 1499, version: '2.4.0',
      icon: 'safety', isFeatured: true, features: ['Return readiness checks', 'HSN validation', 'Filing calendar'],
    },
    {
      slug: 'bank-feed-connect', name: 'Bank Feed Connect', publisher: 'Multifacet Labs',
      description: 'Import daily bank feeds and automatically suggest reconciliation matches.',
      category: 'INTEGRATION', pricingModel: 'MONTHLY', price: 999, version: '1.8.2',
      icon: 'bank', isFeatured: true, features: ['Automatic bank feeds', 'Match suggestions', 'Duplicate detection'],
    },
    {
      slug: 'advanced-profitability', name: 'Advanced Profitability', publisher: 'LedgerWorks',
      description: 'Product, customer, branch, and project profitability dashboards.',
      category: 'REPORTING', pricingModel: 'ANNUAL', price: 12000, version: '3.1.0',
      icon: 'chart', isFeatured: false, features: ['Margin waterfall', 'Segment comparison', 'Scheduled reports'],
    },
    {
      slug: 'ecommerce-sync', name: 'E-commerce Sync', publisher: 'CommerceGrid',
      description: 'Synchronize orders, inventory, invoices, and returns with online storefronts.',
      category: 'COMMERCE', pricingModel: 'USAGE', price: 799, version: '1.5.3',
      icon: 'shop', isFeatured: true, features: ['Order sync', 'Stock publishing', 'Return reconciliation'],
    },
    {
      slug: 'approval-automation', name: 'Approval Automation', publisher: 'Multifacet Labs',
      description: 'Add configurable approval workflows for vouchers, purchases, and payments.',
      category: 'AUTOMATION', pricingModel: 'MONTHLY', price: 599, version: '1.2.1',
      icon: 'check', isFeatured: false, features: ['Multi-level approvals', 'Escalation rules', 'Mobile-ready inbox'],
    },
    {
      slug: 'invoice-pdf-designer', name: 'Invoice PDF Designer', publisher: 'Paperplane Studio',
      description: 'Create branded invoice, quotation, and delivery note layouts.',
      category: 'ACCOUNTING', pricingModel: 'FREE', price: 0, version: '2.0.0',
      icon: 'file', isFeatured: false, features: ['Drag and drop layouts', 'Custom fields', 'Print presets'],
    },
  ] as const;

  const seededAddons: MarketplaceAddon[] = [];
  for (const addon of addonCatalog) {
    seededAddons.push(await prisma.marketplaceAddon.upsert({
      where: { slug: addon.slug },
      update: { ...addon, features: [...addon.features] },
      create: { ...addon, features: [...addon.features] },
    }));
  }

  for (const slug of ['gst-autopilot', 'invoice-pdf-designer']) {
    const addon = seededAddons.find((entry) => entry.slug === slug)!;
    await prisma.addonInstallation.upsert({
      where: { tenantId_addonId: { tenantId: tenant.id, addonId: addon.id } },
      update: {},
      create: {
        tenantId: tenant.id, companyId: company.id, addonId: addon.id,
        status: slug === 'gst-autopilot' ? 'TRIAL' : 'ACTIVE',
        plan: slug === 'gst-autopilot' ? 'Professional' : 'Free',
        trialEndsAt: slug === 'gst-autopilot' ? new Date('2026-06-28') : null,
        nextBillingAt: slug === 'gst-autopilot' ? new Date('2026-06-28') : null,
      },
    });
  }

  const apiSecret = 'erp_live_seeded_demo_secret';
  await prisma.marketplaceApiApp.upsert({
    where: { clientId: 'app_demo_inventory_sync' },
    update: {},
    create: {
      tenantId: tenant.id, companyId: company.id, name: 'Inventory Mobile App',
      clientId: 'app_demo_inventory_sync',
      secretHash: createHash('sha256').update(apiSecret).digest('hex'),
      secretPreview: 'erp_live...cret',
      scopes: ['inventory.read', 'sales.invoice.read'],
      status: 'ACTIVE', lastUsedAt: new Date('2026-06-13T08:30:00Z'),
    },
  });

  const existingWebhook = await prisma.marketplaceWebhook.findFirst({
    where: { tenantId: tenant.id, name: 'Order Processing' },
  });
  if (!existingWebhook) {
    await prisma.marketplaceWebhook.createMany({
      data: [
        {
          tenantId: tenant.id, companyId: company.id, name: 'Order Processing',
          url: 'https://example.internal/webhooks/orders',
          events: ['sales.invoice.created', 'sales.return.created'],
          secretHash: createHash('sha256').update('whsec_demo_orders').digest('hex'),
          secretPreview: 'whsec_de...ders', status: 'ACTIVE', successCount: 128, failureCount: 2,
          lastDeliveryAt: new Date('2026-06-13T10:20:00Z'), lastStatusCode: 200,
        },
        {
          tenantId: tenant.id, companyId: company.id, name: 'Stock Alerts',
          url: 'https://fail.example.internal/webhooks/stock',
          events: ['inventory.low_stock'],
          secretHash: createHash('sha256').update('whsec_demo_stock').digest('hex'),
          secretPreview: 'whsec_de...tock', status: 'FAILING', successCount: 42, failureCount: 5,
          lastDeliveryAt: new Date('2026-06-13T09:55:00Z'), lastStatusCode: 503,
          lastError: 'Endpoint unavailable',
        },
      ],
    });
  }

  const complianceRules = [
    {
      name: 'GST Standard Rate Framework', code: 'GST_STANDARD', type: 'TAX', version: 1,
      effectiveFrom: new Date('2026-04-01'), effectiveTo: null, status: 'ACTIVE',
      description: 'Standard GST rate structure and intra-state tax split.',
      configuration: { rates: [0, 5, 12, 18, 28], intraStateSplit: 'CGST_SGST', interstateTax: 'IGST' },
      sourceUrl: 'https://www.gst.gov.in/',
    },
    {
      name: 'Tax Invoice Mandatory Fields', code: 'GST_INVOICE_FIELDS', type: 'INVOICE', version: 1,
      effectiveFrom: new Date('2026-04-01'), effectiveTo: null, status: 'ACTIVE',
      description: 'Mandatory fields and numbering controls for GST tax invoices.',
      configuration: { requiredFields: ['invoiceNo', 'invoiceDate', 'gstin', 'hsnSac', 'taxableValue', 'taxAmount'], maxSerialLength: 16 },
      sourceUrl: 'https://www.gst.gov.in/',
    },
    {
      name: 'Provident Fund Contribution', code: 'PF_CONTRIBUTION', type: 'PAYROLL', version: 1,
      effectiveFrom: new Date('2026-04-01'), effectiveTo: null, status: 'ACTIVE',
      description: 'Employee provident fund contribution percentage and wage ceiling.',
      configuration: { employeePercent: 12, employerPercent: 12, wageCeiling: 15000 },
      sourceUrl: 'https://www.epfindia.gov.in/',
    },
    {
      name: 'Financial Year Voucher Numbering', code: 'FY_NUMBERING', type: 'NUMBERING', version: 1,
      effectiveFrom: new Date('2026-04-01'), effectiveTo: new Date('2027-03-31'), status: 'ACTIVE',
      description: 'Voucher numbering must remain unique within the financial year.',
      configuration: { reset: 'FINANCIAL_YEAR', allowDuplicates: false, sequencePadding: 5 },
    },
    {
      name: 'E-Invoice Turnover Threshold Draft', code: 'EINVOICE_THRESHOLD', type: 'STATUTORY', version: 1,
      effectiveFrom: new Date('2026-07-01'), effectiveTo: null, status: 'DRAFT',
      description: 'Draft turnover threshold for e-invoice applicability review.',
      configuration: { annualTurnoverThreshold: 50000000, currency: 'INR' },
      sourceUrl: 'https://einvoice1.gst.gov.in/',
    },
  ] as const;

  for (const rule of complianceRules) {
    const existingRule = await prisma.complianceRule.findFirst({
      where: { tenantId: tenant.id, code: rule.code, country: 'India', state: null, version: rule.version },
    });
    if (!existingRule) {
      await prisma.complianceRule.create({
        data: {
          tenantId: tenant.id, companyId: company.id, country: 'India', state: null,
          ...rule, configuration: rule.configuration as Prisma.InputJsonValue,
        },
      });
    }
  }

  const obligations = [
    { name: 'GSTR-1 Return', code: 'GSTR1', periodLabel: 'May 2026', dueDate: new Date('2026-06-11'), status: 'FILED', referenceNo: 'ARN-GSTR1-052026', assignedTo: 'Accounts Team', filedAt: new Date('2026-06-10') },
    { name: 'GSTR-3B Return', code: 'GSTR3B', periodLabel: 'May 2026', dueDate: new Date('2026-06-20'), status: 'READY', assignedTo: 'Accounts Team' },
    { name: 'TDS Deposit', code: 'TDS', periodLabel: 'June 2026', dueDate: new Date('2026-07-07'), status: 'PENDING', assignedTo: 'Payroll Team' },
    { name: 'PF ECR Filing', code: 'PF_ECR', periodLabel: 'June 2026', dueDate: new Date('2026-07-15'), status: 'PENDING', assignedTo: 'Payroll Team' },
    { name: 'GSTR-1 Return', code: 'GSTR1', periodLabel: 'June 2026', dueDate: new Date('2026-07-11'), status: 'PENDING', assignedTo: 'Accounts Team' },
  ] as const;
  for (const obligation of obligations) {
    await prisma.complianceObligation.upsert({
      where: { companyId_code_periodLabel: { companyId: company.id, code: obligation.code, periodLabel: obligation.periodLabel } },
      update: {},
      create: { companyId: company.id, ...obligation },
    });
  }

  const makerRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'operator' } },
    update: { name: 'ERP Operator' },
    create: { tenantId: tenant.id, name: 'ERP Operator', code: 'operator', description: 'Creates transactions and submits them for approval.' },
  });
  const makerUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'operator@accounterp.local' } },
    update: { fullName: 'ERP Operator', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id, email: 'operator@accounterp.local', fullName: 'ERP Operator',
      passwordHash: await hash('Operator@12345', 12), status: 'ACTIVE',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: makerUser.id, roleId: makerRole.id } },
    update: {},
    create: { userId: makerUser.id, roleId: makerRole.id },
  });

  async function ensureApprovalPolicy(policy: {
    name: string; code: string; module: string; entityType: string; minAmount?: number; maxAmount?: number;
    description: string; steps: Array<{ name: string; approverRoleCode: string; minApprovals?: number; escalationHours?: number }>;
  }) {
    const existing = await prisma.approvalPolicy.findUnique({ where: { tenantId_code: { tenantId: tenant.id, code: policy.code } } });
    if (existing) return existing;
    return prisma.approvalPolicy.create({
      data: {
        tenantId: tenant.id, companyId: company.id, name: policy.name, code: policy.code,
        module: policy.module, entityType: policy.entityType, minAmount: policy.minAmount,
        maxAmount: policy.maxAmount, description: policy.description,
        steps: { create: policy.steps.map((step, index) => ({ sequence: index + 1, minApprovals: 1, ...step })) },
      },
    });
  }

  const voucherPolicy = await ensureApprovalPolicy({
    name: 'High Value Payment Approval', code: 'PAYMENT_HIGH_VALUE', module: 'accounting', entityType: 'voucher',
    minAmount: 25000, description: 'Maker-checker approval for payment vouchers above INR 25,000.',
    steps: [
      { name: 'Finance Manager Review', approverRoleCode: 'admin', escalationHours: 24 },
      { name: 'Final Authorization', approverRoleCode: 'admin', escalationHours: 12 },
    ],
  });
  const bankingPolicy = await ensureApprovalPolicy({
    name: 'Bank Payment Advice Approval', code: 'BANK_PAYMENT', module: 'banking', entityType: 'payment_advice',
    minAmount: 10000, description: 'Approval before releasing payment advice to the bank.',
    steps: [{ name: 'Treasury Authorization', approverRoleCode: 'admin', escalationHours: 8 }],
  });
  const addonPolicy = await ensureApprovalPolicy({
    name: 'Paid Add-on Installation', code: 'PAID_ADDON', module: 'marketplace', entityType: 'addon_installation',
    minAmount: 1, description: 'Approval for paid marketplace subscriptions.',
    steps: [{ name: 'Subscription Owner Approval', approverRoleCode: 'admin', escalationHours: 48 }],
  });

  const paymentRequest = await prisma.approvalRequest.upsert({
    where: { policyId_entityType_entityId: { policyId: voucherPolicy.id, entityType: 'voucher', entityId: supplierPayment.id } },
    update: {},
    create: {
      tenantId: tenant.id, companyId: company.id, policyId: voucherPolicy.id, entityType: 'voucher',
      entityId: supplierPayment.id, entityNumber: supplierPayment.voucherNo, title: 'Supplier payment authorization',
      module: 'accounting', amount: 45000, makerId: makerUser.id, currentStep: 1,
      dueAt: new Date(Date.now() + 24 * 3600000), notes: 'Payment against approved steel supplies.',
      metadata: { paymentMode: 'NEFT', beneficiary: 'Steel Supplier Co.' },
    },
  });

  const advice = await prisma.paymentAdvice.findUnique({ where: { companyId_adviceNo: { companyId: company.id, adviceNo: 'ADV-DEMO-001' } } });
  if (advice) {
    await prisma.approvalRequest.upsert({
      where: { policyId_entityType_entityId: { policyId: bankingPolicy.id, entityType: 'payment_advice', entityId: advice.id } },
      update: {},
      create: {
        tenantId: tenant.id, companyId: company.id, policyId: bankingPolicy.id, entityType: 'payment_advice',
        entityId: advice.id, entityNumber: advice.adviceNo, title: 'Release supplier NEFT advice',
        module: 'banking', amount: advice.amount, makerId: makerUser.id, currentStep: 1,
        dueAt: new Date(Date.now() - 2 * 3600000), notes: 'Urgent supplier settlement awaiting treasury review.',
      },
    });
  }

  const gstInstallation = await prisma.addonInstallation.findUnique({
    where: { tenantId_addonId: { tenantId: tenant.id, addonId: seededAddons.find((entry) => entry.slug === 'gst-autopilot')!.id } },
  });
  if (gstInstallation) {
    const approvedAddon = await prisma.approvalRequest.upsert({
      where: { policyId_entityType_entityId: { policyId: addonPolicy.id, entityType: 'addon_installation', entityId: gstInstallation.id } },
      update: {},
      create: {
        tenantId: tenant.id, companyId: company.id, policyId: addonPolicy.id, entityType: 'addon_installation',
        entityId: gstInstallation.id, entityNumber: 'GST-AUTOPILOT', title: 'Install GST Autopilot add-on',
        module: 'marketplace', amount: 1499, makerId: makerUser.id, currentStep: 1,
        status: 'APPROVED', completedAt: new Date('2026-06-13T11:00:00Z'), notes: 'Approved for compliance team.',
      },
    });
    const addonStep = await prisma.approvalPolicyStep.findFirstOrThrow({ where: { policyId: addonPolicy.id, sequence: 1 } });
    await prisma.approvalDecision.createMany({
      data: [{ requestId: approvedAddon.id, stepId: addonStep.id, approverId: adminUser.id, decision: 'APPROVED', comments: 'Compliance automation budget approved.', createdAt: new Date('2026-06-13T11:00:00Z') }],
      skipDuplicates: true,
    });
  }

  void paymentRequest;
  console.log(`Seeded tenant ${tenant.slug}, company, accounting, inventory, GST, manufacturing, payroll, banking, audit, marketplace, compliance, approvals, branch, warehouse, and voucher series`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
