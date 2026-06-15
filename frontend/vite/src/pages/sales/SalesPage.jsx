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

export default function SalesPage() {
  const [tab, setTab] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', code: '', gstin: '', phone: '', email: '', state: '' });
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: '',
    warehouseId: '',
    invoiceNo: `SI-${Date.now().toString().slice(-5)}`,
    invoiceDate: new Date().toISOString().slice(0, 10),
    narration: '',
    lines: [{ itemId: '', quantity: 1, rate: 0 }]
  });
  const [returnForm, setReturnForm] = useState({
    customerId: '',
    warehouseId: '',
    returnNo: `SR-${Date.now().toString().slice(-5)}`,
    returnDate: new Date().toISOString().slice(0, 10),
    narration: '',
    lines: [{ itemId: '', quantity: 1, rate: 0 }]
  });

  const warehouses = companies.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));

  async function loadData() {
    const [customerData, invoiceData, returnData, itemData, companyData, outstandingData] = await Promise.all([
      api('/sales/customers'),
      api('/sales/invoices'),
      api('/sales/returns'),
      api('/inventory/items'),
      api('/companies'),
      api('/sales/reports/customer-outstanding')
    ]);
    setCustomers(customerData);
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
            <Tab label="Customers" />
            <Tab label="Sales Invoices" />
            <Tab label="Sales Returns" />
            <Tab label="Sales Register" />
            <Tab label="Customer Outstanding" />
          </Tabs>
          {tab === 0 && <GridPanel label="Create Customer" onCreate={() => setCustomerOpen(true)}><Table size="small"><TableHead><TableRow><TableCell>Customer</TableCell><TableCell>Ledger</TableCell><TableCell>GSTIN</TableCell><TableCell>Phone</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{customers.map((customer) => <TableRow key={customer.id}><TableCell>{customer.name}<br />{customer.code}</TableCell><TableCell>{customer.ledger.name}</TableCell><TableCell>{customer.gstin || '-'}</TableCell><TableCell>{customer.phone || '-'}</TableCell><TableCell>{customer.isActive ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></GridPanel>}
          {tab === 1 && <GridPanel label="Create Sales Invoice" onCreate={() => { setInvoiceForm({ customerId: customers[0]?.id || '', warehouseId: warehouses[0]?.id || '', invoiceNo: `SI-${Date.now().toString().slice(-5)}`, invoiceDate: new Date().toISOString().slice(0, 10), narration: '', lines: [{ itemId: items[0]?.id || '', quantity: 1, rate: Number(items[0]?.standardRate || 0) }] }); setInvoiceOpen(true); }}><InvoiceTable invoices={invoices} /></GridPanel>}
          {tab === 2 && <GridPanel label="Create Sales Return" onCreate={() => { setReturnForm({ customerId: customers[0]?.id || '', warehouseId: warehouses[0]?.id || '', returnNo: `SR-${Date.now().toString().slice(-5)}`, returnDate: new Date().toISOString().slice(0, 10), narration: '', lines: [{ itemId: items[0]?.id || '', quantity: 1, rate: Number(items[0]?.standardRate || 0) }] }); setReturnOpen(true); }}><ReturnTable returns={returns} /></GridPanel>}
          {tab === 3 && <Box sx={{ p: 2.5 }}><InvoiceTable invoices={invoices} /></Box>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Customer</TableCell><TableCell align="right">Total Receivable</TableCell></TableRow></TableHead><TableBody>{outstanding.map((row) => <TableRow key={row.customerId}><TableCell>{row.customerName}</TableCell><TableCell align="right">{row.totalReceivable.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table></Box>}
        </Box>
      </Grid>

      <SimpleDialog open={customerOpen} title="Create Customer" onClose={() => setCustomerOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api('/sales/customers', { method: 'POST', body: JSON.stringify(customerForm) }), 'Customer created', () => setCustomerOpen(false)); }}>
        <TextField label="Name" value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} required />
        <TextField label="Code" value={customerForm.code} onChange={(event) => setCustomerForm({ ...customerForm, code: event.target.value })} required />
        <TextField label="GSTIN" value={customerForm.gstin} onChange={(event) => setCustomerForm({ ...customerForm, gstin: event.target.value })} />
        <TextField label="Phone" value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} />
        <TextField label="Email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} />
        <TextField label="State" value={customerForm.state} onChange={(event) => setCustomerForm({ ...customerForm, state: event.target.value })} />
      </SimpleDialog>

      <Dialog open={invoiceOpen} onClose={() => setInvoiceOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/sales/invoices', { method: 'POST', body: JSON.stringify({ ...invoiceForm, lines: invoiceForm.lines.map((line) => ({ ...line, quantity: Number(line.quantity), rate: Number(line.rate) })) }) }), 'Sales invoice posted', () => setInvoiceOpen(false)); }}>
          <DialogTitle>Create Sales Invoice</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Customer" value={invoiceForm.customerId} onChange={(event) => setInvoiceForm({ ...invoiceForm, customerId: event.target.value })}>{customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Warehouse" value={invoiceForm.warehouseId} onChange={(event) => setInvoiceForm({ ...invoiceForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Invoice No" value={invoiceForm.invoiceNo} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceNo: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="date" label="Invoice Date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })} InputLabelProps={{ shrink: true }} /></Grid></Grid>
            {invoiceForm.lines.map((line, index) => <Grid container spacing={2} key={index}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Item" value={line.itemId} onChange={(event) => updateLine(index, 'itemId', event.target.value)}>{items.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Qty" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Rate" value={line.rate} onChange={(event) => updateLine(index, 'rate', event.target.value)} /></Grid></Grid>)}
            <Button onClick={() => setInvoiceForm((current) => ({ ...current, lines: [...current.lines, { itemId: items[0]?.id || '', quantity: 1, rate: 0 }] }))}>Add Line</Button>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setInvoiceOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Post Invoice</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/sales/returns', { method: 'POST', body: JSON.stringify({ ...returnForm, lines: returnForm.lines.map((line) => ({ ...line, quantity: Number(line.quantity), rate: Number(line.rate) })) }) }), 'Sales return posted', () => setReturnOpen(false)); }}>
          <DialogTitle>Create Sales Return</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Customer" value={returnForm.customerId} onChange={(event) => setReturnForm({ ...returnForm, customerId: event.target.value })}>{customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Warehouse" value={returnForm.warehouseId} onChange={(event) => setReturnForm({ ...returnForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Return No" value={returnForm.returnNo} onChange={(event) => setReturnForm({ ...returnForm, returnNo: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="date" label="Return Date" value={returnForm.returnDate} onChange={(event) => setReturnForm({ ...returnForm, returnDate: event.target.value })} InputLabelProps={{ shrink: true }} /></Grid></Grid>
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
  return <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Invoice</TableCell><TableCell>Customer</TableCell><TableCell>Warehouse</TableCell><TableCell>Items</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead><TableBody>{invoices.map((invoice) => <TableRow key={invoice.id}><TableCell>{invoice.invoiceDate.slice(0, 10)}</TableCell><TableCell>{invoice.invoiceNo}</TableCell><TableCell>{invoice.customer.name}</TableCell><TableCell>{invoice.warehouse.name}</TableCell><TableCell>{invoice.lines.map((line) => `${line.item.name} ${Number(line.quantity).toFixed(3)} ${line.item.unit.code}`).join(', ')}</TableCell><TableCell align="right">{Number(invoice.totalAmount).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>;
}

function ReturnTable({ returns }) {
  return <Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Return</TableCell><TableCell>Customer</TableCell><TableCell>Warehouse</TableCell><TableCell>Items</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead><TableBody>{returns.map((salesReturn) => <TableRow key={salesReturn.id}><TableCell>{salesReturn.returnDate.slice(0, 10)}</TableCell><TableCell>{salesReturn.returnNo}</TableCell><TableCell>{salesReturn.customer.name}</TableCell><TableCell>{salesReturn.warehouse.name}</TableCell><TableCell>{salesReturn.lines.map((line) => `${line.item.name} ${Number(line.quantity).toFixed(3)} ${line.item.unit.code}`).join(', ')}</TableCell><TableCell align="right">{Number(salesReturn.totalAmount).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>;
}

function SimpleDialog({ open, title, onClose, onSubmit, children }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><Box component="form" onSubmit={onSubmit}><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions></Box></Dialog>;
}
