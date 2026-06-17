import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const currentYear = new Date().getFullYear();
const emptyLine = { ledgerId: '', branchId: '', allocatedAmount: 0, notes: '' };
const emptyForm = {
  name: '',
  code: '',
  fiscalYear: `${currentYear}-${String(currentYear + 1).slice(-2)}`,
  periodFrom: `${currentYear}-04-01`,
  periodTo: `${currentYear + 1}-03-31`,
  status: 'DRAFT',
  notes: '',
  lines: [{ ...emptyLine }]
};

async function api(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

export default function BudgetPage() {
  const [dashboard, setDashboard] = useState({ budgets: [] });
  const [budgets, setBudgets] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, budgetData, ledgerData, branchData] = await Promise.all([
        api('/budget/dashboard'),
        api('/budget/budgets'),
        api('/budget/ledgers'),
        api('/budget/branches')
      ]);
      setDashboard(dashboardData);
      setBudgets(budgetData);
      setLedgers(ledgerData);
      setBranches(branchData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openCreate() {
    setForm({
      ...emptyForm,
      code: `BUD-${todayIso().replaceAll('-', '').slice(0, 6)}`,
      lines: [{ ...emptyLine, ledgerId: ledgers[0]?.id || '' }]
    });
    setOpen(true);
  }

  function updateLine(index, changes) {
    setForm({ ...form, lines: form.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line) });
  }

  async function run(action, success) {
    try {
      setError('');
      setMessage('');
      const result = await action();
      setMessage(success);
      await loadData();
      return result;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    }
  }

  async function saveBudget() {
    const payload = {
      ...form,
      code: form.code.toUpperCase(),
      lines: form.lines
        .filter((line) => line.ledgerId && Number(line.allocatedAmount) >= 0)
        .map((line) => ({ ...line, branchId: line.branchId || undefined, allocatedAmount: Number(line.allocatedAmount) }))
    };
    const result = await run(() => api('/budget/budgets', { method: 'POST', body: JSON.stringify(payload) }), 'Budget created');
    if (result) setOpen(false);
  }

  async function setStatus(budget, status) {
    await run(() => api(`/budget/budgets/${budget.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }), `Budget ${status.toLowerCase()}`);
  }

  const totalDraft = form.lines.reduce((sum, line) => sum + Number(line.allocatedAmount || 0), 0);

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="h3">Budget</Typography><Typography color="text.secondary">Plan budgets, track utilization, and compare actual spending with approved allocations.</Typography></Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <Button startIcon={<ReloadOutlined />} onClick={loadData} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={openCreate}>Create Budget</Button>
          </Stack>
        </Stack>
      </Grid>
      <Grid size={12}><BudgetOverview dashboard={dashboard} /></Grid>
      <Grid size={12}><BudgetTable budgets={budgets} onStatus={setStatus} /></Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Create Budget</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Budget Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Fiscal Year" value={form.fiscalYear} onChange={(event) => setForm({ ...form, fiscalYear: event.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 2 }}><DateField fullWidth label="From" value={form.periodFrom} onChange={(event) => setForm({ ...form, periodFrom: event.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 2 }}><DateField fullWidth label="To" value={form.periodTo} onChange={(event) => setForm({ ...form, periodTo: event.target.value })} /></Grid>
            </Grid>
            <TextField label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <Table size="small">
              <TableHead><TableRow><TableCell>Ledger</TableCell><TableCell>Branch</TableCell><TableCell align="right">Allocated Amount</TableCell><TableCell>Notes</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {form.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell><TextField select fullWidth size="small" value={line.ledgerId} onChange={(event) => updateLine(index, { ledgerId: event.target.value })}>{ledgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name} ({ledger.group.nature})</MenuItem>)}</TextField></TableCell>
                    <TableCell><TextField select fullWidth size="small" value={line.branchId} onChange={(event) => updateLine(index, { branchId: event.target.value })}><MenuItem value="">All branches</MenuItem>{branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}</TextField></TableCell>
                    <TableCell align="right"><TextField size="small" type="number" value={line.allocatedAmount} onChange={(event) => updateLine(index, { allocatedAmount: event.target.value })} inputProps={{ min: 0, style: { textAlign: 'right' } }} /></TableCell>
                    <TableCell><TextField fullWidth size="small" value={line.notes} onChange={(event) => updateLine(index, { notes: event.target.value })} /></TableCell>
                    <TableCell align="right"><IconButton color="error" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}><DeleteOutlined /></IconButton></TableCell>
                  </TableRow>
                ))}
                <TableRow><TableCell colSpan={2}><Button startIcon={<PlusOutlined />} onClick={() => setForm({ ...form, lines: [...form.lines, { ...emptyLine, ledgerId: ledgers[0]?.id || '' }] })}>Add Line</Button></TableCell><TableCell align="right"><strong>{money(totalDraft)}</strong></TableCell><TableCell colSpan={2} /></TableRow>
              </TableBody>
            </Table>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={saveBudget}>Save Budget</Button></DialogActions>
      </Dialog>
    </Grid>
  );
}

function BudgetOverview({ dashboard }) {
  const cards = [
    ['Budgets', dashboard.budgetCount || 0],
    ['Active', dashboard.activeCount || 0],
    ['Allocated', money(dashboard.allocatedAmount)],
    ['Actual', money(dashboard.actualAmount)],
    ['Remaining', money(dashboard.remainingAmount)],
    ['Utilization', `${Number(dashboard.utilizationPercent || 0).toFixed(2)}%`]
  ];
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

function BudgetTable({ budgets, onStatus }) {
  return (
    <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small" sx={{ minWidth: 1180, '& th, & td': { verticalAlign: 'top' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 210 }}>Budget</TableCell>
            <TableCell sx={{ width: 140 }}>Period</TableCell>
            <TableCell sx={{ width: 100 }}>Status</TableCell>
            <TableCell align="right" sx={{ width: 130 }}>Allocated</TableCell>
            <TableCell align="right" sx={{ width: 120 }}>Actual</TableCell>
            <TableCell align="right" sx={{ width: 130 }}>Remaining</TableCell>
            <TableCell sx={{ width: 170 }}>Utilization</TableCell>
            <TableCell>Lines</TableCell>
            <TableCell align="right" sx={{ width: 150 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {budgets.map((budget) => (
            <TableRow key={budget.id} hover>
              <TableCell><Typography fontWeight={600}>{budget.name}</Typography><Typography variant="caption" color="text.secondary">{budget.code} / {budget.fiscalYear}</Typography></TableCell>
              <TableCell><Stack spacing={0.25}><Typography>{formatDate(budget.periodFrom)}</Typography><Typography variant="caption" color="text.secondary">to</Typography><Typography>{formatDate(budget.periodTo)}</Typography></Stack></TableCell>
              <TableCell><BudgetStatusChip status={budget.status} /></TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(budget.totalAmount)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(budget.actualAmount)}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{money(budget.remainingAmount)}</TableCell>
              <TableCell><Typography variant="caption">{Number(budget.utilizationPercent || 0).toFixed(2)}%</Typography><LinearProgress variant="determinate" value={Math.min(100, Number(budget.utilizationPercent || 0))} sx={{ mt: 0.5, height: 6, borderRadius: 1 }} /></TableCell>
              <TableCell><BudgetLines lines={budget.lines} /></TableCell>
              <TableCell align="right"><Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>{budget.status === 'DRAFT' && <Button size="small" onClick={() => onStatus(budget, 'ACTIVE')}>Activate</Button>}{budget.status === 'ACTIVE' && <Button size="small" onClick={() => onStatus(budget, 'CLOSED')}>Close</Button>}{budget.status !== 'ARCHIVED' && <Button size="small" color="warning" onClick={() => onStatus(budget, 'ARCHIVED')}>Archive</Button>}</Stack></TableCell>
            </TableRow>
          ))}
          {!budgets.length && <TableRow><TableCell colSpan={9} align="center">No budgets created yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function BudgetLines({ lines }) {
  return (
    <Stack spacing={0.75}>
      {lines.map((line) => (
        <Box key={line.id} sx={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 120px 60px', gap: 1, alignItems: 'center' }}>
          <Typography>{line.ledger.name}</Typography>
          <Typography align="right" sx={{ whiteSpace: 'nowrap' }}>{money(line.allocatedAmount)}</Typography>
          <Typography align="right" variant="caption" color="text.secondary">{Number(line.utilizationPercent || 0).toFixed(1)}%</Typography>
        </Box>
      ))}
    </Stack>
  );
}

function BudgetStatusChip({ status }) {
  const color = status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'warning' : status === 'CLOSED' ? 'primary' : 'default';
  return <Chip size="small" color={color} label={status} />;
}
