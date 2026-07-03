import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import ArrowDownOutlined from '@ant-design/icons/ArrowDownOutlined';
import ArrowUpOutlined from '@ant-design/icons/ArrowUpOutlined';
import BankOutlined from '@ant-design/icons/BankOutlined';
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined';
import PieChartOutlined from '@ant-design/icons/PieChartOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ShoppingCartOutlined from '@ant-design/icons/ShoppingCartOutlined';
import WalletOutlined from '@ant-design/icons/WalletOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

async function api(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

export default function DashboardDefault() {
  const [filters, setFilters] = useState({ from: '2026-04-01', to: todayIso() });
  const [reports, setReports] = useState({});
  const [budget, setBudget] = useState({});
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => `from=${filters.from}&to=${filters.to}`, [filters]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError('');
      const [reportData, budgetData, budgetRows] = await Promise.all([
        api(`/reports/dashboard?${query}`),
        api('/budget/dashboard'),
        api('/budget/budgets')
      ]);
      setReports(reportData);
      setBudget(budgetData);
      setBudgets(budgetRows);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const netProfit = Number(reports.netProfit || 0);
  const utilizationPercent = Number(budget.utilizationPercent || 0);
  const profitTone = netProfit >= 0 ? 'success' : 'danger';
  const budgetTone = utilizationPercent >= 90 ? 'danger' : utilizationPercent >= 70 ? 'warning' : 'info';
  const periodLabel = `${formatDate(filters.from)} to ${formatDate(filters.to)}`;

  const kpis = [
    { label: 'Net Sales', value: money(reports.sales?.total), helper: 'Revenue booked', tone: 'primary', icon: <ShoppingCartOutlined /> },
    { label: 'Net Profit', value: money(netProfit), helper: netProfit >= 0 ? 'Positive margin' : 'Loss position', tone: profitTone, icon: netProfit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined /> },
    { label: 'Receivables', value: money(reports.receivables), helper: 'Customer outstanding', tone: 'warning', icon: <WalletOutlined /> },
    { label: 'Payables', value: money(reports.payables), helper: 'Vendor outstanding', tone: 'danger', icon: <BankOutlined /> },
    { label: 'Budget Remaining', value: money(budget.remainingAmount), helper: 'Available allocation', tone: 'info', icon: <PieChartOutlined /> },
    { label: 'Budget Utilization', value: `${utilizationPercent.toFixed(2)}%`, helper: 'Spend progress', tone: budgetTone, icon: <DatabaseOutlined /> }
  ];

  const cashRows = [
    { label: 'Bank Balance', value: money(reports.bankBalance), tone: 'primary' },
    { label: 'Cash Balance', value: money(reports.cashBalance), tone: 'success' },
    { label: 'Stock Value', value: money(reports.stockValue), tone: 'info' },
    { label: 'Net Purchases', value: money(reports.purchases?.total), tone: 'warning' }
  ];

  const healthCards = [
    { label: 'Cash + Bank', value: money(Number(reports.bankBalance || 0) + Number(reports.cashBalance || 0)), caption: 'Liquid balance', tone: 'primary' },
    { label: 'Sales vs Purchases', value: money(Number(reports.sales?.total || 0) - Number(reports.purchases?.total || 0)), caption: 'Trading spread', tone: Number(reports.sales?.total || 0) >= Number(reports.purchases?.total || 0) ? 'success' : 'warning' },
    { label: 'Budget Used', value: money(budget.actualAmount), caption: `${utilizationPercent.toFixed(2)}% consumed`, tone: budgetTone }
  ];

  return (
    <Grid container spacing={2.75}>
      {error && <Grid size={12}><Alert severity="error" onClose={() => setError('')}>{error}</Alert></Grid>}
      <Grid size={12}>
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: { xs: 2.5, md: 3 },
              borderBottom: 1,
              borderColor: 'divider',
              background: 'linear-gradient(135deg, rgba(22,119,255,0.10), rgba(82,196,26,0.08) 48%, rgba(250,173,20,0.10))'
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>ERP Command Center</Typography>
                <Typography variant="h2" sx={{ mt: 0.25, lineHeight: 1.15 }}>Dashboard</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.75 }}>Finance, budgets, cash, inventory, receivables, and payables for {periodLabel}.</Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, rowGap: 1 }}>
                <DateField size="small" label="From" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                <DateField size="small" label="To" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
                <Button variant="contained" startIcon={<ReloadOutlined />} disabled={loading} onClick={loadDashboard}>{loading ? 'Loading...' : 'Apply'}</Button>
              </Stack>
            </Stack>
          </Box>
          <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
              {healthCards.map((card) => <HealthTile key={card.label} {...card} />)}
            </Box>
          </Box>
        </Box>
      </Grid>

      <Grid size={12}><KpiGrid cards={kpis} /></Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h5">Finance Snapshot</Typography>
                <Typography variant="caption" color="text.secondary">Liquidity, stock and purchase movement</Typography>
              </Box>
              <WalletOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            </Stack>
            <Stack spacing={1.25}>{cashRows.map((row) => <SummaryRow key={row.label} {...row} />)}</Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h5">Budget Utilization</Typography>
                <Typography variant="caption" color="text.secondary">Allocation, actuals and remaining amount</Typography>
              </Box>
              <PieChartOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            </Stack>
            <Stack spacing={1.5}>
              <SummaryRow label="Allocated" value={money(budget.allocatedAmount)} tone="primary" />
              <SummaryRow label="Actual" value={money(budget.actualAmount)} tone="warning" />
              <SummaryRow label="Remaining" value={money(budget.remainingAmount)} tone="success" />
              <Box>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography color="text.secondary">Utilization</Typography>
                  <Typography>{Number(budget.utilizationPercent || 0).toFixed(2)}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(100, utilizationPercent)} color={budgetTone === 'danger' ? 'error' : budgetTone === 'warning' ? 'warning' : 'success'} sx={{ height: 10, borderRadius: 1 }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}><BudgetTable budgets={budgets} /></Grid>
    </Grid>
  );
}

function KpiGrid({ cards }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' }, gap: 2 }}>
      {cards.map((card) => (
        <Card key={card.label} variant="outlined" sx={{ minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          <CardContent sx={{ minWidth: 0, p: 2.25, '&:last-child': { pb: 2.25 } }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography color="text.secondary" sx={{ mb: 0.5 }}>{card.label}</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, lg: 22 }, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{card.value}</Typography>
              </Box>
              <ToneIcon tone={card.tone}>{card.icon}</ToneIcon>
            </Stack>
            <Typography variant="caption" color="text.secondary">{card.helper}</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function ToneIcon({ tone = 'primary', children }) {
  const palette = {
    primary: ['#1677ff', 'rgba(22,119,255,0.12)'],
    success: ['#2e7d32', 'rgba(46,125,50,0.12)'],
    warning: ['#b26a00', 'rgba(250,173,20,0.16)'],
    danger: ['#c62828', 'rgba(198,40,40,0.12)'],
    info: ['#006c9c', 'rgba(0,108,156,0.12)']
  };
  const [color, bg] = palette[tone] || palette.primary;
  return <Box sx={{ width: 38, height: 38, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 1, color, bgcolor: bg, fontSize: 20 }}>{children}</Box>;
}

function HealthTile({ label, value, caption, tone }) {
  return (
    <Box sx={{ minWidth: 0, p: 1.75, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <ToneIcon tone={tone}><ArrowUpOutlined /></ToneIcon>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 20, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{caption}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function SummaryRow({ label, value, tone = 'primary' }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone === 'success' ? 'success.main' : tone === 'warning' ? 'warning.main' : tone === 'info' ? 'info.main' : 'primary.main', flex: '0 0 auto' }} />
        <Typography color="text.secondary">{label}</Typography>
      </Stack>
      <Typography fontWeight={700} sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</Typography>
    </Stack>
  );
}

function BudgetTable({ budgets }) {
  const rows = budgets.map((budgetRow) => ({
    ...budgetRow,
    budgetName: `${budgetRow.name} ${budgetRow.code} / ${budgetRow.fiscalYear}`,
    fromDate: budgetRow.periodFrom,
    period: `${formatDate(budgetRow.periodFrom)} to ${formatDate(budgetRow.periodTo)}`,
    allocated: Number(budgetRow.totalAmount || 0),
    actual: Number(budgetRow.actualAmount || 0),
    remaining: Number(budgetRow.remainingAmount || 0),
    utilization: Number(budgetRow.utilizationPercent || 0)
  }));
  const columns = [
    { field: 'budgetName', headerName: 'Budget', flex: 1.2, minWidth: 240 },
    { field: 'period', headerName: 'Period', flex: 0.9, minWidth: 190 },
    { field: 'status', headerName: 'Status', flex: 0.7, minWidth: 130 },
    { field: 'allocated', headerName: 'Allocated', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => money(value) },
    { field: 'actual', headerName: 'Actual', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => money(value) },
    { field: 'remaining', headerName: 'Remaining', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => money(value) },
    { field: 'utilization', headerName: 'Utilization %', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => `${Number(value || 0).toFixed(2)}%` }
  ];
  return (
    <CommonDataGrid
      title="Dashboard Budgets"
      rows={rows}
      columns={columns}
      fileName="dashboard-budgets"
      searchPlaceholder="Search budgets"
      dateField="fromDate"
      selectFilters={[{ field: 'status', label: 'Status', options: Array.from(new Set(rows.map((row) => row.status))).map((status) => ({ value: status, label: status })) }]}
    />
  );
}
