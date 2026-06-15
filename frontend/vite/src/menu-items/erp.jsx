// assets
import {
  ApartmentOutlined,
  AppstoreAddOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  BuildOutlined,
  CalculatorOutlined,
  DollarOutlined,
  FileProtectOutlined,
  HddOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserSwitchOutlined
} from '@ant-design/icons';

const icons = {
  ApartmentOutlined,
  AppstoreAddOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  BuildOutlined,
  CalculatorOutlined,
  DollarOutlined,
  FileProtectOutlined,
  HddOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserSwitchOutlined
};

const erp = {
  id: 'erp',
  title: 'ERP Modules',
  type: 'group',
  children: [
    {
      id: 'saas',
      title: 'SaaS Admin',
      type: 'item',
      url: '/saas',
      icon: icons.ApartmentOutlined
    },
    {
      id: 'companies',
      title: 'Companies & Branches',
      type: 'item',
      url: '/companies',
      icon: icons.ShopOutlined
    },
    {
      id: 'users',
      title: 'Users & Roles',
      type: 'item',
      url: '/users',
      icon: icons.TeamOutlined
    },
    {
      id: 'accounting',
      title: 'Accounting',
      type: 'item',
      url: '/accounting',
      icon: icons.BookOutlined
    },
    {
      id: 'sales',
      title: 'Sales',
      type: 'item',
      url: '/sales',
      icon: icons.DollarOutlined
    },
    {
      id: 'purchase',
      title: 'Purchase',
      type: 'item',
      url: '/purchase',
      icon: icons.ShoppingCartOutlined
    },
    {
      id: 'inventory',
      title: 'Inventory',
      type: 'item',
      url: '/inventory',
      icon: icons.HddOutlined
    },
    {
      id: 'gst',
      title: 'GST & Tax',
      type: 'item',
      url: '/gst',
      icon: icons.FileProtectOutlined
    },
    {
      id: 'manufacturing',
      title: 'Manufacturing',
      type: 'item',
      url: '/manufacturing',
      icon: icons.BuildOutlined
    },
    {
      id: 'payroll',
      title: 'Payroll',
      type: 'item',
      url: '/payroll',
      icon: icons.UserSwitchOutlined
    },
    {
      id: 'banking',
      title: 'Banking',
      type: 'item',
      url: '/banking',
      icon: icons.BankOutlined
    },
    {
      id: 'reports',
      title: 'Reports & MIS',
      type: 'item',
      url: '/reports',
      icon: icons.PieChartOutlined
    },
    {
      id: 'audit',
      title: 'Audit & Security',
      type: 'item',
      url: '/audit',
      icon: icons.SafetyCertificateOutlined
    },
    {
      id: 'marketplace',
      title: 'Marketplace',
      type: 'item',
      url: '/marketplace',
      icon: icons.AppstoreAddOutlined
    },
    {
      id: 'tax-rules',
      title: 'Compliance Rules',
      type: 'item',
      url: '/compliance',
      icon: icons.CalculatorOutlined
    },
    {
      id: 'approvals',
      title: 'Approvals',
      type: 'item',
      url: '/approvals',
      icon: icons.AuditOutlined
    }
  ]
};

export default erp;
