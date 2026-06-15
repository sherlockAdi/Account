import { useEffect, useState } from 'react';

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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';

import EditOutlined from '@ant-design/icons/EditOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

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

  async function loadData() {
    const [taxData, gstr1Data, gstr3bData, itcData, hsnData] = await Promise.all([
      api('/gst/tax-rates'),
      api('/gst/reports/gstr-1'),
      api('/gst/reports/gstr-3b'),
      api('/gst/reports/itc'),
      api('/gst/reports/hsn-summary')
    ]);
    setTaxRates(taxData);
    setGstr1(gstr1Data);
    setGstr3b(gstr3bData);
    setItc(itcData);
    setHsn(hsnData);
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, []);

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
      await loadData();
    } catch (saveError) {
      setError(saveError.message);
    }
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
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Tax Rates" />
            <Tab label="GSTR-1" />
            <Tab label="GSTR-3B" />
            <Tab label="ITC" />
            <Tab label="HSN Summary" />
          </Tabs>

          {tab === 0 && (
            <GridPanel label="Create Tax Rate" onCreate={openCreateTaxRate}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell align="right">Rate %</TableCell>
                    <TableCell align="right">CGST %</TableCell>
                    <TableCell align="right">SGST %</TableCell>
                    <TableCell align="right">IGST %</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {taxRates.map((taxRate) => (
                    <TableRow key={taxRate.id}>
                      <TableCell>{taxRate.name}</TableCell>
                      <TableCell>{taxRate.code}</TableCell>
                      <TableCell align="right">{formatAmount(taxRate.rate)}</TableCell>
                      <TableCell align="right">{formatAmount(taxRate.cgstRate)}</TableCell>
                      <TableCell align="right">{formatAmount(taxRate.sgstRate)}</TableCell>
                      <TableCell align="right">{formatAmount(taxRate.igstRate)}</TableCell>
                      <TableCell align="center">
                        <Button size="small" startIcon={<EditOutlined />} onClick={() => openEditTaxRate(taxRate)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </GridPanel>
          )}

          {tab === 1 && <Box sx={{ p: 2.5 }}><InvoiceTaxTable rows={gstr1.invoices} partyKey="customerName" partyLabel="Customer" /></Box>}
          {tab === 2 && <Box sx={{ p: 2.5 }}><Gstr3bTable summary={gstr3b} /></Box>}
          {tab === 3 && <Box sx={{ p: 2.5 }}><InvoiceTaxTable rows={itc.invoices} partyKey="vendorName" partyLabel="Vendor" /></Box>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><HsnSummary hsn={hsn} /></Box>}
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
      <TableContainer>{children}</TableContainer>
    </Stack>
  );
}

function InvoiceTaxTable({ rows, partyKey, partyLabel }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Invoice</TableCell>
          <TableCell>{partyLabel}</TableCell>
          <TableCell align="right">Taxable</TableCell>
          <TableCell align="right">Tax</TableCell>
          <TableCell align="right">Total</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.invoiceDate ? formatDate(row.invoiceDate) : ''}</TableCell>
            <TableCell>{row.invoiceNo}</TableCell>
            <TableCell>{row[partyKey]}</TableCell>
            <TableCell align="right">{formatAmount(row.taxableValue)}</TableCell>
            <TableCell align="right">{formatAmount(row.taxAmount)}</TableCell>
            <TableCell align="right">{formatAmount(row.totalAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Gstr3bTable({ summary }) {
  const rows = [
    ['Outward taxable value', summary.outwardTaxableValue],
    ['Output tax', summary.outputTax],
    ['Inward taxable value', summary.inwardTaxableValue],
    ['Input tax credit', summary.inputTaxCredit],
    ['Net tax payable', summary.netTaxPayable]
  ];
  return (
    <Table size="small">
      <TableHead><TableRow><TableCell>Particular</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
      <TableBody>{rows.map(([label, amount]) => <TableRow key={label}><TableCell>{label}</TableCell><TableCell align="right">{formatAmount(amount)}</TableCell></TableRow>)}</TableBody>
    </Table>
  );
}

function HsnSummary({ hsn }) {
  return (
    <Stack spacing={3}>
      <HsnTable title="Sales HSN" rows={hsn.sales || []} />
      <HsnTable title="Purchase HSN" rows={hsn.purchases || []} />
    </Stack>
  );
}

function HsnTable({ title, rows }) {
  return (
    <Stack spacing={1.5}>
      <Box sx={{ fontWeight: 600 }}>{title}</Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>HSN/SAC</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell align="right">Taxable</TableCell>
            <TableCell align="right">Tax</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.hsnSac}>
              <TableCell>{row.hsnSac}</TableCell>
              <TableCell align="right">{formatAmount(row.quantity)}</TableCell>
              <TableCell align="right">{formatAmount(row.taxableValue)}</TableCell>
              <TableCell align="right">{formatAmount(row.taxAmount)}</TableCell>
              <TableCell align="right">{formatAmount(row.totalAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}


