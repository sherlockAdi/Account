import { Injectable } from '@nestjs/common';
import { ErpModuleDto } from './dto/erp-module.dto';

@Injectable()
export class ModulesService {
  private readonly modules: ErpModuleDto[] = [
    {
      key: 'saas',
      name: 'SaaS Admin',
      category: 'Platform',
      status: 'active',
      features: ['Tenants', 'Plans', 'Trials', 'Billing', 'Usage limits'],
    },
    {
      key: 'accounting',
      name: 'Accounting',
      category: 'Core',
      status: 'active',
      features: ['Chart of accounts', 'Ledgers', 'Vouchers', 'Trial balance', 'Opening balances'],
    },
    {
      key: 'inventory',
      name: 'Inventory',
      category: 'Core',
      status: 'planned',
      features: ['Items', 'Units', 'Godowns', 'Batch tracking', 'Stock valuation'],
    },
    {
      key: 'gst',
      name: 'GST & Tax',
      category: 'Compliance',
      status: 'planned',
      features: ['GST invoices', 'GSTR-1', 'GSTR-3B', 'HSN summary', 'ITC tracking'],
    },
    {
      key: 'manufacturing',
      name: 'Manufacturing',
      category: 'Industrial',
      status: 'planned',
      features: ['BOM', 'Production orders', 'Raw material consumption', 'Finished goods', 'Job work'],
    },
    {
      key: 'marketplace',
      name: 'Marketplace',
      category: 'Extensions',
      status: 'planned',
      features: ['Add-ons', 'Public API apps', 'Webhooks', 'External integrations'],
    },
  ];

  findAll(): ErpModuleDto[] {
    return this.modules;
  }
}
