import { useEffect, useState } from 'react';

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

import PlusOutlined from '@ant-design/icons/PlusOutlined';

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

export default function PurchasePage() {
  const [tab, setTab] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [vendorOpen, setVendorOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: '', code: '', gstin: '', phone: '', email: '', state: '' });
  const [invoiceForm, setInvoiceForm] = useState({
    vendorId: '',
    warehouseId: '',
    invoiceNo: `PI-${Date.now().toString().slice(-5)}`,
    invoiceDate: todayIso(),
    supplierInvoiceNo: '',
    narration: '',
    lines: [{ itemId: '', quantity: 1, rate: 0 }]
  });
  const [returnForm, setReturnForm] = useState({
    vendorId: '',
    warehouseId: '',
    returnNo: `PR-${Date.now().toString().slice(-5)}`,
    returnDate: todayIso(),
    supplierReturnNo: '',
    narration: '',
    lines: [{ itemId: '', quantity: 1, rate: 0 }]
  });

  const warehouses = companies.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));

  async function loadData() {
    const [vendorData, invoiceData, returnData, itemData, companyData, outstandingData] = await Promise.all([
      api('/purchase/vendors'),
      api('/purchase/invoices'),
      api('/purchase/returns'),
      api('/inventory/items'),
      api('/companies'),
      api('/purchase/reports/vendor-outstanding')
    ]);
    setVendors(vendorData);
    setInvoices(invoiceData);
    setReturns(returnData);
    setItems(itemData);
    setCompanies(companyData);
    setOutstanding(outstandingData);
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, []);

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
    setInvoiceForm((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  function updateReturnLine(index, key, value) {
    setReturnForm((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => (error ? setError('') : setMessage(''))}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Vendors" />
            <Tab label="Purchase Invoices" />
            <Tab label="Purchase Returns" />
            <Tab label="Purchase Register" />
            <Tab label="Vendor Outstanding" />
          </Tabs>
          {tab === 0 && <GridPanel label="Create Vendor" onCreate={() => setVendorOpen(true)}><Table size="small"><TableHead><TableRow><TableCell>Vendor</TableCell><TableCell>Ledger</TableCell><TableCell>GSTIN</TableCell><TableCell>Phone</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{vendors.map((vendor) => <TableRow key={vendor.id}><TableCell>{vendor.name}<br />{vendor.code}</TableCell><TableCell>{vendor.ledger.name}</TableCell><TableCell>{vendor.gstin || '-'}</TableCell><TableCell>{vendor.phone || '-'}</TableCell><TableCell>{vendor.isActive ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></GridPanel>}
          {tab === 1 && <GridPanel label="Create Purchase Invoice" onCreate={() => { setInvoiceForm({ vendorId: vendors[0]?.id || '', warehouseId: warehouses[0]?.id || '', invoiceNo: `PI-${Date.now().toString().slice(-5)}`, invoiceDate: todayIso(), supplierInvoiceNo: '', narration: '', lines: [{ itemId: items[0]?.id || '', quantity: 1, rate: Number(items[0]?.standardRate || 0) }] }); setInvoiceOpen(true); }}><InvoiceTable invoices={invoices} /></GridPanel>}
          {tab === 2 && <GridPanel label="Create Purchase Return" onCreate={() => { setReturnForm({ vendorId: vendors[0]?.id || '', warehouseId: warehouses[0]?.id || '', returnNo: `PR-${Date.now().toString().slice(-5)}`, returnDate: todayIso(), supplierReturnNo: '', narration: '', lines: [{ itemId: items[0]?.id || '', quantity: 1, rate: Number(items[0]?.standardRate || 0) }] }); setReturnOpen(true); }}><ReturnTable returns={returns} /></GridPanel>}
          {tab === 3 && <Box sx={{ p: 2.5 }}><InvoiceTable invoices={invoices} /></Box>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Vendor</TableCell><TableCell align="right">Total Payable</TableCell></TableRow></TableHead><TableBody>{outstanding.map((row) => <TableRow key={row.vendorId}><TableCell>{row.vendorName}</TableCell><TableCell align="right">{row.totalPayable.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table></Box>}
        </Box>
      </Grid>

      <SimpleDialog open={vendorOpen} title="Create Vendor" onClose={() => setVendorOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api('/purchase/vendors', { method: 'POST', body: JSON.stringify(vendorForm) }), 'Vendor created', () => setVendorOpen(false)); }}>
        <TextField label="Name" value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} required />
        <TextField label="Code" value={vendorForm.code} onChange={(event) => setVendorForm({ ...vendorForm, code: event.target.value })} required />
        <TextField label="GSTIN" value={vendorForm.gstin} onChange={(event) => setVendorForm({ ...vendorForm, gstin: event.target.value })} />
        <TextField label="Phone" value={vendorForm.phone} onChange={(event) => setVendorForm({ ...vendorForm, phone: event.target.value })} />
        <TextField label="Email" value={vendorForm.email} onChange={(event) => setVendorForm({ ...vendorForm, email: event.target.value })} />
        <TextField label="State" value={vendorForm.state} onChange={(event) => setVendorForm({ ...vendorForm, state: event.target.value })} />
      </SimpleDialog>

      <Dialog open={invoiceOpen} onClose={() => setInvoiceOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/purchase/invoices', { method: 'POST', body: JSON.stringify({ ...invoiceForm, lines: invoiceForm.lines.map((line) => ({ ...line, quantity: Number(line.quantity), rate: Number(line.rate) })) }) }), 'Purchase invoice posted', () => setInvoiceOpen(false)); }}>
          <DialogTitle>Create Purchase Invoice</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Vendor" value={invoiceForm.vendorId} onChange={(event) => setInvoiceForm({ ...invoiceForm, vendorId: event.target.value })}>{vendors.map((vendor) => <MenuItem key={vendor.id} value={vendor.id}>{vendor.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Warehouse" value={invoiceForm.warehouseId} onChange={(event) => setInvoiceForm({ ...invoiceForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Invoice No" value={invoiceForm.invoiceNo} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceNo: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 4 }}><DateField fullWidth label="Invoice Date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Supplier Invoice No" value={invoiceForm.supplierInvoiceNo} onChange={(event) => setInvoiceForm({ ...invoiceForm, supplierInvoiceNo: event.target.value })} /></Grid></Grid>
            {invoiceForm.lines.map((line, index) => <Grid container spacing={2} key={index}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Item" value={line.itemId} onChange={(event) => updateLine(index, 'itemId', event.target.value)}>{items.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Qty" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Rate" value={line.rate} onChange={(event) => updateLine(index, 'rate', event.target.value)} /></Grid></Grid>)}
            <Button onClick={() => setInvoiceForm((current) => ({ ...current, lines: [...current.lines, { itemId: items[0]?.id || '', quantity: 1, rate: 0 }] }))}>Add Line</Button>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setInvoiceOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Post Invoice</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/purchase/returns', { method: 'POST', body: JSON.stringify({ ...returnForm, lines: returnForm.lines.map((line) => ({ ...line, quantity: Number(line.quantity), rate: Number(line.rate) })) }) }), 'Purchase return posted', () => setReturnOpen(false)); }}>
          <DialogTitle>Create Purchase Return</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Vendor" value={returnForm.vendorId} onChange={(event) => setReturnForm({ ...returnForm, vendorId: event.target.value })}>{vendors.map((vendor) => <MenuItem key={vendor.id} value={vendor.id}>{vendor.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Warehouse" value={returnForm.warehouseId} onChange={(event) => setReturnForm({ ...returnForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Return No" value={returnForm.returnNo} onChange={(event) => setReturnForm({ ...returnForm, returnNo: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 4 }}><DateField fullWidth label="Return Date" value={returnForm.returnDate} onChange={(event) => setReturnForm({ ...returnForm, returnDate: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Supplier Return No" value={returnForm.supplierReturnNo} onChange={(event) => setReturnForm({ ...returnForm, supplierReturnNo: event.target.value })} /></Grid></Grid>
            {returnForm.lines.map((line, index) => <Grid container spacing={2} key={index}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Item" value={line.itemId} onChange={(event) => updateReturnLine(index, 'itemId', event.target.value)}>{items.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Qty" value={line.quantity} onChange={(event) => updateReturnLine(index, 'quantity', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Rate" value={line.rate} onChange={(event) => updateReturnLine(index, 'rate', event.target.value)} /></Grid></Grid>)}
            <Button onClick={() => setReturnForm((current) => ({ ...current, lines: [...current.lines, { itemId: items[0]?.id || '', quantity: 1, rate: 0 }] }))}>Add Line</Button>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setReturnOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Post Return</Button></DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}

function GridPanel({ label, onCreate, children }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack><TableContainer>{children}</TableContainer></Stack>;
}

function InvoiceTable({ invoices }) {
  return <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Invoice</TableCell><TableCell>Vendor</TableCell><TableCell>Warehouse</TableCell><TableCell>Items</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead><TableBody>{invoices.map((invoice) => <TableRow key={invoice.id}><TableCell>{formatDate(invoice.invoiceDate)}</TableCell><TableCell>{invoice.invoiceNo}</TableCell><TableCell>{invoice.vendor.name}</TableCell><TableCell>{invoice.warehouse.name}</TableCell><TableCell>{invoice.lines.map((line) => `${line.item.name} ${Number(line.quantity).toFixed(3)} ${line.item.unit.code}`).join(', ')}</TableCell><TableCell align="right">{Number(invoice.totalAmount).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>;
}

function ReturnTable({ returns }) {
  return <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Return</TableCell><TableCell>Vendor</TableCell><TableCell>Warehouse</TableCell><TableCell>Items</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead><TableBody>{returns.map((purchaseReturn) => <TableRow key={purchaseReturn.id}><TableCell>{formatDate(purchaseReturn.returnDate)}</TableCell><TableCell>{purchaseReturn.returnNo}</TableCell><TableCell>{purchaseReturn.vendor.name}</TableCell><TableCell>{purchaseReturn.warehouse.name}</TableCell><TableCell>{purchaseReturn.lines.map((line) => `${line.item.name} ${Number(line.quantity).toFixed(3)} ${line.item.unit.code}`).join(', ')}</TableCell><TableCell align="right">{Number(purchaseReturn.totalAmount).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>;
}

function SimpleDialog({ open, title, onClose, onSubmit, children }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><Box component="form" onSubmit={onSubmit}><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions></Box></Dialog>;
}




