import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';

import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ArrowRightOutlined from '@ant-design/icons/ArrowRightOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';

import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

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

const natures = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const dc = ['DEBIT', 'CREDIT'];
const ledgerTypes = ['GENERAL', 'CASH', 'BANK', 'CAPITAL', 'CUSTOMER', 'VENDOR', 'TAX', 'EXPENSE', 'INCOME'];

export default function AccountingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [groups, setGroups] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [ledgerReport, setLedgerReport] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherTypeOpen, setVoucherTypeOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', code: '', nature: 'ASSET' });
  const [ledgerForm, setLedgerForm] = useState({
    name: '',
    code: '',
    groupId: '',
    ledgerType: 'GENERAL',
    openingBalance: 0,
    openingType: 'DEBIT',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankBranch: ''
  });
  const [voucherForm, setVoucherForm] = useState({
    voucherTypeId: '',
    voucherNo: '',
    voucherDate: todayIso(),
    narration: '',
    lines: [
      { ledgerId: '', type: 'DEBIT', amount: 0, narration: '' },
      { ledgerId: '', type: 'CREDIT', amount: 0, narration: '' }
    ]
  });
  const [voucherTypeForm, setVoucherTypeForm] = useState({
    name: '',
    code: '',
    category: 'accounting',
    prefix: '',
    nextNumber: 1,
    padding: 5,
    suffix: '',
    isActive: true
  });
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const totals = useMemo(
    () => ({
      debit: voucherForm.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount || 0), 0),
      credit: voucherForm.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount || 0), 0)
    }),
    [voucherForm.lines]
  );
  const filteredVouchers = useMemo(
    () => voucherTypeFilter ? vouchers.filter((voucher) => voucher.voucherType === voucherTypeFilter) : vouchers,
    [vouchers, voucherTypeFilter]
  );

  async function loadData() {
    const [groupData, ledgerData, voucherTypeData, voucherData, trialData] = await Promise.all([
      api('/accounting/groups'),
      api('/accounting/ledgers'),
      api('/accounting/voucher-types'),
      api('/accounting/vouchers'),
      api('/accounting/reports/trial-balance')
    ]);
    setGroups(groupData);
    setLedgers(ledgerData);
    setVoucherTypes(voucherTypeData);
    setVouchers(voucherData);
    setTrialBalance(trialData);
    setSelectedLedgerId((current) => current || ledgerData[0]?.id || '');
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    if (!ledgers.length) return;
    const ledgerId = searchParams.get('ledger');
    const voucherType = searchParams.get('voucherType');
    const voucherId = searchParams.get('voucher');
    if (ledgerId && ledgers.some((ledger) => ledger.id === ledgerId)) {
      setSelectedLedgerId(ledgerId);
      setVoucherTypeFilter('');
      setSelectedVoucher(null);
      setTab(6);
      loadLedgerReport(ledgerId).catch((loadError) => setError(loadError.message));
      return;
    }
    if (voucherType) {
      setVoucherTypeFilter(voucherType);
      setSelectedVoucher(null);
      setTab(3);
      return;
    }
    if (voucherId) {
      setSelectedVoucher(vouchers.find((voucher) => voucher.id === voucherId) || null);
      return;
    }
    setSelectedVoucher(null);
  }, [searchParams, ledgers, vouchers]);

  async function save(action, success, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(success);
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function updateLine(index, key, value) {
    setVoucherForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line))
    }));
  }

  function addLine() {
    setVoucherForm((current) => ({ ...current, lines: [...current.lines, { ledgerId: '', type: 'DEBIT', amount: 0, narration: '' }] }));
  }

  async function loadLedgerReport(ledgerId = selectedLedgerId) {
    if (!ledgerId) return;
    setLedgerReport(await api(`/accounting/reports/ledger/${ledgerId}`));
  }

  function openLedger(ledgerId) {
    setSelectedLedgerId(ledgerId);
    setTab(6);
    setSearchParams({ ledger: ledgerId });
    loadLedgerReport(ledgerId).catch((reportError) => setError(reportError.message));
  }

  function openVoucherRegister(voucherType) {
    setVoucherTypeFilter(voucherType);
    setTab(3);
    setSearchParams({ voucherType });
  }

  function openVoucher(voucher) {
    setSelectedVoucher(voucher);
    setSearchParams({ voucher: voucher.id });
  }

  function closeVoucher() {
    setSelectedVoucher(null);
    setSearchParams(voucherTypeFilter ? { voucherType: voucherTypeFilter } : {});
  }

  function clearDrillDown(nextTab = tab) {
    setVoucherTypeFilter('');
    setSelectedVoucher(null);
    setSearchParams({});
    setTab(nextTab);
  }

  function ledgerModule(ledger) {
    if (ledger.ledgerType === 'CUSTOMER') return { label: 'Sales', path: '/sales' };
    if (ledger.ledgerType === 'VENDOR') return { label: 'Purchase', path: '/purchase' };
    if (['BANK', 'CASH'].includes(ledger.ledgerType)) return { label: 'Banking', path: '/banking' };
    if (ledger.ledgerType === 'TAX') return { label: 'GST', path: '/gst' };
    if (['RAW_MATERIAL_INVENTORY', 'FINISHED_GOODS_INVENTORY', 'PURCHASE_INVENTORY'].includes(ledger.code)) {
      return { label: 'Inventory', path: '/inventory' };
    }
    if (ledger.code === 'SALARY_EXPENSE' || ledger.code.endsWith('_PAYABLE')) return { label: 'Payroll', path: '/payroll' };
    return null;
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && (
        <Grid size={12}>
          <Alert severity={error ? 'error' : 'success'} onClose={() => (error ? setError('') : setMessage(''))}>
            {error || message}
          </Alert>
        </Grid>
      )}

      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between', alignItems: { md: 'center' }, bgcolor: 'grey.50' }}>
            <Breadcrumbs>
              <Link component="button" underline="hover" color="inherit" onClick={() => clearDrillDown(0)}>Accounting Gateway</Link>
              {tab === 6 && ledgerReport && <Typography color="text.primary">{ledgerReport.ledger.name} Ledger</Typography>}
              {tab === 3 && voucherTypeFilter && <Typography color="text.primary">{voucherTypes.find((type) => type.code === voucherTypeFilter)?.name || voucherTypeFilter} Register</Typography>}
              {selectedVoucher && <Typography color="text.primary">{selectedVoucher.voucherNo}</Typography>}
            </Breadcrumbs>
            <Typography variant="caption" color="text.secondary">Select any underlined master or voucher to drill down. Browser Back preserves the path.</Typography>
          </Stack>
          <Tabs value={tab} onChange={(_, value) => clearDrillDown(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Groups" />
            <Tab label="Ledgers" />
            <Tab label="Voucher Types" />
            <Tab label="Vouchers" />
            <Tab label="Trial Balance" />
            <Tab label="Day Book" />
            <Tab label="Ledger Report" />
          </Tabs>

          {tab === 0 && (
            <GridPanel label="Create Group" onCreate={() => setGroupOpen(true)}>
              <Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Nature</TableCell><TableCell>Ledger Names</TableCell></TableRow></TableHead><TableBody>{groups.map((group) => <TableRow key={group.id}><TableCell>{group.name}</TableCell><TableCell>{group.code}</TableCell><TableCell>{group.nature}</TableCell><TableCell>{group.ledgers?.map((ledger) => ledger.name).join(', ') || '-'}</TableCell></TableRow>)}</TableBody></Table>
            </GridPanel>
          )}

          {tab === 1 && (
            <GridPanel label="Create Ledger" onCreate={() => { setLedgerForm({ name: '', code: '', groupId: groups[0]?.id || '', ledgerType: 'GENERAL', openingBalance: 0, openingType: 'DEBIT', bankName: '', bankAccountNo: '', bankIfsc: '', bankBranch: '' }); setLedgerOpen(true); }}>
              <Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>Code</TableCell><TableCell>Group</TableCell><TableCell>Opening</TableCell><TableCell>Go To</TableCell></TableRow></TableHead><TableBody>{ledgers.map((ledger) => {
                const module = ledgerModule(ledger);
                return <TableRow hover key={ledger.id}><TableCell><Link component="button" underline="always" onClick={() => openLedger(ledger.id)}>{ledger.name}</Link></TableCell><TableCell>{ledger.ledgerType}</TableCell><TableCell>{ledger.code}</TableCell><TableCell>{ledger.group.name}</TableCell><TableCell>{ledger.openingType} {Number(ledger.openingBalance).toFixed(2)}</TableCell><TableCell>{module ? <Button size="small" endIcon={<ArrowRightOutlined />} onClick={() => navigate(module.path)}>{module.label}</Button> : <Button size="small" onClick={() => openLedger(ledger.id)}>Ledger</Button>}</TableCell></TableRow>;
              })}</TableBody></Table>
            </GridPanel>
          )}

          {tab === 2 && (
            <GridPanel label="Create Voucher Type" onCreate={() => { setVoucherTypeForm({ name: '', code: '', category: 'accounting', prefix: '', nextNumber: 1, padding: 5, suffix: '', isActive: true }); setVoucherTypeOpen(true); }}>
              <Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Category</TableCell><TableCell>Pattern</TableCell><TableCell>Next</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{voucherTypes.map((type) => <TableRow hover key={type.id} onDoubleClick={() => openVoucherRegister(type.code)}><TableCell><Link component="button" underline="always" onClick={() => openVoucherRegister(type.code)}>{type.name}</Link></TableCell><TableCell>{type.code}</TableCell><TableCell>{type.category}</TableCell><TableCell>{type.prefix}{String(type.nextNumber).padStart(type.padding, '0')}{type.suffix || ''}</TableCell><TableCell>{type.nextNumber}</TableCell><TableCell>{type.isActive ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table>
            </GridPanel>
          )}

          {tab === 3 && (
            <GridPanel label="Create Voucher" onCreate={() => setVoucherOpen(true)}>
              <Stack spacing={1.5}>
                {voucherTypeFilter && <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Chip color="primary" label={`${voucherTypes.find((type) => type.code === voucherTypeFilter)?.name || voucherTypeFilter} Register`} /><Button size="small" onClick={() => clearDrillDown(3)}>Show All Vouchers</Button></Stack>}
                <VoucherTable vouchers={filteredVouchers} onVoucher={openVoucher} onVoucherType={openVoucherRegister} />
              </Stack>
            </GridPanel>
          )}

          {tab === 4 && (
            <Box sx={{ p: 2.5 }}>
              <Table size="small"><TableHead><TableRow><TableCell>Ledger</TableCell><TableCell>Group</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow></TableHead><TableBody>{trialBalance.map((row) => <TableRow hover key={row.ledgerId}><TableCell><Link component="button" underline="always" onClick={() => openLedger(row.ledgerId)}>{row.ledgerName}</Link></TableCell><TableCell>{row.groupName}</TableCell><TableCell align="right">{row.debit.toFixed(2)}</TableCell><TableCell align="right">{row.credit.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>
            </Box>
          )}

          {tab === 5 && (
            <Box sx={{ p: 2.5 }}>
              <VoucherTable vouchers={vouchers} onVoucher={openVoucher} onVoucherType={openVoucherRegister} />
            </Box>
          )}

          {tab === 6 && (
            <Stack spacing={2.5} sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={2}>
                <TextField select label="Ledger" value={selectedLedgerId} onChange={(event) => setSelectedLedgerId(event.target.value)} sx={{ minWidth: 280 }}>
                  {ledgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}
                </TextField>
                <Button variant="contained" onClick={() => loadLedgerReport().catch((reportError) => setError(reportError.message))}>View</Button>
              </Stack>
              {ledgerReport && (
                <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Narration</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell><TableCell align="right">Balance</TableCell></TableRow></TableHead><TableBody>{ledgerReport.entries.map((entry, index) => {
                  const voucher = vouchers.find((item) => item.voucherNo === entry.voucherNo && item.voucherType === entry.voucherType);
                  return <TableRow hover key={`${entry.voucherNo}-${index}`}><TableCell>{formatDate(entry.date)}</TableCell><TableCell><Link component="button" underline="always" disabled={!voucher} onClick={() => voucher && openVoucher(voucher)}>{entry.voucherType} {entry.voucherNo}</Link></TableCell><TableCell>{entry.narration}</TableCell><TableCell align="right">{entry.debit.toFixed(2)}</TableCell><TableCell align="right">{entry.credit.toFixed(2)}</TableCell><TableCell align="right">{entry.balance.toFixed(2)}</TableCell></TableRow>;
                })}</TableBody></Table>
              )}
            </Stack>
          )}
        </Box>
      </Grid>

      <Dialog open={groupOpen} onClose={() => setGroupOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/groups', { method: 'POST', body: JSON.stringify(groupForm) }), 'Group created', () => setGroupOpen(false)); }}>
          <DialogTitle>Create Group</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Name" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /><TextField label="Code" value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} required /><TextField select label="Nature" value={groupForm.nature} onChange={(event) => setGroupForm({ ...groupForm, nature: event.target.value })}>{natures.map((nature) => <MenuItem key={nature} value={nature}>{nature}</MenuItem>)}</TextField></Stack></DialogContent>
          <DialogActions><Button onClick={() => setGroupOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={ledgerOpen} onClose={() => setLedgerOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/ledgers', { method: 'POST', body: JSON.stringify({ ...ledgerForm, openingBalance: Number(ledgerForm.openingBalance) }) }), 'Ledger created', () => setLedgerOpen(false)); }}>
          <DialogTitle>Create Ledger</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Name" value={ledgerForm.name} onChange={(event) => setLedgerForm({ ...ledgerForm, name: event.target.value })} required /><TextField label="Code" value={ledgerForm.code} onChange={(event) => setLedgerForm({ ...ledgerForm, code: event.target.value })} required /><TextField select label="Ledger type" value={ledgerForm.ledgerType} onChange={(event) => setLedgerForm({ ...ledgerForm, ledgerType: event.target.value })}>{ledgerTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField><TextField select label="Group" value={ledgerForm.groupId} onChange={(event) => setLedgerForm({ ...ledgerForm, groupId: event.target.value })}>{groups.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}</TextField>{ledgerForm.ledgerType === 'BANK' && <><TextField label="Bank name" value={ledgerForm.bankName} onChange={(event) => setLedgerForm({ ...ledgerForm, bankName: event.target.value })} /><TextField label="Account number" value={ledgerForm.bankAccountNo} onChange={(event) => setLedgerForm({ ...ledgerForm, bankAccountNo: event.target.value })} /><TextField label="IFSC" value={ledgerForm.bankIfsc} onChange={(event) => setLedgerForm({ ...ledgerForm, bankIfsc: event.target.value })} /><TextField label="Bank branch" value={ledgerForm.bankBranch} onChange={(event) => setLedgerForm({ ...ledgerForm, bankBranch: event.target.value })} /></>}<TextField type="number" label="Opening balance" value={ledgerForm.openingBalance} onChange={(event) => setLedgerForm({ ...ledgerForm, openingBalance: event.target.value })} /><TextField select label="Opening type" value={ledgerForm.openingType} onChange={(event) => setLedgerForm({ ...ledgerForm, openingType: event.target.value })}>{dc.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField></Stack></DialogContent>
          <DialogActions><Button onClick={() => setLedgerOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={voucherOpen} onClose={() => setVoucherOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/vouchers', { method: 'POST', body: JSON.stringify({ ...voucherForm, lines: voucherForm.lines.map((line) => ({ ...line, amount: Number(line.amount) })) }) }), 'Voucher posted', () => setVoucherOpen(false)); }}>
          <DialogTitle>Create Voucher</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Grid container spacing={2}><Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Voucher Type" value={voucherForm.voucherTypeId} onChange={(event) => setVoucherForm({ ...voucherForm, voucherTypeId: event.target.value })}>{voucherTypes.map((type) => <MenuItem key={type.id} value={type.id}>{type.name} ({type.prefix}{String(type.nextNumber).padStart(type.padding, '0')}{type.suffix || ''})</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Voucher No (optional)" value={voucherForm.voucherNo} onChange={(event) => setVoucherForm({ ...voucherForm, voucherNo: event.target.value })} helperText="Leave blank for auto number" /></Grid><Grid size={{ xs: 12, md: 4 }}><DateField fullWidth label="Date" value={voucherForm.voucherDate} onChange={(event) => setVoucherForm({ ...voucherForm, voucherDate: event.target.value })} /></Grid></Grid><TextField label="Narration" value={voucherForm.narration} onChange={(event) => setVoucherForm({ ...voucherForm, narration: event.target.value })} />
            {voucherForm.lines.map((line, index) => <Grid container spacing={2} key={index}><Grid size={{ xs: 12, md: 5 }}><TextField select fullWidth label="Ledger" value={line.ledgerId} onChange={(event) => updateLine(index, 'ledgerId', event.target.value)}>{ledgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="Type" value={line.type} onChange={(event) => updateLine(index, 'type', event.target.value)}>{dc.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Amount" value={line.amount} onChange={(event) => updateLine(index, 'amount', event.target.value)} /></Grid></Grid>)}
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Button onClick={addLine}>Add Line</Button><Typography>Debit {totals.debit.toFixed(2)} | Credit {totals.credit.toFixed(2)}</Typography></Stack>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setVoucherOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Post Voucher</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={voucherTypeOpen} onClose={() => setVoucherTypeOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/voucher-types', { method: 'POST', body: JSON.stringify({ ...voucherTypeForm, nextNumber: Number(voucherTypeForm.nextNumber), padding: Number(voucherTypeForm.padding) }) }), 'Voucher type created', () => setVoucherTypeOpen(false)); }}>
          <DialogTitle>Create Voucher Type</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Name" value={voucherTypeForm.name} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, name: event.target.value })} required /><TextField label="Code" value={voucherTypeForm.code} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, code: event.target.value })} required /><TextField label="Category" value={voucherTypeForm.category} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, category: event.target.value })} required /><TextField label="Prefix" value={voucherTypeForm.prefix} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, prefix: event.target.value })} required /><TextField type="number" label="Next Number" value={voucherTypeForm.nextNumber} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, nextNumber: event.target.value })} /><TextField type="number" label="Padding" value={voucherTypeForm.padding} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, padding: event.target.value })} /><TextField label="Suffix" value={voucherTypeForm.suffix} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, suffix: event.target.value })} /></Stack></DialogContent>
          <DialogActions><Button onClick={() => setVoucherTypeOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(selectedVoucher)} onClose={closeVoucher} fullWidth maxWidth="md">
        <DialogTitle>{selectedVoucher?.voucherType.toUpperCase()} Voucher: {selectedVoucher?.voucherNo}</DialogTitle>
        <DialogContent>
          {selectedVoucher && <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}><Grid size={4}><Typography color="text.secondary">Date</Typography><Typography>{formatDate(selectedVoucher.voucherDate)}</Typography></Grid><Grid size={4}><Typography color="text.secondary">Status</Typography><Chip size="small" color="success" label={selectedVoucher.status} /></Grid><Grid size={4}><Typography color="text.secondary">Branch</Typography><Typography>{selectedVoucher.branch?.name || '-'}</Typography></Grid></Grid>
            <Typography>{selectedVoucher.narration || 'No narration'}</Typography>
            <Table size="small"><TableHead><TableRow><TableCell>Ledger</TableCell><TableCell>Narration</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow></TableHead><TableBody>{selectedVoucher.lines.map((line) => <TableRow key={line.id}><TableCell><Link component="button" underline="always" onClick={() => { closeVoucher(); openLedger(line.ledgerId); }}>{line.ledger.name}</Link></TableCell><TableCell>{line.narration || '-'}</TableCell><TableCell align="right">{line.type === 'DEBIT' ? Number(line.amount).toFixed(2) : '-'}</TableCell><TableCell align="right">{line.type === 'CREDIT' ? Number(line.amount).toFixed(2) : '-'}</TableCell></TableRow>)}</TableBody></Table>
          </Stack>}
        </DialogContent>
        <DialogActions><Button onClick={() => { const type = selectedVoucher?.voucherType; closeVoucher(); if (type) openVoucherRegister(type); }}>Open {selectedVoucher?.voucherType} Register</Button><Button variant="contained" onClick={closeVoucher}>Close</Button></DialogActions>
      </Dialog>
    </Grid>
  );
}

function GridPanel({ label, onCreate, children }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack><TableContainer>{children}</TableContainer></Stack>;
}

function VoucherTable({ vouchers, onVoucher, onVoucherType }) {
  return <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Voucher No</TableCell><TableCell>Narration</TableCell><TableCell>Lines</TableCell></TableRow></TableHead><TableBody>{vouchers.map((voucher) => <TableRow hover key={voucher.id}><TableCell>{formatDate(voucher.voucherDate)}</TableCell><TableCell><Link component="button" underline="always" onClick={() => onVoucherType(voucher.voucherType)}>{voucher.voucherType}</Link></TableCell><TableCell><Link component="button" underline="always" onClick={() => onVoucher(voucher)}>{voucher.voucherNo}</Link></TableCell><TableCell>{voucher.narration}</TableCell><TableCell>{voucher.lines.map((line) => `${line.ledger.name} ${line.type} ${Number(line.amount).toFixed(2)}`).join(' | ')}</TableCell></TableRow>)}</TableBody></Table>;
}




