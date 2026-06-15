import { BadRequestException } from '@nestjs/common';
import { ItemTaxResolverService } from './item-tax-resolver.service';

describe('ItemTaxResolverService', () => {
  const findMany = jest.fn();
  const service = new ItemTaxResolverService({
    itemTaxRate: { findMany },
  } as never);

  beforeEach(() => findMany.mockReset());

  it('returns the effective tax assignment by item', async () => {
    findMany.mockResolvedValue([
      { itemId: 'item-1', taxRate: { rate: '18' } },
      { itemId: 'item-2', taxRate: { rate: '5' } },
    ]);

    const result = await service.resolve(['item-1', 'item-2'], '2026-06-13');

    expect(result.get('item-1')?.taxRate.rate).toBe('18');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          effectiveFrom: { lte: new Date('2026-06-13') },
        }),
      }),
    );
  });

  it('rejects posting when any item has no tax for the document date', async () => {
    findMany.mockResolvedValue([{ itemId: 'item-1', taxRate: { rate: '18' } }]);

    await expect(service.resolve(['item-1', 'item-2'], '2026-06-13')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
