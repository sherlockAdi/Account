import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
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

import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => todayIso();
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

async function api(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({ from: '2026-04-01', to: today() });
  const [dashboard, setDashboard] = useState({});
  const [profitLoss, setProfitLoss] = useState({ income: [], expenses: [] });
  const [balanceSheet, setBalanceSheet] = useState({ assets: [], liabilities: [], equity: [] });
  const [trialBalance, setTrialBalance] = useState([]);
  const [stock, setStock] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [gst, setGst] = useState({});
  const [dayBook, setDayBook] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => `from=${filters.from}&to=${filters.to}`, [filters]);

  async function loadReports() {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, profitLossData, balanceSheetData] = await Promise.all([
        api(`/reports/dashboard?${query}`),
        api(`/reports/profit-loss?${query}`),
        api(`/reports/balance-sheet?${query}`)
      ]);
      setDashboard(dashboardData);
      setProfitLoss(profitLossData);
      setBalanceSheet(balanceSheetData);

      const [trialData, stockData, customerData, vendorData] = await Promise.all([
        api(`/accounting/reports/trial-balance?${query}`),
        api('/inventory/reports/stock-summary'),
        api('/sales/reports/customer-outstanding'),
        api('/purchase/reports/vendor-outstanding')
      ]);
      setTrialBalance(trialData);
      setStock(stockData);
      setCustomers(customerData);
      setVendors(vendorData);

      const [gstData, dayBookData] = await Promise.all([
        api(`/gst/reports/gstr-3b?${query}`),
        api(`/accounting/reports/day-book?${query}`)
      ]);
      setGst(gstData);
      setDayBook(dayBookData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadReports(); }, []);

  const exportSets = [
    {
      name: 'mis-overview',
      rows: Object.entries(dashboard).filter(([, value]) => typeof value === 'number').map(([metric, value]) => ({ metric, value }))
    },
    {
      name: 'profit-loss',
      rows: [
        ...profitLoss.income.map((row) => ({ section: 'Income', ledger: row.ledgerName, group: row.groupName, amount: row.amount })),
        ...profitLoss.expenses.map((row) => ({ section: 'Expense', ledger: row.ledgerName, group: row.groupName, amount: row.amount }))
      ]
    },
    {
      name: 'balance-sheet',
      rows: [
        ...balanceSheet.assets.map((row) => ({ section: 'Assets', ledger: row.ledgerName, group: row.groupName, amount: row.amount })),
        ...balanceSheet.liabilities.map((row) => ({ section: 'Liabilities', ledger: row.ledgerName, group: row.groupName, amount: row.amount })),
        ...balanceSheet.equity.map((row) => ({ section: 'Equity', ledger: row.ledgerName, group: row.groupName, amount: row.amount }))
      ]
    },
    { name: 'trial-balance', rows: trialBalance },
    { name: 'stock-summary', rows: stock },
    {
      name: 'outstanding',
      rows: [
        ...customers.map((row) => ({ type: 'Receivable', party: row.customerName, amount: row.totalReceivable })),
        ...vendors.map((row) => ({ type: 'Payable', party: row.vendorName, amount: row.totalPayable }))
      ]
    },
    { name: 'gst-summary', rows: [gst] },
    {
      name: 'day-book',
      rows: dayBook.map((voucher) => ({
        date: formatDate(voucher.voucherDate),
        voucherNo: voucher.voucherNo,
        voucherType: voucher.voucherType,
        narration: voucher.narration,
        debit: voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0),
        credit: voucher.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount), 0)
      }))
    }
  ];

  function exportCsv() {
    const report = exportSets[tab];
    if (!report.rows.length) return;
    const headers = [...new Set(report.rows.flatMap((row) => Object.keys(row)))];
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [headers.map(escape).join(','), ...report.rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `${report.name}-${filters.from}-to-${filters.to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <Grid container spacing={2.75}>
      {error && <Grid size={12}><Alert severity="error" onClose={() => setError('')}>{error}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { lg: 'center' } }}>
          <Box><Typography variant="h3">Reports & MIS</Typography><Typography color="text.secondary">Financial, inventory, statutory and management reporting in one workspace.</Typography></Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <DateField size="small" label="From" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <DateField size="small" label="To" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <Button variant="contained" startIcon={<ReloadOutlined />} onClick={loadReports} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</Button>
            <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
          </Stack>
        </Stack>
      </Grid>
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="MIS Overview" /><Tab label="Profit & Loss" /><Tab label="Balance Sheet" /><Tab label="Trial Balance" />
            <Tab label="Stock Summary" /><Tab label="Outstanding" /><Tab label="GST Summary" /><Tab label="Day Book" />
          </Tabs>
          {tab === 0 && <Overview dashboard={dashboard} />}
          {tab === 1 && <ProfitLoss report={profitLoss} />}
          {tab === 2 && <BalanceSheet report={balanceSheet} />}
          {tab === 3 && <TrialBalance rows={trialBalance} />}
          {tab === 4 && <StockSummary rows={stock} />}
          {tab === 5 && <Outstanding customers={customers} vendors={vendors} />}
          {tab === 6 && <GstSummary gst={gst} />}
          {tab === 7 && <DayBook vouchers={dayBook} />}
        </Box>
      </Grid>
    </Grid>
  );
}

function Overview({ dashboard }) {
  const cards = [
    ['Net Sales', money(dashboard.sales?.total)],
    ['Net Purchases', money(dashboard.purchases?.total)],
    ['Net Profit', money(dashboard.netProfit)],
    ['Stock Value', money(dashboard.stockValue)],
    ['Receivables', money(dashboard.receivables)],
    ['Payables', money(dashboard.payables)],
    ['Bank Balance', money(dashboard.bankBalance)],
    ['Cash Balance', money(dashboard.cashBalance)]
  ];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, md: 4 }}><SummaryCard title="Sales" rows={[['Invoices', dashboard.sales?.invoiceCount], ['Returns', dashboard.sales?.returnCount], ['Taxable Value', money(dashboard.sales?.taxableValue)], ['Output Tax', money(dashboard.sales?.taxAmount)]]} /></Grid><Grid size={{ xs: 12, md: 4 }}><SummaryCard title="GST Position" rows={[['Output Tax', money(dashboard.gst?.outputTax)], ['Input Tax', money(dashboard.gst?.inputTax)], ['Net Payable', money(dashboard.gst?.netPayable)]]} /></Grid><Grid size={{ xs: 12, md: 4 }}><SummaryCard title="Payroll" rows={[['Runs', dashboard.payroll?.runCount], ['Gross', money(dashboard.payroll?.gross)], ['Deductions', money(dashboard.payroll?.deductions)], ['Net Pay', money(dashboard.payroll?.net)]]} /></Grid></Grid></Stack>;
}

function SummaryCard({ title, rows }) {
  return <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 1.5 }}>{title}</Typography><Stack spacing={1}>{rows.map(([label, value]) => <Stack key={label} direction="row" sx={{ justifyContent: 'space-between' }}><Typography color="text.secondary">{label}</Typography><Typography>{value ?? 0}</Typography></Stack>)}</Stack></CardContent></Card>;
}

function ProfitLoss({ report }) {
  return <Grid container spacing={2} sx={{ p: 2.5 }}><Grid size={{ xs: 12, md: 6 }}><StatementTable title="Income" rows={report.income} total={report.totalIncome} /></Grid><Grid size={{ xs: 12, md: 6 }}><StatementTable title="Expenses" rows={report.expenses} total={report.totalExpenses} /></Grid><Grid size={12}><Alert severity={Number(report.netProfit) >= 0 ? 'success' : 'error'}>Net {Number(report.netProfit) >= 0 ? 'Profit' : 'Loss'}: <strong>{money(Math.abs(report.netProfit))}</strong></Alert></Grid></Grid>;
}

function BalanceSheet({ report }) {
  return <Grid container spacing={2} sx={{ p: 2.5 }}><Grid size={{ xs: 12, md: 6 }}><StatementTable title="Assets" rows={report.assets} total={report.totalAssets} /></Grid><Grid size={{ xs: 12, md: 6 }}><StatementTable title="Liabilities & Equity" rows={[...(report.liabilities || []), ...(report.equity || []), { ledgerId: 'profit', ledgerName: 'Current Period Profit / (Loss)', groupName: 'Retained Earnings', amount: report.currentPeriodProfit }]} total={report.totalLiabilitiesAndEquity} /></Grid><Grid size={12}><Alert severity={Math.abs(Number(report.difference || 0)) < 0.01 ? 'success' : 'warning'}>Balance difference: {money(report.difference)}</Alert></Grid></Grid>;
}

function StatementTable({ title, rows = [], total }) {
  return <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 1 }}>{title}</Typography><Table size="small"><TableHead><TableRow><TableCell>Ledger</TableCell><TableCell>Group</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.ledgerId}><TableCell>{row.ledgerName}</TableCell><TableCell>{row.groupName}</TableCell><TableCell align="right">{money(row.amount)}</TableCell></TableRow>)}<TableRow><TableCell colSpan={2}><strong>Total {title}</strong></TableCell><TableCell align="right"><strong>{money(total)}</strong></TableCell></TableRow></TableBody></Table></CardContent></Card>;
}

function TrialBalance({ rows }) {
  const debit = rows.reduce((sum, row) => sum + Number(row.debit), 0);
  const credit = rows.reduce((sum, row) => sum + Number(row.credit), 0);
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Ledger</TableCell><TableCell>Group</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell></TableRow></TableHead><TableBody>{rows.filter((row) => row.debit || row.credit).map((row) => <TableRow key={row.ledgerId}><TableCell>{row.ledgerName}</TableCell><TableCell>{row.groupName}</TableCell><TableCell align="right">{row.debit ? money(row.debit) : '-'}</TableCell><TableCell align="right">{row.credit ? money(row.credit) : '-'}</TableCell></TableRow>)}<TableRow><TableCell colSpan={2}><strong>Total</strong></TableCell><TableCell align="right"><strong>{money(debit)}</strong></TableCell><TableCell align="right"><strong>{money(credit)}</strong></TableCell></TableRow></TableBody></Table></TableContainer>;
}

function StockSummary({ rows }) {
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell>Group</TableCell><TableCell>Unit</TableCell><TableCell align="right">Quantity</TableCell><TableCell align="right">Value</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.itemId}><TableCell>{row.itemName}<br /><Typography variant="caption">{row.itemCode}</Typography></TableCell><TableCell>{row.groupName}</TableCell><TableCell>{row.unit}</TableCell><TableCell align="right">{Number(row.quantity).toFixed(3)}</TableCell><TableCell align="right">{money(row.value)}</TableCell><TableCell><Chip size="small" color={row.belowReorder ? 'warning' : 'success'} label={row.belowReorder ? 'Below reorder' : 'Available'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function Outstanding({ customers, vendors }) {
  return <Grid container spacing={2} sx={{ p: 2.5 }}><Grid size={{ xs: 12, md: 6 }}><PartyTable title="Customer Receivables" rows={customers.map((row) => ({ id: row.customerId, name: row.customerName, amount: row.totalReceivable }))} /></Grid><Grid size={{ xs: 12, md: 6 }}><PartyTable title="Vendor Payables" rows={vendors.map((row) => ({ id: row.vendorId, name: row.vendorName, amount: row.totalPayable }))} /></Grid></Grid>;
}

function PartyTable({ title, rows }) {
  return <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 1 }}>{title}</Typography><Table size="small"><TableHead><TableRow><TableCell>Party</TableCell><TableCell align="right">Outstanding</TableCell></TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.name}</TableCell><TableCell align="right">{money(row.amount)}</TableCell></TableRow>)}<TableRow><TableCell><strong>Total</strong></TableCell><TableCell align="right"><strong>{money(rows.reduce((sum, row) => sum + Number(row.amount), 0))}</strong></TableCell></TableRow></TableBody></Table></CardContent></Card>;
}

function GstSummary({ gst }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{[['Outward Taxable Value', gst.outwardTaxableValue], ['Output Tax', gst.outputTax], ['Inward Taxable Value', gst.inwardTaxableValue], ['Input Tax Credit', gst.inputTaxCredit]].map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{money(value)}</Typography></CardContent></Card></Grid>)}</Grid><Alert severity={Number(gst.netTaxPayable) > 0 ? 'warning' : 'success'}>Net GST payable: <strong>{money(gst.netTaxPayable)}</strong></Alert></Stack>;
}

function DayBook({ vouchers }) {
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Narration</TableCell><TableCell>Ledger Lines</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead><TableBody>{vouchers.map((voucher) => <TableRow key={voucher.id}><TableCell>{formatDate(voucher.voucherDate)}</TableCell><TableCell>{voucher.voucherNo}<br /><Typography variant="caption">{voucher.voucherType}</Typography></TableCell><TableCell>{voucher.narration || '-'}</TableCell><TableCell>{voucher.lines.map((line) => `${line.ledger.name} (${line.type})`).join(', ')}</TableCell><TableCell align="right">{money(voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0))}</TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}




