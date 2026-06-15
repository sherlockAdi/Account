import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { CreateItemGroupDto } from './dto/create-item-group.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { UpdateItemGroupDto } from './dto/update-item-group.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { AssignItemTaxRateDto } from './dto/assign-item-tax-rate.dto';

const positiveMovement = new Set<StockMovementType>(['OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'PRODUCTION_IN']);

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async listUnits(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.unit.findMany({ where: { companyId: company.id, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async createUnit(companyId: string | undefined, dto: CreateUnitDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.unit.create({ data: { companyId: company.id, decimalPlaces: dto.decimalPlaces ?? 2, isActive: dto.isActive ?? true, name: dto.name, code: dto.code } });
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    await this.findUnit(id);
    return this.prisma.unit.update({ where: { id }, data: dto });
  }

  async listItemGroups(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.itemGroup.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { parent: true, items: { where: { deletedAt: null }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createItemGroup(companyId: string | undefined, dto: CreateItemGroupDto) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.itemGroup.create({ data: { companyId: company.id, ...dto, isActive: dto.isActive ?? true } });
  }

  async updateItemGroup(id: string, dto: UpdateItemGroupDto) {
    await this.findItemGroup(id);
    return this.prisma.itemGroup.update({ where: { id }, data: dto });
  }

  async listItems(companyId?: string) {
    const company = await this.resolveCompany(companyId);
    return this.prisma.item.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        group: true,
        unit: true,
        taxRates: { include: { taxRate: true }, orderBy: { effectiveFrom: 'desc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createItem(companyId: string | undefined, dto: CreateItemDto) {
    const company = await this.resolveCompany(companyId);
    await this.findUnit(dto.unitId);
    if (dto.groupId) await this.findItemGroup(dto.groupId);
    const { taxRateId, taxEffectiveFrom, taxEffectiveTo, ...itemData } = dto;
    if (taxRateId && !taxEffectiveFrom) {
      throw new BadRequestException('Tax effective from date is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
        companyId: company.id,
        ...itemData,
        type: dto.type ?? 'GOODS',
        standardRate: new Prisma.Decimal(dto.standardRate ?? 0),
        reorderLevel: new Prisma.Decimal(dto.reorderLevel ?? 0),
        trackBatch: dto.trackBatch ?? false,
        trackSerial: dto.trackSerial ?? false,
        isActive: dto.isActive ?? true,
        },
      });
      if (taxRateId && taxEffectiveFrom) {
        await this.createItemTaxRate(tx, item.id, company.id, {
          taxRateId,
          effectiveFrom: taxEffectiveFrom,
          effectiveTo: taxEffectiveTo,
        });
      }
      return tx.item.findUniqueOrThrow({
        where: { id: item.id },
        include: {
          group: true,
          unit: true,
          taxRates: { include: { taxRate: true }, orderBy: { effectiveFrom: 'desc' } },
        },
      });
    });
  }

  async updateItem(id: string, dto: UpdateItemDto) {
    const item = await this.findItem(id);
    const { taxRateId, taxEffectiveFrom, taxEffectiveTo, ...itemData } = dto;
    return this.prisma.item.update({
      where: { id },
      data: {
        ...itemData,
        standardRate: dto.standardRate === undefined ? undefined : new Prisma.Decimal(dto.standardRate),
        reorderLevel: dto.reorderLevel === undefined ? undefined : new Prisma.Decimal(dto.reorderLevel),
      },
      include: {
        group: true,
        unit: true,
        taxRates: { include: { taxRate: true }, orderBy: { effectiveFrom: 'desc' } },
      },
    });
  }

  async listItemTaxRates(itemId: string) {
    await this.findItem(itemId);
    return this.prisma.itemTaxRate.findMany({
      where: { itemId },
      include: { taxRate: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async assignItemTaxRate(itemId: string, dto: AssignItemTaxRateDto) {
    const item = await this.findItem(itemId);
    return this.prisma.$transaction((tx) => this.createItemTaxRate(tx, item.id, item.companyId, dto));
  }

  async createStockMovement(dto: CreateStockMovementDto) {
    const item = await this.findItem(dto.itemId);
    const warehouse = await this.findWarehouse(dto.warehouseId);
    const rate = new Prisma.Decimal(dto.rate ?? 0);
    const quantity = new Prisma.Decimal(dto.quantity);
    return this.prisma.stockMovement.create({
      data: {
        itemId: item.id,
        warehouseId: warehouse.id,
        type: dto.type,
        quantity,
        rate,
        amount: quantity.mul(rate),
        movementDate: new Date(dto.movementDate),
        referenceType: dto.referenceType,
        referenceNo: dto.referenceNo,
        narration: dto.narration,
      },
      include: { item: { include: { unit: true } }, warehouse: true },
    });
  }

  async stockSummary(query: InventoryQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    const items = await this.prisma.item.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: { unit: true, group: true },
      orderBy: { name: 'asc' },
    });
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        item: { companyId: company.id },
        warehouseId: query.warehouseId,
      },
      include: { warehouse: true },
    });

    return items.map((item) => {
      const itemMovements = movements.filter((movement) => movement.itemId === item.id);
      const quantity = itemMovements.reduce((sum, movement) => {
        const sign = positiveMovement.has(movement.type) ? 1 : -1;
        return sum + Number(movement.quantity) * sign;
      }, 0);
      const value = itemMovements.reduce((sum, movement) => {
        const sign = positiveMovement.has(movement.type) ? 1 : -1;
        return sum + Number(movement.amount) * sign;
      }, 0);
      return {
        itemId: item.id,
        itemName: item.name,
        itemCode: item.code,
        groupName: item.group?.name,
        unit: item.unit.code,
        quantity: Number(quantity.toFixed(3)),
        value: Number(value.toFixed(2)),
        reorderLevel: Number(item.reorderLevel),
        belowReorder: quantity <= Number(item.reorderLevel),
      };
    });
  }

  async listMovements(query: InventoryQueryDto) {
    const company = await this.resolveCompany(query.companyId);
    return this.prisma.stockMovement.findMany({
      where: { item: { companyId: company.id }, warehouseId: query.warehouseId },
      include: { item: { include: { unit: true } }, warehouse: true },
      orderBy: { movementDate: 'desc' },
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
    if (!company) throw new BadRequestException('Create a company before using inventory');
    return company;
  }

  private async findUnit(id: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id, deletedAt: null } });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  private async findItemGroup(id: string) {
    const group = await this.prisma.itemGroup.findFirst({ where: { id, deletedAt: null } });
    if (!group) throw new NotFoundException('Item group not found');
    return group;
  }

  private async findItem(id: string) {
    const item = await this.prisma.item.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  private async findWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, deletedAt: null } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  private async createItemTaxRate(
    tx: Prisma.TransactionClient,
    itemId: string,
    companyId: string,
    dto: AssignItemTaxRateDto,
  ) {
    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException('Tax effective to date must be on or after effective from date');
    }
    const taxRate = await tx.taxRate.findFirst({
      where: { id: dto.taxRateId, companyId, deletedAt: null, isActive: true },
    });
    if (!taxRate) throw new NotFoundException('Tax rate not found');

    const overlap = await tx.itemTaxRate.findFirst({
      where: {
        itemId,
        effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31') },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
      },
    });
    if (overlap) throw new BadRequestException('Tax effective period overlaps an existing item tax period');

    return tx.itemTaxRate.create({
      data: { itemId, taxRateId: taxRate.id, effectiveFrom, effectiveTo },
      include: { taxRate: true },
    });
  }
}
