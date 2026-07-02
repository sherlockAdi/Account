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
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import CreditCardOutlined from '@ant-design/icons/CreditCardOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => todayIso();
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

async function api(path, options) {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

export default function BankingPage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({ accounts: [], recentAdvices: [] });
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [advices, setAdvices] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [chequeOpen, setChequeOpen] = useState(false);
  const [adviceOpen, setAdviceOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [reconcileForm, setReconcileForm] = useState({ clearedDate: today(), bankReference: '', notes: '' });
  const [chequeForm, setChequeForm] = useState({
    bankLedgerId: '', partyLedgerId: '', chequeNo: '', chequeDate: today(), amount: 0,
    direction: 'ISSUED', payeeName: '', notes: ''
  });
  const [adviceForm, setAdviceForm] = useState({
    bankLedgerId: '', beneficiaryLedgerId: '', adviceNo: `ADV-${Date.now().toString().slice(-6)}`,
    adviceDate: today(), paymentDate: today(), amount: 0, paymentMode: 'NEFT', bankReference: '', narration: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadedTabs, setLoadedTabs] = useState({});
  const [referenceLoaded, setReferenceLoaded] = useState(false);

  const bankAccounts = useMemo(() => accounts.filter((account) => account.ledgerType === 'BANK'), [accounts]);
  const cashAccounts = useMemo(() => accounts.filter((account) => account.ledgerType === 'CASH'), [accounts]);
  const partyLedgers = useMemo(() => ledgers.filter((ledger) => ledger.ledgerType !== 'BANK' && ledger.ledgerType !== 'CASH'), [ledgers]);
  const visibleTransactions = useMemo(
    () => selectedBank ? transactions.filter((transaction) => transaction.bankLedgerId === selectedBank) : transactions,
    [transactions, selectedBank]
  );

  async function loadAccounts() {
    const accountData = await api('/banking/accounts');
    setAccounts(accountData);
    setSelectedBank((current) => current || accountData.find((account) => account.ledgerType === 'BANK')?.id || '');
    return accountData;
  }

  async function ensureReferenceData() {
    if (referenceLoaded && accounts.length && ledgers.length) return { accountData: accounts, ledgerData: ledgers };
    const [accountData, ledgerData] = await Promise.all([
      accounts.length ? Promise.resolve(accounts) : api('/banking/accounts'),
      ledgers.length ? Promise.resolve(ledgers) : api('/accounting/ledgers')
    ]);
    setAccounts(accountData);
    setLedgers(ledgerData);
    setReferenceLoaded(true);
    setSelectedBank((current) => current || accountData.find((account) => account.ledgerType === 'BANK')?.id || '');
    return { accountData, ledgerData };
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setError('');
      if (tabIndex === 0) setDashboard(await api('/banking/dashboard'));
      if (tabIndex === 1 || tabIndex === 2) {
        await loadAccounts();
        setTransactions(await api('/banking/transactions'));
      }
      if (tabIndex === 3) setCheques(await api('/banking/cheques'));
      if (tabIndex === 4) setAdvices(await api('/banking/payment-advices'));
      setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => { loadTabData(tab); }, [tab]);

  async function save(action, success, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(success);
      await loadTabData(tab, true);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function openReconcile(transaction) {
    setSelectedTransaction(transaction);
    setReconcileForm({ clearedDate: today(), bankReference: '', notes: '' });
    setReconcileOpen(true);
  }

  async function openCheque() {
    const { accountData, ledgerData } = await ensureReferenceData();
    const freshBankAccounts = accountData.filter((account) => account.ledgerType === 'BANK');
    const freshPartyLedgers = ledgerData.filter((ledger) => ledger.ledgerType !== 'BANK' && ledger.ledgerType !== 'CASH');
    setChequeForm({
      bankLedgerId: freshBankAccounts[0]?.id || '', partyLedgerId: freshPartyLedgers[0]?.id || '',
      chequeNo: '', chequeDate: today(), amount: 0, direction: 'ISSUED', payeeName: '', notes: ''
    });
    setChequeOpen(true);
  }

  async function openAdvice() {
    const { accountData, ledgerData } = await ensureReferenceData();
    const freshBankAccounts = accountData.filter((account) => account.ledgerType === 'BANK');
    const freshPartyLedgers = ledgerData.filter((ledger) => ledger.ledgerType !== 'BANK' && ledger.ledgerType !== 'CASH');
    setAdviceForm({
      bankLedgerId: freshBankAccounts[0]?.id || '', beneficiaryLedgerId: freshPartyLedgers[0]?.id || '',
      adviceNo: `ADV-${Date.now().toString().slice(-6)}`, adviceDate: today(), paymentDate: today(),
      amount: 0, paymentMode: 'NEFT', bankReference: '', narration: ''
    });
    setAdviceOpen(true);
  }

  async function updateChequeStatus(cheque, status) {
    await save(
      () => api(`/banking/cheques/${cheque.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, clearedDate: status === 'CLEARED' ? today() : undefined })
      }),
      `Cheque marked ${status.toLowerCase()}`,
      () => {}
    );
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box><Typography variant="h3">Banking Control Panel</Typography><Typography color="text.secondary">Bank books, reconciliation, cheque controls and payment workflows connected to accounting.</Typography></Box>
          <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<CreditCardOutlined />} onClick={openCheque}>New Cheque</Button><Button variant="contained" startIcon={<PlusOutlined />} onClick={openAdvice}>Payment Advice</Button></Stack>
        </Stack>
      </Grid>
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Dashboard" /><Tab label="Cash & Bank Books" /><Tab label="Reconciliation" /><Tab label="Cheque Register" /><Tab label="Payment Advice" />
          </Tabs>
          {tab === 0 && <Dashboard dashboard={dashboard} />}
          {tab === 1 && <Books accounts={accounts} transactions={visibleTransactions} selectedBank={selectedBank} setSelectedBank={setSelectedBank} bankAccounts={bankAccounts} cashAccounts={cashAccounts} />}
          {tab === 2 && <Reconciliation transactions={visibleTransactions} bankAccounts={bankAccounts} selectedBank={selectedBank} setSelectedBank={setSelectedBank} onReconcile={openReconcile} />}
          {tab === 3 && <ChequeRegister cheques={cheques} onStatus={updateChequeStatus} />}
          {tab === 4 && <AdviceTable advices={advices} />}
        </Box>
      </Grid>

      <Dialog open={reconcileOpen} onClose={() => setReconcileOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(() => api(`/banking/transactions/${selectedTransaction.voucherLineId}/reconcile`, { method: 'POST', body: JSON.stringify(reconcileForm) }), 'Transaction reconciled', () => setReconcileOpen(false));
        }}>
          <DialogTitle>Reconcile {selectedTransaction?.voucherNo}</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Alert severity="info">{selectedTransaction?.bankLedgerName}: {money(selectedTransaction?.deposit || selectedTransaction?.withdrawal)}</Alert><DateField label="Cleared Date" value={reconcileForm.clearedDate} onChange={(e) => setReconcileForm({ ...reconcileForm, clearedDate: e.target.value })} /><TextField label="Bank Reference" value={reconcileForm.bankReference} onChange={(e) => setReconcileForm({ ...reconcileForm, bankReference: e.target.value })} /><TextField multiline minRows={2} label="Notes" value={reconcileForm.notes} onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })} /></Stack></DialogContent>
          <DialogActions><Button onClick={() => setReconcileOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Mark Reconciled</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={chequeOpen} onClose={() => setChequeOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(() => api('/banking/cheques', { method: 'POST', body: JSON.stringify({ ...chequeForm, amount: Number(chequeForm.amount), partyLedgerId: chequeForm.partyLedgerId || undefined }) }), 'Cheque added to register', () => setChequeOpen(false));
        }}>
          <DialogTitle>New Cheque</DialogTitle>
          <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={12}><TextField select fullWidth label="Bank Account" value={chequeForm.bankLedgerId} onChange={(e) => setChequeForm({ ...chequeForm, bankLedgerId: e.target.value })}>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>)}</TextField></Grid>
            <Grid size={8}><TextField select fullWidth label="Party Ledger" value={chequeForm.partyLedgerId} onChange={(e) => setChequeForm({ ...chequeForm, partyLedgerId: e.target.value })}>{partyLedgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}</TextField></Grid>
            <Grid size={4}><TextField select fullWidth label="Direction" value={chequeForm.direction} onChange={(e) => setChequeForm({ ...chequeForm, direction: e.target.value })}><MenuItem value="ISSUED">Issued</MenuItem><MenuItem value="RECEIVED">Received</MenuItem></TextField></Grid>
            <Grid size={4}><TextField fullWidth label="Cheque No" value={chequeForm.chequeNo} onChange={(e) => setChequeForm({ ...chequeForm, chequeNo: e.target.value })} required /></Grid>
            <Grid size={4}><DateField fullWidth label="Cheque Date" value={chequeForm.chequeDate} onChange={(e) => setChequeForm({ ...chequeForm, chequeDate: e.target.value })} /></Grid>
            <Grid size={4}><TextField fullWidth type="number" label="Amount" value={chequeForm.amount} onChange={(e) => setChequeForm({ ...chequeForm, amount: e.target.value })} /></Grid>
            <Grid size={12}><TextField fullWidth label="Payee / Drawer Name" value={chequeForm.payeeName} onChange={(e) => setChequeForm({ ...chequeForm, payeeName: e.target.value })} /></Grid>
          </Grid></DialogContent>
          <DialogActions><Button onClick={() => setChequeOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save Cheque</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={adviceOpen} onClose={() => setAdviceOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(() => api('/banking/payment-advices', { method: 'POST', body: JSON.stringify({ ...adviceForm, amount: Number(adviceForm.amount) }) }), 'Payment advice issued and posted to accounts', () => setAdviceOpen(false));
        }}>
          <DialogTitle>Create Payment Advice</DialogTitle>
          <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Pay From Bank" value={adviceForm.bankLedgerId} onChange={(e) => setAdviceForm({ ...adviceForm, bankLedgerId: e.target.value })}>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.name} ({money(account.balance)})</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Beneficiary Ledger" value={adviceForm.beneficiaryLedgerId} onChange={(e) => setAdviceForm({ ...adviceForm, beneficiaryLedgerId: e.target.value })}>{partyLedgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Advice No" value={adviceForm.adviceNo} onChange={(e) => setAdviceForm({ ...adviceForm, adviceNo: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><DateField fullWidth label="Advice Date" value={adviceForm.adviceDate} onChange={(e) => setAdviceForm({ ...adviceForm, adviceDate: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><DateField fullWidth label="Payment Date" value={adviceForm.paymentDate} onChange={(e) => setAdviceForm({ ...adviceForm, paymentDate: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Amount" value={adviceForm.amount} onChange={(e) => setAdviceForm({ ...adviceForm, amount: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Mode" value={adviceForm.paymentMode} onChange={(e) => setAdviceForm({ ...adviceForm, paymentMode: e.target.value })}>{['NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE'].map((mode) => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Bank Reference" value={adviceForm.bankReference} onChange={(e) => setAdviceForm({ ...adviceForm, bankReference: e.target.value })} /></Grid>
            <Grid size={12}><TextField fullWidth multiline minRows={2} label="Narration" value={adviceForm.narration} onChange={(e) => setAdviceForm({ ...adviceForm, narration: e.target.value })} /></Grid>
          </Grid></DialogContent>
          <DialogActions><Button onClick={() => setAdviceOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Issue & Post</Button></DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}

function Dashboard({ dashboard }) {
  const cards = [['Bank Balance', money(dashboard.totalBankBalance)], ['Cash Balance', money(dashboard.totalCashBalance)], ['Unreconciled', dashboard.unreconciledCount || 0], ['Pending Cheques', dashboard.pendingCheques || 0]];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, lg: 7 }}><Typography variant="h5" sx={{ mb: 1 }}>Account Balances</Typography><AccountTable accounts={dashboard.accounts || []} /></Grid><Grid size={{ xs: 12, lg: 5 }}><Card variant="outlined"><CardContent><Typography variant="h5">Attention Required</Typography><Stack spacing={1.5} sx={{ mt: 2 }}><Alert severity={dashboard.unreconciledCount ? 'warning' : 'success'}>{dashboard.unreconciledCount || 0} unreconciled transactions, net {money(dashboard.unreconciledAmount)}</Alert><Alert severity={dashboard.pendingCheques ? 'info' : 'success'}>{dashboard.pendingCheques || 0} pending cheques worth {money(dashboard.pendingChequeAmount)}</Alert></Stack></CardContent></Card></Grid></Grid></Stack>;
}

function Books({ accounts, transactions, selectedBank, setSelectedBank, bankAccounts }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}><Typography variant="h5">Cash and Bank Books</Typography><TextField select size="small" label="Transaction Account" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)} sx={{ minWidth: 240 }}>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>)}</TextField></Stack><AccountTable accounts={accounts} /><TransactionTable transactions={transactions} /></Stack>;
}

function AccountTable({ accounts }) {
  const rows = accounts.map((account) => ({ ...account, accountText: `${account.name} ${account.code}`, bankDetails: `${account.bankName || '-'}${account.bankAccountNo ? ` A/c ${account.bankAccountNo}` : ''}`, balanceAmount: Number(account.balance || 0) }));
  const columns = [
    { field: 'accountText', headerName: 'Account', flex: 1, minWidth: 220 },
    { field: 'ledgerType', headerName: 'Type', flex: 0.7, minWidth: 130 },
    { field: 'bankDetails', headerName: 'Bank Details', flex: 1, minWidth: 220 },
    { field: 'balanceAmount', headerName: 'Book Balance', type: 'number', flex: 0.8, minWidth: 160, valueFormatter: (value) => money(value) }
  ];
  return <CommonDataGrid title="Account Balances" rows={rows} columns={columns} fileName="bank-accounts" searchPlaceholder="Search accounts" height={360} selectFilters={[{ field: 'ledgerType', label: 'Type', options: [{ value: 'BANK', label: 'BANK' }, { value: 'CASH', label: 'CASH' }] }]} />;
}

function Reconciliation({ transactions, bankAccounts, selectedBank, setSelectedBank, onReconcile }) {
  const rows = transactions.map((row) => ({ ...row, id: row.voucherLineId, depositAmount: Number(row.deposit || 0), withdrawalAmount: Number(row.withdrawal || 0), statusText: row.reconciliation ? 'Reconciled' : 'Unreconciled' }));
  const columns = transactionColumns();
  columns.push({ field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 0.7, minWidth: 140, renderCell: (params) => <Button size="small" startIcon={<CheckCircleOutlined />} disabled={Boolean(params.row.reconciliation)} onClick={() => onReconcile(params.row)}>Reconcile</Button> });
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h5">Bank Reconciliation</Typography><Typography color="text.secondary">Match book transactions with the bank statement.</Typography></Box><TextField select size="small" label="Bank Account" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)} sx={{ minWidth: 240 }}>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>)}</TextField></Stack><CommonDataGrid title="Bank Reconciliation" rows={rows} columns={columns} fileName="bank-reconciliation" searchPlaceholder="Search transactions" dateField="date" selectFilters={[{ field: 'statusText', label: 'Status', options: [{ value: 'Reconciled', label: 'Reconciled' }, { value: 'Unreconciled', label: 'Unreconciled' }] }]} /></Stack>;
}

function TransactionTable({ transactions }) {
  const rows = transactions.map((row) => ({ ...row, id: row.voucherLineId, depositAmount: Number(row.deposit || 0), withdrawalAmount: Number(row.withdrawal || 0), statusText: row.reconciliation ? 'Reconciled' : 'Pending' }));
  return <CommonDataGrid title="Transactions" rows={rows} columns={transactionColumns()} fileName="bank-transactions" searchPlaceholder="Search transactions" dateField="date" selectFilters={[{ field: 'statusText', label: 'Status', options: [{ value: 'Reconciled', label: 'Reconciled' }, { value: 'Pending', label: 'Pending' }] }]} />;
}

function ChequeRegister({ cheques, onStatus }) {
  const rows = cheques.map((cheque) => ({ ...cheque, date: cheque.chequeDate, chequeText: cheque.chequeNo, bankParty: `${cheque.bankLedger.name} / ${cheque.partyLedger?.name || cheque.payeeName || '-'}`, amountValue: Number(cheque.amount || 0) }));
  const columns = [
    { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
    { field: 'chequeText', headerName: 'Cheque', flex: 0.8, minWidth: 150 },
    { field: 'bankParty', headerName: 'Bank / Party', flex: 1.3, minWidth: 260 },
    { field: 'direction', headerName: 'Direction', flex: 0.7, minWidth: 130 },
    { field: 'amountValue', headerName: 'Amount', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => money(value) },
    { field: 'status', headerName: 'Status', flex: 0.7, minWidth: 130 },
    { field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 1.1, minWidth: 220, renderCell: (params) => <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>{params.row.status === 'PENDING' && <Button size="small" onClick={() => onStatus(params.row, params.row.direction === 'RECEIVED' ? 'DEPOSITED' : 'CLEARED')}>{params.row.direction === 'RECEIVED' ? 'Deposit' : 'Clear'}</Button>}{params.row.status === 'DEPOSITED' && <Button size="small" onClick={() => onStatus(params.row, 'CLEARED')}>Clear</Button>}{['PENDING', 'DEPOSITED'].includes(params.row.status) && <Button size="small" color="error" onClick={() => onStatus(params.row, 'BOUNCED')}>Bounce</Button>}</Stack> }
  ];
  return <Box sx={{ p: 2.5 }}><CommonDataGrid title="Cheque Register" rows={rows} columns={columns} fileName="cheque-register" searchPlaceholder="Search cheques" dateField="date" selectFilters={[{ field: 'direction', label: 'Direction', options: [{ value: 'ISSUED', label: 'ISSUED' }, { value: 'RECEIVED', label: 'RECEIVED' }] }, { field: 'status', label: 'Status', options: Array.from(new Set(rows.map((row) => row.status))).map((status) => ({ value: status, label: status })) }]} /></Box>;
}

function AdviceTable({ advices }) {
  const rows = advices.map((advice) => ({ ...advice, date: advice.paymentDate, adviceText: `${advice.adviceNo} ${formatDate(advice.adviceDate)}`, beneficiaryName: advice.beneficiaryLedger.name, bankMode: `${advice.bankLedger.name} / ${advice.paymentMode}`, referenceText: advice.bankReference || '-', amountValue: Number(advice.amount || 0) }));
  const columns = [
    { field: 'adviceText', headerName: 'Advice', flex: 1, minWidth: 190 },
    { field: 'date', headerName: 'Payment Date', flex: 0.8, minWidth: 150, valueFormatter: (value) => formatDate(value) },
    { field: 'beneficiaryName', headerName: 'Beneficiary', flex: 1, minWidth: 190 },
    { field: 'bankMode', headerName: 'Bank / Mode', flex: 1.1, minWidth: 220 },
    { field: 'referenceText', headerName: 'Reference', flex: 0.8, minWidth: 150 },
    { field: 'amountValue', headerName: 'Amount', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => money(value) },
    { field: 'status', headerName: 'Status', flex: 0.7, minWidth: 130 }
  ];
  return <Box sx={{ p: 2.5 }}><CommonDataGrid title="Payment Advice" rows={rows} columns={columns} fileName="payment-advice" searchPlaceholder="Search advice" dateField="date" selectFilters={[{ field: 'status', label: 'Status', options: Array.from(new Set(rows.map((row) => row.status))).map((status) => ({ value: status, label: status })) }]} /></Box>;
}

function transactionColumns() {
  return [
    { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
    { field: 'voucherNo', headerName: 'Voucher', flex: 0.8, minWidth: 140 },
    { field: 'counterparty', headerName: 'Counterparty', flex: 1, minWidth: 190 },
    { field: 'narration', headerName: 'Narration', flex: 1.2, minWidth: 240, valueGetter: (value) => value || '-' },
    { field: 'depositAmount', headerName: 'Deposit', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => value ? money(value) : '-' },
    { field: 'withdrawalAmount', headerName: 'Withdrawal', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => value ? money(value) : '-' },
    { field: 'statusText', headerName: 'Status', flex: 0.7, minWidth: 130 }
  ];
}

function StatusChip({ status }) {
  const colors = { CLEARED: 'success', PAID: 'success', ISSUED: 'info', DEPOSITED: 'info', PENDING: 'warning', BOUNCED: 'error', CANCELLED: 'error', DRAFT: 'default' };
  return <Chip size="small" color={colors[status] || 'default'} label={status} />;
}




