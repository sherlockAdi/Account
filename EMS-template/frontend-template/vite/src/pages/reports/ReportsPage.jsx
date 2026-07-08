import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
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
  const [loadedTabs, setLoadedTabs] = useState({});

  const query = useMemo(() => `from=${filters.from}&to=${filters.to}`, [filters]);

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setLoading(true);
      setError('');
      if (tabIndex === 0) setDashboard(await api(`/reports/dashboard?${query}`));
      if (tabIndex === 1) setProfitLoss(await api(`/reports/profit-loss?${query}`));
      if (tabIndex === 2) setBalanceSheet(await api(`/reports/balance-sheet?${query}`));
      if (tabIndex === 3) setTrialBalance(await api(`/accounting/reports/trial-balance?${query}`));
      if (tabIndex === 4) setStock(await api('/inventory/reports/stock-summary'));
      if (tabIndex === 5) {
        const [customerData, vendorData] = await Promise.all([
          api('/sales/reports/customer-outstanding'),
          api('/purchase/reports/vendor-outstanding')
        ]);
        setCustomers(customerData);
        setVendors(vendorData);
      }
      if (tabIndex === 6) setGst(await api(`/gst/reports/gstr-3b?${query}`));
      if (tabIndex === 7) setDayBook(await api(`/accounting/reports/day-book?${query}`));
      setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTabData(tab); }, [tab]);

  function applyCurrentReport() {
    setLoadedTabs((current) => ({ ...current, [tab]: false }));
    loadTabData(tab, true);
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
            <Button variant="contained" startIcon={<ReloadOutlined />} onClick={applyCurrentReport} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</Button>
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
  const gridRows = [...rows.map((row) => ({ ...row, amountValue: Number(row.amount || 0) })), { ledgerId: `${title}-total`, ledgerName: `Total ${title}`, groupName: '', amountValue: Number(total || 0) }];
  const columns = [
    { field: 'ledgerName', headerName: 'Ledger', flex: 1, minWidth: 220 },
    { field: 'groupName', headerName: 'Group', flex: 1, minWidth: 180 },
    { field: 'amountValue', headerName: 'Amount', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => money(value) }
  ];
  return <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 1 }}>{title}</Typography><CommonDataGrid title={title} rows={gridRows} columns={columns} fileName={title.toLowerCase().replaceAll(' ', '-')} searchPlaceholder={`Search ${title}`} height={380} selectFilters={[{ field: 'groupName', label: 'Group', options: Array.from(new Set(rows.map((row) => row.groupName).filter(Boolean))).map((group) => ({ value: group, label: group })) }]} /></CardContent></Card>;
}

function TrialBalance({ rows }) {
  const debit = rows.reduce((sum, row) => sum + Number(row.debit), 0);
  const credit = rows.reduce((sum, row) => sum + Number(row.credit), 0);
  const gridRows = [...rows.filter((row) => row.debit || row.credit).map((row) => ({ ...row, debitValue: Number(row.debit || 0), creditValue: Number(row.credit || 0) })), { ledgerId: 'total', ledgerName: 'Total', groupName: '', debitValue: debit, creditValue: credit }];
  const columns = [
    { field: 'ledgerName', headerName: 'Ledger', flex: 1, minWidth: 220 },
    { field: 'groupName', headerName: 'Group', flex: 1, minWidth: 180 },
    { field: 'debitValue', headerName: 'Debit', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => (value ? money(value) : '-') },
    { field: 'creditValue', headerName: 'Credit', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => (value ? money(value) : '-') }
  ];
  return <Box sx={{ p: 2.5 }}><CommonDataGrid title="Trial Balance" rows={gridRows} columns={columns} fileName="trial-balance" searchPlaceholder="Search ledgers" selectFilters={[{ field: 'groupName', label: 'Group', options: Array.from(new Set(rows.map((row) => row.groupName).filter(Boolean))).map((group) => ({ value: group, label: group })) }]} /></Box>;
}

function StockSummary({ rows }) {
  const gridRows = rows.map((row) => ({ ...row, id: row.itemId, itemText: `${row.itemName} ${row.itemCode}`, quantityValue: Number(row.quantity || 0), valueAmount: Number(row.value || 0), statusText: row.belowReorder ? 'Below reorder' : 'Available' }));
  const columns = [
    { field: 'itemText', headerName: 'Item', flex: 1, minWidth: 220 },
    { field: 'groupName', headerName: 'Group', flex: 0.9, minWidth: 180 },
    { field: 'unit', headerName: 'Unit', flex: 0.5, minWidth: 100 },
    { field: 'quantityValue', headerName: 'Quantity', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(3) },
    { field: 'valueAmount', headerName: 'Value', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => money(value) },
    { field: 'statusText', headerName: 'Status', flex: 0.8, minWidth: 150 }
  ];
  return <Box sx={{ p: 2.5 }}><CommonDataGrid title="Stock Summary" rows={gridRows} columns={columns} fileName="stock-summary" searchPlaceholder="Search stock" selectFilters={[{ field: 'groupName', label: 'Group', options: Array.from(new Set(gridRows.map((row) => row.groupName).filter(Boolean))).map((group) => ({ value: group, label: group })) }, { field: 'statusText', label: 'Status', options: [{ value: 'Available', label: 'Available' }, { value: 'Below reorder', label: 'Below reorder' }] }]} /></Box>;
}

function Outstanding({ customers, vendors }) {
  return <Grid container spacing={2} sx={{ p: 2.5 }}><Grid size={{ xs: 12, md: 6 }}><PartyTable title="Customer Receivables" rows={customers.map((row) => ({ id: row.customerId, name: row.customerName, amount: row.totalReceivable }))} /></Grid><Grid size={{ xs: 12, md: 6 }}><PartyTable title="Vendor Payables" rows={vendors.map((row) => ({ id: row.vendorId, name: row.vendorName, amount: row.totalPayable }))} /></Grid></Grid>;
}

function PartyTable({ title, rows }) {
  const gridRows = [...rows.map((row) => ({ ...row, amountValue: Number(row.amount || 0) })), { id: `${title}-total`, name: 'Total', amountValue: rows.reduce((sum, row) => sum + Number(row.amount), 0) }];
  const columns = [
    { field: 'name', headerName: 'Party', flex: 1, minWidth: 220 },
    { field: 'amountValue', headerName: 'Outstanding', type: 'number', flex: 0.8, minWidth: 160, valueFormatter: (value) => money(value) }
  ];
  return <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 1 }}>{title}</Typography><CommonDataGrid title={title} rows={gridRows} columns={columns} fileName={title.toLowerCase().replaceAll(' ', '-')} searchPlaceholder={`Search ${title}`} height={360} /></CardContent></Card>;
}

function GstSummary({ gst }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{[['Outward Taxable Value', gst.outwardTaxableValue], ['Output Tax', gst.outputTax], ['Inward Taxable Value', gst.inwardTaxableValue], ['Input Tax Credit', gst.inputTaxCredit]].map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{money(value)}</Typography></CardContent></Card></Grid>)}</Grid><Alert severity={Number(gst.netTaxPayable) > 0 ? 'warning' : 'success'}>Net GST payable: <strong>{money(gst.netTaxPayable)}</strong></Alert></Stack>;
}

function DayBook({ vouchers }) {
  const rows = vouchers.map((voucher) => ({ ...voucher, date: voucher.voucherDate, voucherText: `${voucher.voucherNo} ${voucher.voucherType}`, lineText: voucher.lines.map((line) => `${line.ledger.name} (${line.type})`).join(', '), amount: voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0) }));
  const columns = [
    { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
    { field: 'voucherText', headerName: 'Voucher', flex: 0.8, minWidth: 170 },
    { field: 'narration', headerName: 'Narration', flex: 1, minWidth: 220, valueGetter: (value) => value || '-' },
    { field: 'lineText', headerName: 'Ledger Lines', flex: 1.6, minWidth: 320 },
    { field: 'amount', headerName: 'Amount', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => money(value) }
  ];
  return <Box sx={{ p: 2.5 }}><CommonDataGrid title="Day Book" rows={rows} columns={columns} fileName="day-book" searchPlaceholder="Search day book" dateField="date" selectFilters={[{ field: 'voucherType', label: 'Voucher Type', options: Array.from(new Set(rows.map((row) => row.voucherType))).map((type) => ({ value: type, label: type })) }]} /></Box>;
}




