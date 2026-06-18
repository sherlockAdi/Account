import { useEffect, useMemo, useState } from 'react';

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

import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const budgetFlows = ['UTILIZATION', 'RECEIPT'];
const dc = ['DEBIT', 'CREDIT'];

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

const emptyVoucherLines = [
  { ledgerId: '', type: 'DEBIT', amount: 0, narration: '' },
  { ledgerId: '', type: 'CREDIT', amount: 0, narration: '' }
];

export default function GrandPage() {
  const [budgets, setBudgets] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [selectedGrantId, setSelectedGrantId] = useState('');
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    code: '',
    category: 'GOVERNMENT_GRANT',
    totalAmount: 0,
    isAnnual: false,
    isActive: true
  });
  const [grantForm, setGrantForm] = useState({
    budgetTypeId: '',
    name: '',
    code: '',
    amount: 0,
    isDefault: false,
    isActive: true
  });
  const [voucherForm, setVoucherForm] = useState({
    voucherTypeId: '',
    voucherNo: '',
    voucherDate: todayIso(),
    budgetTypeId: '',
    budgetGrantId: '',
    budgetFlow: 'RECEIPT',
    narration: '',
    lines: emptyVoucherLines
  });

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [budgetData, voucherData, voucherTypeData, ledgerData] = await Promise.all([
        api('/accounting/budgets'),
        api('/accounting/vouchers'),
        api('/accounting/voucher-types'),
        api('/accounting/ledgers')
      ]);
      setBudgets(budgetData);
      setVouchers(voucherData);
      setVoucherTypes(voucherTypeData);
      setLedgers(ledgerData);
      setSelectedBudgetId((current) => current && budgetData.some((budget) => budget.id === current) ? current : budgetData[0]?.id || '');
      setSelectedGrantId((current) => current && budgetData.some((budget) => budget.grants?.some((grant) => grant.id === current)) ? current : '');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const currentBudget = useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) || budgets[0] || null,
    [budgets, selectedBudgetId]
  );
  const currentGrant = useMemo(
    () => currentBudget?.grants?.find((grant) => grant.id === selectedGrantId) || null,
    [currentBudget, selectedGrantId]
  );
  const allGrants = useMemo(
    () => budgets.flatMap((budget) => (budget.grants || []).map((grant) => ({ ...grant, budgetName: budget.name, budgetCode: budget.code, budgetId: budget.id }))),
    [budgets]
  );
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (selectedGrantId) return voucher.budgetGrantId === selectedGrantId;
      if (selectedBudgetId) return voucher.budgetTypeId === selectedBudgetId;
      return Boolean(voucher.budgetTypeId);
    });
  }, [vouchers, selectedBudgetId, selectedGrantId]);
  const totals = useMemo(
    () => ({
      debit: voucherForm.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount || 0), 0),
      credit: voucherForm.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount || 0), 0)
    }),
    [voucherForm.lines]
  );
  const cards = [
    ['Budget Masters', budgets.length],
    ['Grant Heads', allGrants.length],
    ['Received', money(allGrants.reduce((sum, grant) => sum + Number(grant.receivedAmount || 0), 0))],
    ['Utilized', money(allGrants.reduce((sum, grant) => sum + Number(grant.utilizedAmount || 0), 0))],
    ['Available', money(allGrants.reduce((sum, grant) => sum + Number(grant.availableAmount || 0), 0))],
    ['Tagged Vouchers', filteredVouchers.length]
  ];

  function openBudgetDialog() {
    setBudgetForm({
      name: '',
      code: '',
      category: 'GOVERNMENT_GRANT',
      totalAmount: 0,
      isAnnual: false,
      isActive: true
    });
    setBudgetOpen(true);
  }

  function openGrantDialog() {
    setGrantForm({
      budgetTypeId: currentBudget?.id || budgets[0]?.id || '',
      name: '',
      code: '',
      amount: 0,
      isDefault: false,
      isActive: true
    });
    setGrantOpen(true);
  }

  function openVoucherDialog(flow = 'RECEIPT') {
    const activeBudget = currentBudget || budgets[0] || null;
    setVoucherForm({
      voucherTypeId: voucherTypes[0]?.id || '',
      voucherNo: '',
      voucherDate: todayIso(),
      budgetTypeId: activeBudget?.id || '',
      budgetGrantId: currentGrant?.id || activeBudget?.grants?.[0]?.id || '',
      budgetFlow: flow,
      narration: '',
      lines: emptyVoucherLines.map((line) => ({ ...line }))
    });
    setVoucherOpen(true);
  }

  function updateVoucherLine(index, changes) {
    setVoucherForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...changes } : line))
    }));
  }

  function changeVoucherBudget(budgetTypeId) {
    const budget = budgets.find((item) => item.id === budgetTypeId) || null;
    setVoucherForm((current) => ({
      ...current,
      budgetTypeId: budget?.id || '',
      budgetGrantId: budget?.grants?.find((grant) => grant.isDefault)?.id || budget?.grants?.[0]?.id || ''
    }));
  }

  async function run(action, success, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(success);
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h3">Grant Budget Masters</Typography>
            <Typography color="text.secondary">Maintain different budget masters, government grant receipts, and grant utilization directly on vouchers.</Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button startIcon={<ReloadOutlined />} onClick={loadData} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={openBudgetDialog}>Create Master</Button>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={openGrantDialog} disabled={!currentBudget}>Create Grant</Button>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => openVoucherDialog('RECEIPT')} disabled={!currentBudget}>Grant Receipt Voucher</Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={12}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(6, minmax(0, 1fr))' }, gap: 2 }}>
          {cards.map(([label, value]) => (
            <Card key={label} variant="outlined" sx={{ minWidth: 0 }}>
              <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
                <Typography color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: 20, lg: 22 }, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{value}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Budget Master</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Received</TableCell>
                <TableCell align="right">Utilized</TableCell>
                <TableCell align="right">Available</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {budgets.map((budget) => (
                <TableRow key={budget.id} hover selected={budget.id === currentBudget?.id} onClick={() => { setSelectedBudgetId(budget.id); setSelectedGrantId(''); }} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography fontWeight={600}>{budget.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{budget.code}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={budget.category} color={budget.category === 'GOVERNMENT_GRANT' ? 'primary' : 'default'} />
                  </TableCell>
                  <TableCell align="right">{money(budget.totalAmount)}</TableCell>
                  <TableCell align="right">{money(budget.receivedAmount)}</TableCell>
                  <TableCell align="right">{money(budget.utilizedAmount)}</TableCell>
                  <TableCell align="right">{money(budget.availableAmount)}</TableCell>
                </TableRow>
              ))}
              {!budgets.length && <TableRow><TableCell colSpan={6} align="center">No budget masters available.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Grant</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Received</TableCell>
                <TableCell align="right">Utilized</TableCell>
                <TableCell align="right">Available</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(currentBudget?.grants || []).map((grant) => (
                <TableRow key={grant.id} hover selected={grant.id === currentGrant?.id} onClick={() => setSelectedGrantId(grant.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Typography fontWeight={600}>{grant.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{grant.code}{grant.isDefault ? ' / default' : ''}</Typography>
                  </TableCell>
                  <TableCell align="right">{money(grant.amount)}</TableCell>
                  <TableCell align="right">{money(grant.receivedAmount)}</TableCell>
                  <TableCell align="right">{money(grant.utilizedAmount)}</TableCell>
                  <TableCell align="right">{money(grant.availableAmount)}</TableCell>
                </TableRow>
              ))}
              {!currentBudget?.grants?.length && <TableRow><TableCell colSpan={5} align="center">No grants created for this master.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>

      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box>
            <Typography variant="h5">Tagged Voucher Register</Typography>
            <Typography color="text.secondary">{currentGrant ? `${currentGrant.name} voucher entries` : currentBudget ? `${currentBudget.name} voucher entries` : 'Voucher entries linked to grant budgets'}</Typography>
          </Box>
          <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => openVoucherDialog('UTILIZATION')} disabled={!currentBudget}>Grant Utilization Voucher</Button>
        </Stack>
      </Grid>

      <Grid size={12}>
        <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Voucher</TableCell>
                <TableCell>Budget / Grant</TableCell>
                <TableCell>Flow</TableCell>
                <TableCell>Narration</TableCell>
                <TableCell align="right">Debit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredVouchers.map((voucher) => (
                <TableRow key={voucher.id} hover>
                  <TableCell>{formatDate(voucher.voucherDate)}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{voucher.voucherNo}</Typography>
                    <Typography variant="caption" color="text.secondary">{voucher.voucherType}</Typography>
                  </TableCell>
                  <TableCell>{voucher.budgetType?.name || '-'} / {voucher.budgetGrant?.name || 'Nil'}</TableCell>
                  <TableCell><Chip size="small" color={voucher.budgetFlow === 'RECEIPT' ? 'success' : 'warning'} label={voucher.budgetFlow === 'RECEIPT' ? 'Receipt' : 'Utilization'} /></TableCell>
                  <TableCell>{voucher.narration || '-'}</TableCell>
                  <TableCell align="right">{money(voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0))}</TableCell>
                </TableRow>
              ))}
              {!filteredVouchers.length && <TableRow><TableCell colSpan={6} align="center">No vouchers tagged to this budget selection.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>

      <Dialog open={budgetOpen} onClose={() => setBudgetOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); run(() => api('/accounting/budgets', { method: 'POST', body: JSON.stringify({ ...budgetForm, totalAmount: Number(budgetForm.totalAmount) }) }), 'Budget master created', () => setBudgetOpen(false)); }}>
          <DialogTitle>Create Budget Master</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Master Name" value={budgetForm.name} onChange={(event) => setBudgetForm({ ...budgetForm, name: event.target.value })} required />
              <TextField label="Code" value={budgetForm.code} onChange={(event) => setBudgetForm({ ...budgetForm, code: event.target.value })} required />
              <TextField label="Category" value={budgetForm.category} onChange={(event) => setBudgetForm({ ...budgetForm, category: event.target.value })} />
              <TextField type="number" label="Budget Amount" value={budgetForm.totalAmount} onChange={(event) => setBudgetForm({ ...budgetForm, totalAmount: event.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setBudgetOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); run(() => api(`/accounting/budgets/${grantForm.budgetTypeId}/grants`, { method: 'POST', body: JSON.stringify({ ...grantForm, amount: Number(grantForm.amount) }) }), 'Grant created', () => setGrantOpen(false)); }}>
          <DialogTitle>Create Grant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Budget Master" value={grantForm.budgetTypeId} onChange={(event) => setGrantForm({ ...grantForm, budgetTypeId: event.target.value })} required>
                {budgets.map((budget) => <MenuItem key={budget.id} value={budget.id}>{budget.name}</MenuItem>)}
              </TextField>
              <TextField label="Grant Name" value={grantForm.name} onChange={(event) => setGrantForm({ ...grantForm, name: event.target.value })} required />
              <TextField label="Grant Code" value={grantForm.code} onChange={(event) => setGrantForm({ ...grantForm, code: event.target.value })} required />
              <TextField type="number" label="Sanctioned / Expected Amount" value={grantForm.amount} onChange={(event) => setGrantForm({ ...grantForm, amount: event.target.value })} />
              <TextField select label="Default Grant" value={grantForm.isDefault ? 'yes' : 'no'} onChange={(event) => setGrantForm({ ...grantForm, isDefault: event.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setGrantOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={voucherOpen} onClose={() => setVoucherOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); run(() => api('/accounting/vouchers', { method: 'POST', body: JSON.stringify({ ...voucherForm, lines: voucherForm.lines.map((line) => ({ ...line, amount: Number(line.amount) })) }) }), 'Grant voucher posted', () => setVoucherOpen(false)); }}>
          <DialogTitle>Create Grant Voucher</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select fullWidth label="Voucher Type" value={voucherForm.voucherTypeId} onChange={(event) => setVoucherForm({ ...voucherForm, voucherTypeId: event.target.value })}>
                    {voucherTypes.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Voucher No (optional)" value={voucherForm.voucherNo} onChange={(event) => setVoucherForm({ ...voucherForm, voucherNo: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <DateField fullWidth label="Date" value={voucherForm.voucherDate} onChange={(event) => setVoucherForm({ ...voucherForm, voucherDate: event.target.value })} />
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select fullWidth label="Budget Master" value={voucherForm.budgetTypeId} onChange={(event) => changeVoucherBudget(event.target.value)}>
                    {budgets.map((budget) => <MenuItem key={budget.id} value={budget.id}>{budget.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select fullWidth label="Grant" value={voucherForm.budgetGrantId} onChange={(event) => setVoucherForm({ ...voucherForm, budgetGrantId: event.target.value })}>
                    {(budgets.find((budget) => budget.id === voucherForm.budgetTypeId)?.grants || []).map((grant) => <MenuItem key={grant.id} value={grant.id}>{grant.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select fullWidth label="Flow" value={voucherForm.budgetFlow} onChange={(event) => setVoucherForm({ ...voucherForm, budgetFlow: event.target.value })}>
                    {budgetFlows.map((flow) => <MenuItem key={flow} value={flow}>{flow === 'RECEIPT' ? 'Grant Receipt' : 'Grant Utilization'}</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
              <TextField fullWidth label="Narration" value={voucherForm.narration} onChange={(event) => setVoucherForm({ ...voucherForm, narration: event.target.value })} />
              {voucherForm.lines.map((line, index) => (
                <Grid container spacing={2} key={index}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <TextField select fullWidth label="Ledger" value={line.ledgerId} onChange={(event) => updateVoucherLine(index, { ledgerId: event.target.value })}>
                      {ledgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField select fullWidth label="Type" value={line.type} onChange={(event) => updateVoucherLine(index, { type: event.target.value })}>
                      {dc.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField fullWidth type="number" label="Amount" value={line.amount} onChange={(event) => updateVoucherLine(index, { amount: event.target.value })} />
                  </Grid>
                </Grid>
              ))}
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Button onClick={() => setVoucherForm((current) => ({ ...current, lines: [...current.lines, { ledgerId: '', type: 'DEBIT', amount: 0, narration: '' }] }))}>Add Line</Button>
                <Typography>Debit {totals.debit.toFixed(2)} | Credit {totals.credit.toFixed(2)}</Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setVoucherOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Post Voucher</Button></DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}
