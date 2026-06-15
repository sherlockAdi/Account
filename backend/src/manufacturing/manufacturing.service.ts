import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebitCredit, Prisma, ProductionOrderStatus, StockMovementType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CompleteProductionDto } from './dto/complete-production.dto';
import { CreateBomDto } from './dto/create-bom.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';

const positiveMovement = new Set<StockMovementType>([
  'OPENING',
  'PURCHASE',
  'SALES_RETURN',
  'ADJUSTMENT_IN',
  'TRANSFER_IN',
  'PRODUCTION_IN',
]);

@Injectable()
export class ManufacturingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listBoms(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.billOfMaterial.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        finishedItem: { include: { unit: true } },
        components: { include: { item: { include: { unit: true } } }, orderBy: { item: { name: 'asc' } } },
      },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });
  }

  async createBom(companyId: string | undefined, dto: CreateBomDto) {
    const company = await this.resolveCompany(companyId);
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('BOM effective to date must be on or after effective from date');
    }
    const itemIds = [dto.finishedItemId, ...dto.components.map((component) => component.itemId)];
    if (new Set(dto.components.map((component) => component.itemId)).size !== dto.components.length) {
      throw new BadRequestException('A component item can appear only once in a BOM');
    }
    if (dto.components.some((component) => component.itemId === dto.finishedItemId)) {
      throw new BadRequestException('Finished item cannot also be a BOM component');
    }
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, companyId: company.id, deletedAt: null, isActive: true },
    });
    if (items.length !== new Set(itemIds).size) {
      throw new BadRequestException('One or more BOM items are invalid');
    }

    return this.prisma.billOfMaterial.create({
      data: {
        companyId: company.id,
        finishedItemId: dto.finishedItemId,
        name: dto.name,
        code: dto.code,
        version: dto.version ?? 1,
        outputQuantity: new Prisma.Decimal(dto.outputQuantity ?? 1),
        effectiveFrom,
        effectiveTo,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
        components: {
          create: dto.components.map((component) => ({
            itemId: component.itemId,
            quantity: new Prisma.Decimal(component.quantity),
            wastagePercent: new Prisma.Decimal(component.wastagePercent ?? 0),
            notes: component.notes,
          })),
        },
      },
      include: {
        finishedItem: { include: { unit: true } },
        components: { include: { item: { include: { unit: true } } } },
      },
    });
  }

  async listOrders(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.productionOrder.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        warehouse: { include: { branch: true } },
        bom: {
          include: {
            finishedItem: { include: { unit: true } },
            components: { include: { item: { include: { unit: true } } } },
          },
        },
        entries: {
          include: {
            outputItem: { include: { unit: true } },
            consumptions: { include: { item: { include: { unit: true } } } },
          },
          orderBy: { productionDate: 'desc' },
        },
      },
      orderBy: [{ orderDate: 'desc' }, { orderNo: 'desc' }],
    });
  }

  async createOrder(companyId: string | undefined, dto: CreateProductionOrderDto) {
    const company = await this.resolveCompany(companyId);
    const orderDate = new Date(dto.orderDate);
    const bom = await this.prisma.billOfMaterial.findFirst({
      where: {
        id: dto.bomId,
        companyId: company.id,
        deletedAt: null,
        isActive: true,
        effectiveFrom: { lte: orderDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: orderDate } }],
      },
    });
    if (!bom) throw new BadRequestException('No active BOM is effective on the production order date');
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, deletedAt: null, branch: { companyId: company.id, deletedAt: null } },
      include: { branch: true },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (dto.branchId && dto.branchId !== warehouse.branchId) {
      throw new BadRequestException('Selected branch does not own the warehouse');
    }

    return this.prisma.productionOrder.create({
      data: {
        companyId: company.id,
        bomId: bom.id,
        warehouseId: warehouse.id,
        branchId: dto.branchId ?? warehouse.branchId,
        orderNo: dto.orderNo,
        orderDate,
        plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : null,
        plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
        plannedQuantity: new Prisma.Decimal(dto.plannedQuantity),
        notes: dto.notes,
      },
      include: {
        warehouse: { include: { branch: true } },
        bom: { include: { finishedItem: { include: { unit: true } }, components: { include: { item: { include: { unit: true } } } } } },
      },
    });
  }

  async materialRequirements(orderId: string) {
    const order = await this.findOrder(orderId);
    const remainingQuantity = Math.max(0, Number(order.plannedQuantity) - Number(order.completedQuantity));
    const requirements = this.calculateRequirements(order.bom, remainingQuantity);
    const balances = await this.stockBalances(
      requirements.map((requirement) => requirement.itemId),
      order.warehouseId,
    );
    return {
      orderId: order.id,
      orderNo: order.orderNo,
      remainingQuantity,
      outputUnit: order.bom.finishedItem.unit.code,
      requirements: requirements.map((requirement) => ({
        ...requirement,
        availableQuantity: balances.get(requirement.itemId) ?? 0,
        shortageQuantity: Math.max(0, requirement.quantity - (balances.get(requirement.itemId) ?? 0)),
      })),
    };
  }

  async completeProduction(orderId: string, dto: CompleteProductionDto) {
    const order = await this.findOrder(orderId);
    if (order.status === ProductionOrderStatus.CANCELLED || order.status === ProductionOrderStatus.COMPLETED) {
      throw new BadRequestException(`Cannot post production against a ${order.status.toLowerCase()} order`);
    }
    const remainingQuantity = Number(order.plannedQuantity) - Number(order.completedQuantity);
    if (dto.quantity > remainingQuantity + 0.0001) {
      throw new BadRequestException(`Production quantity exceeds remaining order quantity ${remainingQuantity.toFixed(3)}`);
    }

    const requirements = this.calculateRequirements(order.bom, dto.quantity);
    const balances = await this.stockBalances(
      requirements.map((requirement) => requirement.itemId),
      order.warehouseId,
    );
    const shortages = requirements.filter(
      (requirement) => (balances.get(requirement.itemId) ?? 0) + 0.0001 < requirement.quantity,
    );
    if (shortages.length) {
      throw new BadRequestException(
        `Insufficient stock: ${shortages
          .map((shortage) => `${shortage.itemName} needs ${shortage.quantity.toFixed(3)}, available ${(balances.get(shortage.itemId) ?? 0).toFixed(3)}`)
          .join('; ')}`,
      );
    }

    const materialCost = requirements.reduce((sum, requirement) => sum + requirement.amount, 0);
    const unitCost = materialCost / dto.quantity;
    const completedQuantity = Number(order.completedQuantity) + dto.quantity;
    const status =
      completedQuantity + 0.0001 >= Number(order.plannedQuantity)
        ? ProductionOrderStatus.COMPLETED
        : ProductionOrderStatus.IN_PROGRESS;
    const productionDate = new Date(dto.productionDate);

    return this.prisma.$transaction(async (tx) => {
      const ledgers = await this.ensureProductionLedgers(tx, order.companyId);
      const voucherNo = `${order.orderNo}-${dto.entryNo}`;
      const voucher = await tx.voucher.create({
        data: {
          companyId: order.companyId,
          branchId: order.branchId,
          voucherType: 'production',
          voucherNo,
          voucherDate: productionDate,
          narration: dto.notes || `Production ${dto.entryNo} for ${order.orderNo}`,
          lines: {
            create: [
              {
                ledgerId: ledgers.finishedGoods.id,
                type: DebitCredit.DEBIT,
                amount: new Prisma.Decimal(materialCost),
                narration: `Finished goods ${order.bom.finishedItem.name}`,
              },
              {
                ledgerId: ledgers.rawMaterials.id,
                type: DebitCredit.CREDIT,
                amount: new Prisma.Decimal(materialCost),
                narration: `Raw material consumption for ${order.orderNo}`,
              },
            ],
          },
        },
      });

      const entry = await tx.productionEntry.create({
        data: {
          productionOrderId: order.id,
          outputItemId: order.bom.finishedItemId,
          entryNo: dto.entryNo,
          productionDate,
          quantity: new Prisma.Decimal(dto.quantity),
          materialCost: new Prisma.Decimal(materialCost),
          unitCost: new Prisma.Decimal(unitCost),
          accountingVoucherId: voucher.id,
          notes: dto.notes,
          consumptions: {
            create: requirements.map((requirement) => ({
              itemId: requirement.itemId,
              quantity: new Prisma.Decimal(requirement.quantity),
              rate: new Prisma.Decimal(requirement.rate),
              amount: new Prisma.Decimal(requirement.amount),
            })),
          },
        },
      });

      await tx.stockMovement.createMany({
        data: [
          ...requirements.map((requirement) => ({
            itemId: requirement.itemId,
            warehouseId: order.warehouseId,
            type: StockMovementType.CONSUMPTION,
            quantity: new Prisma.Decimal(requirement.quantity),
            rate: new Prisma.Decimal(requirement.rate),
            amount: new Prisma.Decimal(requirement.amount),
            movementDate: productionDate,
            referenceType: 'production_entry',
            referenceNo: voucherNo,
            narration: dto.notes,
          })),
          {
            itemId: order.bom.finishedItemId,
            warehouseId: order.warehouseId,
            type: StockMovementType.PRODUCTION_IN,
            quantity: new Prisma.Decimal(dto.quantity),
            rate: new Prisma.Decimal(unitCost),
            amount: new Prisma.Decimal(materialCost),
            movementDate: productionDate,
            referenceType: 'production_entry',
            referenceNo: voucherNo,
            narration: dto.notes,
          },
        ],
      });

      await tx.productionOrder.update({
        where: { id: order.id },
        data: { completedQuantity: new Prisma.Decimal(completedQuantity), status },
      });

      return tx.productionEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: {
          outputItem: { include: { unit: true } },
          consumptions: { include: { item: { include: { unit: true } } } },
          productionOrder: { include: { bom: true, warehouse: true } },
        },
      });
    });
  }

  async dashboard(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    const [orders, entries, boms] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where: { companyId: company.id, deletedAt: null },
        include: { bom: { include: { finishedItem: true } } },
      }),
      this.prisma.productionEntry.findMany({
        where: { productionOrder: { companyId: company.id, deletedAt: null } },
        orderBy: { productionDate: 'desc' },
        take: 10,
        include: { outputItem: { include: { unit: true } }, productionOrder: true },
      }),
      this.prisma.billOfMaterial.count({ where: { companyId: company.id, deletedAt: null, isActive: true } }),
    ]);
    const totalPlanned = orders.reduce((sum, order) => sum + Number(order.plannedQuantity), 0);
    const totalCompleted = orders.reduce((sum, order) => sum + Number(order.completedQuantity), 0);
    return {
      activeBoms: boms,
      openOrders: orders.filter((order) => ['PLANNED', 'IN_PROGRESS'].includes(order.status)).length,
      completedOrders: orders.filter((order) => order.status === 'COMPLETED').length,
      totalPlanned: Number(totalPlanned.toFixed(3)),
      totalCompleted: Number(totalCompleted.toFixed(3)),
      completionPercent: totalPlanned ? Number(((totalCompleted / totalPlanned) * 100).toFixed(1)) : 0,
      recentEntries: entries,
    };
  }

  private calculateRequirements(
    bom: {
      outputQuantity: Prisma.Decimal;
      components: Array<{
        itemId: string;
        quantity: Prisma.Decimal;
        wastagePercent: Prisma.Decimal;
        item: { name: string; standardRate: Prisma.Decimal; unit: { code: string } };
      }>;
    },
    outputQuantity: number,
  ) {
    const factor = outputQuantity / Number(bom.outputQuantity);
    return bom.components.map((component) => {
      const quantity = Number(component.quantity) * factor * (1 + Number(component.wastagePercent) / 100);
      const rate = Number(component.item.standardRate);
      return {
        itemId: component.itemId,
        itemName: component.item.name,
        unit: component.item.unit.code,
        quantity: Number(quantity.toFixed(3)),
        rate: Number(rate.toFixed(2)),
        amount: Number((quantity * rate).toFixed(2)),
        wastagePercent: Number(component.wastagePercent),
      };
    });
  }

  private async stockBalances(itemIds: string[], warehouseId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: { itemId: { in: itemIds }, warehouseId },
    });
    const balances = new Map<string, number>();
    for (const movement of movements) {
      const sign = positiveMovement.has(movement.type) ? 1 : -1;
      balances.set(
        movement.itemId,
        (balances.get(movement.itemId) ?? 0) + Number(movement.quantity) * sign,
      );
    }
    return balances;
  }

  private async ensureProductionLedgers(tx: Prisma.TransactionClient, companyId: string) {
    const group = await tx.accountGroup.findFirst({
      where: { companyId, code: 'CURRENT_ASSETS', deletedAt: null },
    });
    if (!group) throw new BadRequestException('Current Assets group not found');
    const [rawMaterials, finishedGoods] = await Promise.all([
      tx.ledger.upsert({
        where: { companyId_code: { companyId, code: 'RAW_MATERIAL_INVENTORY' } },
        update: {},
        create: {
          companyId,
          groupId: group.id,
          name: 'Raw Material Inventory',
          code: 'RAW_MATERIAL_INVENTORY',
          ledgerType: 'GENERAL',
          openingType: DebitCredit.DEBIT,
        },
      }),
      tx.ledger.upsert({
        where: { companyId_code: { companyId, code: 'FINISHED_GOODS_INVENTORY' } },
        update: {},
        create: {
          companyId,
          groupId: group.id,
          name: 'Finished Goods Inventory',
          code: 'FINISHED_GOODS_INVENTORY',
          ledgerType: 'GENERAL',
          openingType: DebitCredit.DEBIT,
        },
      }),
    ]);
    return { rawMaterials, finishedGoods };
  }

  private async findOrder(id: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        warehouse: true,
        bom: {
          include: {
            finishedItem: { include: { unit: true } },
            components: { include: { item: { include: { unit: true } } } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Production order not found');
    return order;
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
    if (!company) throw new BadRequestException('Create a company before using manufacturing');
    return company;
  }
}
