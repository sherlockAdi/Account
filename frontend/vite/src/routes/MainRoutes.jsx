import { lazy } from 'react';

// project imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';
import ProtectedRoute from './ProtectedRoute';

// render- Dashboard
const DashboardDefault = Loadable(lazy(() => import('pages/dashboard/default')));
const ModulePlaceholder = Loadable(lazy(() => import('pages/modules/ModulePlaceholder')));
const IdentityPage = Loadable(lazy(() => import('pages/identity/IdentityPage')));
const CompaniesPage = Loadable(lazy(() => import('pages/companies/CompaniesPage')));
const AccountingPage = Loadable(lazy(() => import('pages/accounting/AccountingPage')));
const CostCenterPage = Loadable(lazy(() => import('pages/cost-center/CostCenterPage')));
const InventoryPage = Loadable(lazy(() => import('pages/inventory/InventoryPage')));
const PurchasePage = Loadable(lazy(() => import('pages/purchase/PurchasePage')));
const SalesPage = Loadable(lazy(() => import('pages/sales/SalesPage')));
const GstPage = Loadable(lazy(() => import('pages/gst/GstPage')));
const ManufacturingPage = Loadable(lazy(() => import('pages/manufacturing/ManufacturingPage')));
const PayrollPage = Loadable(lazy(() => import('pages/payroll/PayrollPage')));
const BankingPage = Loadable(lazy(() => import('pages/banking/BankingPage')));
const ReportsPage = Loadable(lazy(() => import('pages/reports/ReportsPage')));
const SmartReportsPage = Loadable(lazy(() => import('pages/smart-reports/SmartReportsPage')));
const SystemSettingPage = Loadable(lazy(() => import('pages/system-setting/SystemSettingPage')));
const BudgetPage = Loadable(lazy(() => import('pages/budget/BudgetPage')));
const GrandPage = Loadable(lazy(() => import('pages/grand/GrandPage')));
const UtilizationPage = Loadable(lazy(() => import('pages/utilization/UtilizationPage')));
const AuditPage = Loadable(lazy(() => import('pages/audit/AuditPage')));
const MarketplacePage = Loadable(lazy(() => import('pages/marketplace/MarketplacePage')));
const CompliancePage = Loadable(lazy(() => import('pages/compliance/CompliancePage')));
const ApprovalsPage = Loadable(lazy(() => import('pages/approvals/ApprovalsPage')));

// render - color
const Color = Loadable(lazy(() => import('pages/component-overview/color')));
const Typography = Loadable(lazy(() => import('pages/component-overview/typography')));
const Shadow = Loadable(lazy(() => import('pages/component-overview/shadows')));

// render - sample page
const SamplePage = Loadable(lazy(() => import('pages/extra-pages/sample-page')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  element: (
    <ProtectedRoute>
      <DashboardLayout />
    </ProtectedRoute>
  ),
  children: [
    {
      path: '/',
      element: <DashboardDefault />
    },
    {
      path: 'dashboard',
      children: [
        {
          path: 'default',
          element: <DashboardDefault />
        }
      ]
    },
    {
      path: 'saas',
      element: (
        <ModulePlaceholder
          title="SaaS Admin"
          description="Manage tenants, plans, subscriptions, trials, billing status, and platform-wide controls."
          features={['Tenant onboarding', 'Subscription plans', 'Usage limits', 'Super admin controls']}
        />
      )
    },
    {
      path: 'companies',
      element: <CompaniesPage />
    },
    {
      path: 'users',
      element: <IdentityPage />
    },
    {
      path: 'accounting',
      element: <AccountingPage />
    },
    {
      path: 'cost-center',
      element: <CostCenterPage />
    },
    {
      path: 'sales',
      element: <SalesPage />
    },
    {
      path: 'purchase',
      element: <PurchasePage />
    },
    {
      path: 'inventory',
      element: <InventoryPage />
    },
    {
      path: 'gst',
      element: <GstPage />
    },
    {
      path: 'manufacturing',
      element: <ManufacturingPage />
    },
    {
      path: 'payroll',
      element: <PayrollPage />
    },
    {
      path: 'banking',
      element: <BankingPage />
    },
    {
      path: 'reports',
      element: <ReportsPage />
    },
    {
      path: 'smart-reports',
      element: <SmartReportsPage />
    },
    {
      path: 'system-setting',
      element: <SystemSettingPage />
    },
    {
      path: 'budget',
      element: <BudgetPage />
    },
    {
      path: 'grand',
      element: <GrandPage />
    },
    {
      path: 'utilization',
      element: <UtilizationPage />
    },
    {
      path: 'audit',
      element: <AuditPage />
    },
    {
      path: 'marketplace',
      element: <MarketplacePage />
    },
    {
      path: 'compliance',
      element: <CompliancePage />
    },
    {
      path: 'approvals',
      element: <ApprovalsPage />
    },
    {
      path: 'typography',
      element: <Typography />
    },
    {
      path: 'color',
      element: <Color />
    },
    {
      path: 'shadow',
      element: <Shadow />
    },
    {
      path: 'sample-page',
      element: <SamplePage />
    }
  ]
};

export default MainRoutes;
