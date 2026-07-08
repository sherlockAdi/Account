import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';

import EditOutlined from '@ant-design/icons/EditOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import { formatDate } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const emptyTaxForm = { id: '', name: '', code: '', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18 };

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

export default function GstPage() {
  const [tab, setTab] = useState(0);
  const [taxRates, setTaxRates] = useState([]);
  const [gstr1, setGstr1] = useState({ invoices: [], summary: {} });
  const [gstr3b, setGstr3b] = useState({});
  const [itc, setItc] = useState({ invoices: [], summary: {} });
  const [hsn, setHsn] = useState({ sales: [], purchases: [] });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxForm, setTaxForm] = useState(emptyTaxForm);
  const [loadedTabs, setLoadedTabs] = useState({});

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setError('');
      if (tabIndex === 0) setTaxRates(await api('/gst/tax-rates'));
      if (tabIndex === 1) setGstr1(await api('/gst/reports/gstr-1'));
      if (tabIndex === 2) setGstr3b(await api('/gst/reports/gstr-3b'));
      if (tabIndex === 3) setItc(await api('/gst/reports/itc'));
      if (tabIndex === 4) setHsn(await api('/gst/reports/hsn-summary'));
      setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadTabData(tab);
  }, [tab]);

  function openCreateTaxRate() {
    setTaxForm(emptyTaxForm);
    setTaxOpen(true);
  }

  function openEditTaxRate(taxRate) {
    setTaxForm({
      id: taxRate.id,
      name: taxRate.name,
      code: taxRate.code,
      rate: Number(taxRate.rate),
      cgstRate: Number(taxRate.cgstRate),
      sgstRate: Number(taxRate.sgstRate),
      igstRate: Number(taxRate.igstRate)
    });
    setTaxOpen(true);
  }

  async function saveTaxRate(event) {
    event.preventDefault();
    try {
      setError('');
      setMessage('');
      const payload = {
        name: taxForm.name,
        code: taxForm.code,
        rate: Number(taxForm.rate),
        cgstRate: Number(taxForm.cgstRate),
        sgstRate: Number(taxForm.sgstRate),
        igstRate: Number(taxForm.igstRate)
      };
      await api(taxForm.id ? `/gst/tax-rates/${taxForm.id}` : '/gst/tax-rates', {
        method: taxForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      setTaxOpen(false);
      setMessage(taxForm.id ? 'Tax rate updated' : 'Tax rate created');
      await loadTabData(0, true);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  const taxRateRows = useMemo(
    () =>
      taxRates.map((taxRate) => ({
        ...taxRate,
        rateAmount: Number(taxRate.rate || 0),
        cgstAmount: Number(taxRate.cgstRate || 0),
        sgstAmount: Number(taxRate.sgstRate || 0),
        igstAmount: Number(taxRate.igstRate || 0)
      })),
    [taxRates]
  );

  const taxInvoiceRows = (rows, partyKey) =>
    rows.map((row) => ({
      ...row,
      date: row.invoiceDate,
      partyName: row[partyKey] || '-',
      taxable: Number(row.taxableValue || 0),
      tax: Number(row.taxAmount || 0),
      total: Number(row.totalAmount || 0)
    }));

  const gstr1Rows = useMemo(() => taxInvoiceRows(gstr1.invoices || [], 'customerName'), [gstr1.invoices]);
  const itcRows = useMemo(() => taxInvoiceRows(itc.invoices || [], 'vendorName'), [itc.invoices]);
  const gstr3bRows = useMemo(
    () => [
      { id: 'outward', particular: 'Outward taxable value', amount: Number(gstr3b.outwardTaxableValue || 0) },
      { id: 'output', particular: 'Output tax', amount: Number(gstr3b.outputTax || 0) },
      { id: 'inward', particular: 'Inward taxable value', amount: Number(gstr3b.inwardTaxableValue || 0) },
      { id: 'input', particular: 'Input tax credit', amount: Number(gstr3b.inputTaxCredit || 0) },
      { id: 'net', particular: 'Net tax payable', amount: Number(gstr3b.netTaxPayable || 0) }
    ],
    [gstr3b]
  );
  const salesHsnRows = useMemo(() => (hsn.sales || []).map((row) => ({ ...row, id: `sales-${row.hsnSac}`, type: 'Sales', quantityAmount: Number(row.quantity || 0), taxable: Number(row.taxableValue || 0), tax: Number(row.taxAmount || 0), total: Number(row.totalAmount || 0) })), [hsn.sales]);
  const purchaseHsnRows = useMemo(() => (hsn.purchases || []).map((row) => ({ ...row, id: `purchase-${row.hsnSac}`, type: 'Purchase', quantityAmount: Number(row.quantity || 0), taxable: Number(row.taxableValue || 0), tax: Number(row.taxAmount || 0), total: Number(row.totalAmount || 0) })), [hsn.purchases]);

  const taxRateColumns = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
      { field: 'code', headerName: 'Code', flex: 0.7, minWidth: 120 },
      { field: 'rateAmount', headerName: 'Rate %', type: 'number', flex: 0.7, minWidth: 120, valueFormatter: (value) => formatAmount(value) },
      { field: 'cgstAmount', headerName: 'CGST %', type: 'number', flex: 0.7, minWidth: 120, valueFormatter: (value) => formatAmount(value) },
      { field: 'sgstAmount', headerName: 'SGST %', type: 'number', flex: 0.7, minWidth: 120, valueFormatter: (value) => formatAmount(value) },
      { field: 'igstAmount', headerName: 'IGST %', type: 'number', flex: 0.7, minWidth: 120, valueFormatter: (value) => formatAmount(value) },
      { field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 0.7, minWidth: 120, renderCell: (params) => <Button size="small" startIcon={<EditOutlined />} onClick={() => openEditTaxRate(params.row)}>Edit</Button> }
    ],
    []
  );

  const invoiceTaxColumns = (partyLabel) => [
    { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => (value ? formatDate(value) : '') },
    { field: 'invoiceNo', headerName: 'Invoice', flex: 0.8, minWidth: 150 },
    { field: 'partyName', headerName: partyLabel, flex: 1, minWidth: 190 },
    { field: 'taxable', headerName: 'Taxable', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatAmount(value) },
    { field: 'tax', headerName: 'Tax', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatAmount(value) },
    { field: 'total', headerName: 'Total', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatAmount(value) }
  ];

  const gstr3bColumns = useMemo(
    () => [
      { field: 'particular', headerName: 'Particular', flex: 1, minWidth: 240 },
      { field: 'amount', headerName: 'Amount', type: 'number', flex: 0.8, minWidth: 150, valueFormatter: (value) => formatAmount(value) }
    ],
    []
  );

  const hsnColumns = useMemo(
    () => [
      { field: 'type', headerName: 'Type', flex: 0.6, minWidth: 120 },
      { field: 'hsnSac', headerName: 'HSN/SAC', flex: 0.8, minWidth: 140 },
      { field: 'quantityAmount', headerName: 'Quantity', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => formatAmount(value) },
      { field: 'taxable', headerName: 'Taxable', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => formatAmount(value) },
      { field: 'tax', headerName: 'Tax', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => formatAmount(value) },
      { field: 'total', headerName: 'Total', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => formatAmount(value) }
    ],
    []
  );

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
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Tax Rates" />
            <Tab label="GSTR-1" />
            <Tab label="GSTR-3B" />
            <Tab label="ITC" />
            <Tab label="HSN Summary" />
          </Tabs>

          {tab === 0 && (
            <GridPanel label="Create Tax Rate" onCreate={openCreateTaxRate}>
              <CommonDataGrid title="Tax Rates" rows={taxRateRows} columns={taxRateColumns} fileName="gst-tax-rates" searchPlaceholder="Search tax rates" />
            </GridPanel>
          )}

          {tab === 1 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="GSTR-1" rows={gstr1Rows} columns={invoiceTaxColumns('Customer')} fileName="gstr-1" searchPlaceholder="Search invoices" dateField="date" /></Box>}
          {tab === 2 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="GSTR-3B" rows={gstr3bRows} columns={gstr3bColumns} fileName="gstr-3b" searchPlaceholder="Search particulars" /></Box>}
          {tab === 3 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="ITC" rows={itcRows} columns={invoiceTaxColumns('Vendor')} fileName="itc" searchPlaceholder="Search invoices" dateField="date" /></Box>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="HSN Summary" rows={[...salesHsnRows, ...purchaseHsnRows]} columns={hsnColumns} fileName="hsn-summary" searchPlaceholder="Search HSN" selectFilters={[{ field: 'type', label: 'Type', options: [{ value: 'Sales', label: 'Sales' }, { value: 'Purchase', label: 'Purchase' }] }]} /></Box>}
        </Box>
      </Grid>

      <Dialog open={taxOpen} onClose={() => setTaxOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveTaxRate}>
          <DialogTitle>{taxForm.id ? 'Update Tax Rate' : 'Create Tax Rate'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={taxForm.name} onChange={(event) => setTaxForm({ ...taxForm, name: event.target.value })} required />
              <TextField label="Code" value={taxForm.code} onChange={(event) => setTaxForm({ ...taxForm, code: event.target.value })} required />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="Rate %" value={taxForm.rate} onChange={(event) => setTaxForm({ ...taxForm, rate: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="IGST %" value={taxForm.igstRate} onChange={(event) => setTaxForm({ ...taxForm, igstRate: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="CGST %" value={taxForm.cgstRate} onChange={(event) => setTaxForm({ ...taxForm, cgstRate: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth type="number" label="SGST %" value={taxForm.sgstRate} onChange={(event) => setTaxForm({ ...taxForm, sgstRate: event.target.value })} /></Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTaxOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}

function GridPanel({ label, onCreate, children }) {
  return (
    <Stack spacing={2.5} sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button>
      </Stack>
      {children}
    </Stack>
  );
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}


