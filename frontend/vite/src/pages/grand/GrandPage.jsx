import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

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

export default function GrandPage() {
  const [filters, setFilters] = useState({ from: '2026-04-01', to: todayIso() });
  const [reports, setReports] = useState({});
  const [budget, setBudget] = useState({ budgets: [] });
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => `from=${filters.from}&to=${filters.to}`, [filters]);

  async function loadData() {
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

  useEffect(() => { loadData(); }, []);

  const netCash = Number(reports.bankBalance || 0) + Number(reports.cashBalance || 0);
  const grandPosition = Number(reports.netProfit || 0) + netCash + Number(budget.remainingAmount || 0);
  const cards = [
    ['Grand Position', money(grandPosition)],
    ['Net Profit', money(reports.netProfit)],
    ['Budget Remaining', money(budget.remainingAmount)],
    ['Budget Utilization', `${Number(budget.utilizationPercent || 0).toFixed(2)}%`],
    ['Receivables', money(reports.receivables)],
    ['Payables', money(reports.payables)]
  ];

  const summaryRows = [
    ['Net Sales', reports.sales?.total],
    ['Net Purchases', reports.purchases?.total],
    ['Stock Value', reports.stockValue],
    ['Bank + Cash', netCash],
    ['Allocated Budget', budget.allocatedAmount],
    ['Actual Budget Usage', budget.actualAmount]
  ];

  return (
    <Grid container spacing={2.75}>
      {error && <Grid size={12}><Alert severity="error" onClose={() => setError('')}>{error}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="h3">Grand</Typography><Typography color="text.secondary">Consolidated business totals across budgets, cash, profit, receivables, payables, and stock.</Typography></Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <DateField size="small" label="From" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
            <DateField size="small" label="To" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            <Button variant="contained" startIcon={<ReloadOutlined />} disabled={loading} onClick={loadData}>{loading ? 'Loading...' : 'Apply'}</Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={12}><GrandCards cards={cards} /></Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" sx={{ mb: 2 }}>Grand Summary</Typography>
            <Stack spacing={1.25}>{summaryRows.map(([label, value]) => <SummaryRow key={label} label={label} value={money(value)} />)}</Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" sx={{ mb: 2 }}>Budget Coverage</Typography>
            <Stack spacing={1.5}>
              <SummaryRow label="Allocated" value={money(budget.allocatedAmount)} />
              <SummaryRow label="Actual" value={money(budget.actualAmount)} />
              <SummaryRow label="Remaining" value={money(budget.remainingAmount)} />
              <Box>
                <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography color="text.secondary">Utilization</Typography>
                  <Typography>{Number(budget.utilizationPercent || 0).toFixed(2)}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(100, Number(budget.utilizationPercent || 0))} sx={{ height: 8, borderRadius: 1 }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={12}><BudgetRows budgets={budgets} /></Grid>
    </Grid>
  );
}

function GrandCards({ cards }) {
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

function SummaryRow({ label, value }) {
  return <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Typography color="text.secondary">{label}</Typography><Typography fontWeight={600}>{value}</Typography></Stack>;
}

function BudgetRows({ budgets }) {
  return (
    <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead><TableRow><TableCell>Budget</TableCell><TableCell>Period</TableCell><TableCell>Status</TableCell><TableCell align="right">Allocated</TableCell><TableCell align="right">Actual</TableCell><TableCell align="right">Remaining</TableCell><TableCell>Utilization</TableCell></TableRow></TableHead>
        <TableBody>
          {budgets.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell><Typography fontWeight={600}>{row.name}</Typography><Typography variant="caption" color="text.secondary">{row.code}</Typography></TableCell>
              <TableCell>{formatDate(row.periodFrom)} to {formatDate(row.periodTo)}</TableCell>
              <TableCell><Chip size="small" color={row.status === 'ACTIVE' ? 'success' : row.status === 'DRAFT' ? 'warning' : 'default'} label={row.status} /></TableCell>
              <TableCell align="right">{money(row.totalAmount)}</TableCell>
              <TableCell align="right">{money(row.actualAmount)}</TableCell>
              <TableCell align="right">{money(row.remainingAmount)}</TableCell>
              <TableCell sx={{ minWidth: 160 }}><Typography variant="caption">{Number(row.utilizationPercent || 0).toFixed(2)}%</Typography><LinearProgress variant="determinate" value={Math.min(100, Number(row.utilizationPercent || 0))} sx={{ mt: 0.5, height: 6, borderRadius: 1 }} /></TableCell>
            </TableRow>
          ))}
          {!budgets.length && <TableRow><TableCell colSpan={7} align="center">No budget data available.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
