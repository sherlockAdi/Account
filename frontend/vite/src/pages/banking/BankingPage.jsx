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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import CreditCardOutlined from '@ant-design/icons/CreditCardOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => new Date().toISOString().slice(0, 10);
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

  const bankAccounts = useMemo(() => accounts.filter((account) => account.ledgerType === 'BANK'), [accounts]);
  const cashAccounts = useMemo(() => accounts.filter((account) => account.ledgerType === 'CASH'), [accounts]);
  const partyLedgers = useMemo(() => ledgers.filter((ledger) => ledger.ledgerType !== 'BANK' && ledger.ledgerType !== 'CASH'), [ledgers]);
  const visibleTransactions = useMemo(
    () => selectedBank ? transactions.filter((transaction) => transaction.bankLedgerId === selectedBank) : transactions,
    [transactions, selectedBank]
  );

  async function loadData() {
    const [dashboardData, accountData, ledgerData] = await Promise.all([
      api('/banking/dashboard'), api('/banking/accounts'), api('/accounting/ledgers')
    ]);
    const [transactionData, chequeData, adviceData] = await Promise.all([
      api('/banking/transactions'), api('/banking/cheques'), api('/banking/payment-advices')
    ]);
    setDashboard(dashboardData);
    setAccounts(accountData);
    setTransactions(transactionData);
    setCheques(chequeData);
    setAdvices(adviceData);
    setLedgers(ledgerData);
    setSelectedBank((current) => current || accountData.find((account) => account.ledgerType === 'BANK')?.id || '');
  }

  useEffect(() => { loadData().catch((loadError) => setError(loadError.message)); }, []);

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

  function openReconcile(transaction) {
    setSelectedTransaction(transaction);
    setReconcileForm({ clearedDate: today(), bankReference: '', notes: '' });
    setReconcileOpen(true);
  }

  function openCheque() {
    setChequeForm({
      bankLedgerId: bankAccounts[0]?.id || '', partyLedgerId: partyLedgers[0]?.id || '',
      chequeNo: '', chequeDate: today(), amount: 0, direction: 'ISSUED', payeeName: '', notes: ''
    });
    setChequeOpen(true);
  }

  function openAdvice() {
    setAdviceForm({
      bankLedgerId: bankAccounts[0]?.id || '', beneficiaryLedgerId: partyLedgers[0]?.id || '',
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
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Alert severity="info">{selectedTransaction?.bankLedgerName}: {money(selectedTransaction?.deposit || selectedTransaction?.withdrawal)}</Alert><TextField type="date" label="Cleared Date" value={reconcileForm.clearedDate} onChange={(e) => setReconcileForm({ ...reconcileForm, clearedDate: e.target.value })} InputLabelProps={{ shrink: true }} /><TextField label="Bank Reference" value={reconcileForm.bankReference} onChange={(e) => setReconcileForm({ ...reconcileForm, bankReference: e.target.value })} /><TextField multiline minRows={2} label="Notes" value={reconcileForm.notes} onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })} /></Stack></DialogContent>
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
            <Grid size={4}><TextField fullWidth type="date" label="Cheque Date" value={chequeForm.chequeDate} onChange={(e) => setChequeForm({ ...chequeForm, chequeDate: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
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
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="date" label="Advice Date" value={adviceForm.adviceDate} onChange={(e) => setAdviceForm({ ...adviceForm, adviceDate: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="date" label="Payment Date" value={adviceForm.paymentDate} onChange={(e) => setAdviceForm({ ...adviceForm, paymentDate: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid>
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
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Account</TableCell><TableCell>Type</TableCell><TableCell>Bank Details</TableCell><TableCell align="right">Book Balance</TableCell></TableRow></TableHead><TableBody>{accounts.map((account) => <TableRow key={account.id}><TableCell>{account.name}<br /><Typography variant="caption">{account.code}</Typography></TableCell><TableCell><Chip size="small" label={account.ledgerType} color={account.ledgerType === 'BANK' ? 'primary' : 'default'} /></TableCell><TableCell>{account.bankName || '-'}{account.bankAccountNo && <><br />A/c {account.bankAccountNo}</>}</TableCell><TableCell align="right"><strong>{money(account.balance)}</strong></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function Reconciliation({ transactions, bankAccounts, selectedBank, setSelectedBank, onReconcile }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h5">Bank Reconciliation</Typography><Typography color="text.secondary">Match book transactions with the bank statement.</Typography></Box><TextField select size="small" label="Bank Account" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)} sx={{ minWidth: 240 }}>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>)}</TextField></Stack><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Counterparty</TableCell><TableCell align="right">Deposit</TableCell><TableCell align="right">Withdrawal</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{transactions.map((row) => <TableRow key={row.voucherLineId}><TableCell>{row.date.slice(0, 10)}</TableCell><TableCell>{row.voucherNo}<br /><Typography variant="caption">{row.narration}</Typography></TableCell><TableCell>{row.counterparty}</TableCell><TableCell align="right">{row.deposit ? money(row.deposit) : '-'}</TableCell><TableCell align="right">{row.withdrawal ? money(row.withdrawal) : '-'}</TableCell><TableCell><Chip size="small" color={row.reconciliation ? 'success' : 'warning'} label={row.reconciliation ? `Cleared ${row.reconciliation.clearedDate.slice(0, 10)}` : 'Unreconciled'} /></TableCell><TableCell align="right"><Button size="small" startIcon={<CheckCircleOutlined />} disabled={Boolean(row.reconciliation)} onClick={() => onReconcile(row)}>Reconcile</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Stack>;
}

function TransactionTable({ transactions }) {
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Particulars</TableCell><TableCell align="right">Deposit</TableCell><TableCell align="right">Withdrawal</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{transactions.map((row) => <TableRow key={row.voucherLineId}><TableCell>{row.date.slice(0, 10)}</TableCell><TableCell>{row.voucherNo}</TableCell><TableCell>{row.counterparty}<br /><Typography variant="caption">{row.narration}</Typography></TableCell><TableCell align="right">{row.deposit ? money(row.deposit) : '-'}</TableCell><TableCell align="right">{row.withdrawal ? money(row.withdrawal) : '-'}</TableCell><TableCell><Chip size="small" color={row.reconciliation ? 'success' : 'warning'} label={row.reconciliation ? 'Reconciled' : 'Pending'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function ChequeRegister({ cheques, onStatus }) {
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Cheque</TableCell><TableCell>Bank / Party</TableCell><TableCell>Direction</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{cheques.map((cheque) => <TableRow key={cheque.id}><TableCell>{cheque.chequeNo}<br />{cheque.chequeDate.slice(0, 10)}</TableCell><TableCell>{cheque.bankLedger.name}<br />{cheque.partyLedger?.name || cheque.payeeName || '-'}</TableCell><TableCell>{cheque.direction}</TableCell><TableCell align="right">{money(cheque.amount)}</TableCell><TableCell><StatusChip status={cheque.status} /></TableCell><TableCell align="right"><Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>{cheque.status === 'PENDING' && <Button size="small" onClick={() => onStatus(cheque, cheque.direction === 'RECEIVED' ? 'DEPOSITED' : 'CLEARED')}>{cheque.direction === 'RECEIVED' ? 'Deposit' : 'Clear'}</Button>}{cheque.status === 'DEPOSITED' && <Button size="small" onClick={() => onStatus(cheque, 'CLEARED')}>Clear</Button>}{['PENDING', 'DEPOSITED'].includes(cheque.status) && <Button size="small" color="error" onClick={() => onStatus(cheque, 'BOUNCED')}>Bounce</Button>}</Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function AdviceTable({ advices }) {
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Advice</TableCell><TableCell>Payment Date</TableCell><TableCell>Beneficiary</TableCell><TableCell>Bank / Mode</TableCell><TableCell>Reference</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{advices.map((advice) => <TableRow key={advice.id}><TableCell>{advice.adviceNo}<br />{advice.adviceDate.slice(0, 10)}</TableCell><TableCell>{advice.paymentDate.slice(0, 10)}</TableCell><TableCell>{advice.beneficiaryLedger.name}</TableCell><TableCell>{advice.bankLedger.name}<br />{advice.paymentMode}</TableCell><TableCell>{advice.bankReference || '-'}</TableCell><TableCell align="right">{money(advice.amount)}</TableCell><TableCell><StatusChip status={advice.status} /></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function StatusChip({ status }) {
  const colors = { CLEARED: 'success', PAID: 'success', ISSUED: 'info', DEPOSITED: 'info', PENDING: 'warning', BOUNCED: 'error', CANCELLED: 'error', DRAFT: 'default' };
  return <Chip size="small" color={colors[status] || 'default'} label={status} />;
}
