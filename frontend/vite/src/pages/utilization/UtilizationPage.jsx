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

import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import { formatDate } from 'utils/dateFormat';

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

export default function UtilizationPage() {
  const [dashboard, setDashboard] = useState({});
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, budgetRows] = await Promise.all([
        api('/budget/dashboard'),
        api('/budget/budgets')
      ]);
      setDashboard(dashboardData);
      setBudgets(budgetRows);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const lines = useMemo(() => budgets.flatMap((budget) => budget.lines.map((line) => ({ ...line, budget }))), [budgets]);
  const highUsage = lines.filter((line) => Number(line.utilizationPercent || 0) >= 80).sort((a, b) => Number(b.utilizationPercent || 0) - Number(a.utilizationPercent || 0));
  const lowUsage = lines.filter((line) => Number(line.utilizationPercent || 0) < 25).sort((a, b) => Number(a.utilizationPercent || 0) - Number(b.utilizationPercent || 0));
  const cards = [
    ['Allocated', money(dashboard.allocatedAmount)],
    ['Actual', money(dashboard.actualAmount)],
    ['Remaining', money(dashboard.remainingAmount)],
    ['Utilization', `${Number(dashboard.utilizationPercent || 0).toFixed(2)}%`],
    ['High Usage Lines', highUsage.length],
    ['Low Usage Lines', lowUsage.length]
  ];

  return (
    <Grid container spacing={2.75}>
      {error && <Grid size={12}><Alert severity="error" onClose={() => setError('')}>{error}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="h3">Utilization</Typography><Typography color="text.secondary">Monitor budget consumption, remaining limits, and high-usage ledger lines.</Typography></Box>
          <Button variant="contained" startIcon={<ReloadOutlined />} disabled={loading} onClick={loadData}>{loading ? 'Loading...' : 'Refresh'}</Button>
        </Stack>
      </Grid>

      <Grid size={12}><UtilizationCards cards={cards} /></Grid>

      <Grid size={{ xs: 12, lg: 6 }}><LinePanel title="High Usage" lines={highUsage} emptyText="No lines above 80% utilization." /></Grid>
      <Grid size={{ xs: 12, lg: 6 }}><LinePanel title="Low Usage" lines={lowUsage} emptyText="No lines below 25% utilization." /></Grid>
      <Grid size={12}><BudgetUtilizationTable budgets={budgets} /></Grid>
    </Grid>
  );
}

function UtilizationCards({ cards }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' }, gap: 2 }}>
      {cards.map(([label, value]) => (
        <Card key={label} variant="outlined" sx={{ minWidth: 0 }}>
          <CardContent sx={{ minWidth: 0, p: 2.25, '&:last-child': { pb: 2.25 } }}>
            <Typography color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 20, lg: 22 }, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{value}</Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function LinePanel({ title, lines, emptyText }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2 }}>{title}</Typography>
        <Stack spacing={1.5}>
          {lines.map((line) => <LineUsage key={`${line.budget.id}-${line.id}`} line={line} />)}
          {!lines.length && <Typography color="text.secondary">{emptyText}</Typography>}
        </Stack>
      </CardContent>
    </Card>
  );
}

function LineUsage({ line }) {
  const value = Number(line.utilizationPercent || 0);
  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={600}>{line.ledger.name}</Typography>
          <Typography variant="caption" color="text.secondary">{line.budget.name}</Typography>
        </Box>
        <Typography sx={{ whiteSpace: 'nowrap' }}>{value.toFixed(2)}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" color={value >= 100 ? 'error' : value >= 80 ? 'warning' : 'primary'} value={Math.min(100, value)} sx={{ height: 8, borderRadius: 1 }} />
      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'space-between', mt: 0.75 }}>
        <Typography variant="caption" color="text.secondary">Actual {money(line.actualAmount)}</Typography>
        <Typography variant="caption" color="text.secondary">Allocated {money(line.allocatedAmount)}</Typography>
        <Typography variant="caption" color="text.secondary">Remaining {money(line.remainingAmount)}</Typography>
      </Stack>
    </Box>
  );
}

function BudgetUtilizationTable({ budgets }) {
  const rows = budgets.map((budget) => ({
    ...budget,
    budgetName: `${budget.name} ${budget.code} / ${budget.fiscalYear}`,
    fromDate: budget.periodFrom,
    period: `${formatDate(budget.periodFrom)} to ${formatDate(budget.periodTo)}`,
    allocated: Number(budget.totalAmount || 0),
    actual: Number(budget.actualAmount || 0),
    remaining: Number(budget.remainingAmount || 0),
    utilization: Number(budget.utilizationPercent || 0)
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
      title="Budget Utilization"
      rows={rows}
      columns={columns}
      fileName="budget-utilization"
      searchPlaceholder="Search budgets"
      dateField="fromDate"
      selectFilters={[{ field: 'status', label: 'Status', options: Array.from(new Set(rows.map((row) => row.status))).map((status) => ({ value: status, label: status })) }]}
    />
  );
}
