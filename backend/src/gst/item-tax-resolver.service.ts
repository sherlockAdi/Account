import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ItemTaxResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(itemIds: string[], documentDate: string) {
    const date = new Date(documentDate);
    const assignments = await this.prisma.itemTaxRate.findMany({
      where: {
        itemId: { in: [...new Set(itemIds)] },
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        taxRate: { isActive: true, deletedAt: null },
      },
      include: { taxRate: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const byItem = new Map(assignments.map((assignment) => [assignment.itemId, assignment]));
    const missing = [...new Set(itemIds)].filter((itemId) => !byItem.has(itemId));
    if (missing.length) {
      throw new BadRequestException(`No effective tax rate configured for ${missing.length} item(s) on ${documentDate}`);
    }
    return byItem;
  }
}
