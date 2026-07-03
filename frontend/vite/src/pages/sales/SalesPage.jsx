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
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';

import PlusOutlined from '@ant-design/icons/PlusOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
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
  const [loadedTabs, setLoadedTabs] = useState({});
  const [referenceLoaded, setReferenceLoaded] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', code: '', gstin: '', phone: '', email: '', state: '' });
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: '',
    warehouseId: '',
    invoiceNo: `SI-${Date.now().toString().slice(-5)}`,
    invoiceDate: todayIso(),
    narration: '',
    lines: [{ itemId: '', quantity: 1, rate: 0 }]
  });
  const [returnForm, setReturnForm] = useState({
    customerId: '',
    warehouseId: '',
    returnNo: `SR-${Date.now().toString().slice(-5)}`,
    returnDate: todayIso(),
    narration: '',
    lines: [{ itemId: '', quantity: 1, rate: 0 }]
  });

  const warehouses = companies.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));

  async function ensureReferenceData() {
    if (referenceLoaded && customers.length && items.length && companies.length) return { customerData: customers, itemData: items, companyData: companies };
    const [customerData, itemData, companyData] = await Promise.all([
      customers.length ? Promise.resolve(customers) : api('/sales/customers'),
      items.length ? Promise.resolve(items) : api('/inventory/items'),
      companies.length ? Promise.resolve(companies) : api('/companies')
    ]);
    setCustomers(customerData);
    setItems(itemData);
    setCompanies(companyData);
    setReferenceLoaded(true);
    return { customerData, itemData, companyData };
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setError('');
      if (tabIndex === 0) setCustomers(await api('/sales/customers'));
      if (tabIndex === 1 || tabIndex === 3) {
        await ensureReferenceData();
        setInvoices(await api('/sales/invoices'));
      }
      if (tabIndex === 2) {
        await ensureReferenceData();
        setReturns(await api('/sales/returns'));
      }
      if (tabIndex === 4) setOutstanding(await api('/sales/reports/customer-outstanding'));
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

  async function openInvoiceDialog() {
    const { customerData, itemData, companyData } = await ensureReferenceData();
    const freshWarehouses = companyData.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));
    setInvoiceForm({ customerId: customerData[0]?.id || '', warehouseId: freshWarehouses[0]?.id || '', invoiceNo: `SI-${Date.now().toString().slice(-5)}`, invoiceDate: todayIso(), narration: '', lines: [{ itemId: itemData[0]?.id || '', quantity: 1, rate: Number(itemData[0]?.standardRate || 0) }] });
    setInvoiceOpen(true);
  }

  async function openReturnDialog() {
    const { customerData, itemData, companyData } = await ensureReferenceData();
    const freshWarehouses = companyData.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));
    setReturnForm({ customerId: customerData[0]?.id || '', warehouseId: freshWarehouses[0]?.id || '', returnNo: `SR-${Date.now().toString().slice(-5)}`, returnDate: todayIso(), narration: '', lines: [{ itemId: itemData[0]?.id || '', quantity: 1, rate: Number(itemData[0]?.standardRate || 0) }] });
    setReturnOpen(true);
  }

  function updateLine(index, key, value) {
    setInvoiceForm((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  function updateReturnLine(index, key, value) {
    setReturnForm((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  const statusOptions = [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }];
  const customerOptions = useMemo(() => customers.map((customer) => ({ value: customer.name, label: customer.name })), [customers]);
  const warehouseOptions = useMemo(
    () => Array.from(new Set(warehouses.map((warehouse) => warehouse.name))).map((name) => ({ value: name, label: name })),
    [warehouses]
  );

  const customerRows = useMemo(
    () =>
      customers.map((customer) => ({
        ...customer,
        customer: `${customer.name} ${customer.code}`,
        ledgerName: customer.ledger?.name || '-',
        statusText: customer.isActive ? 'Active' : 'Inactive'
      })),
    [customers]
  );

  const invoiceRows = useMemo(
    () =>
      invoices.map((invoice) => ({
        ...invoice,
        date: invoice.invoiceDate,
        customerName: invoice.customer?.name || '-',
        warehouseName: invoice.warehouse?.name || '-',
        itemText: invoice.lines?.map((line) => `${line.item?.name || '-'} ${Number(line.quantity).toFixed(3)} ${line.item?.unit?.code || ''}`).join(', ') || '-',
        total: Number(invoice.totalAmount || 0)
      })),
    [invoices]
  );

  const returnRows = useMemo(
    () =>
      returns.map((salesReturn) => ({
        ...salesReturn,
        date: salesReturn.returnDate,
        customerName: salesReturn.customer?.name || '-',
        warehouseName: salesReturn.warehouse?.name || '-',
        itemText: salesReturn.lines?.map((line) => `${line.item?.name || '-'} ${Number(line.quantity).toFixed(3)} ${line.item?.unit?.code || ''}`).join(', ') || '-',
        total: Number(salesReturn.totalAmount || 0)
      })),
    [returns]
  );

  const outstandingRows = useMemo(
    () => outstanding.map((row) => ({ ...row, id: row.customerId, total: Number(row.totalReceivable || 0) })),
    [outstanding]
  );

  const customerColumns = useMemo(
    () => [
      { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 210 },
      { field: 'ledgerName', headerName: 'Ledger', flex: 1, minWidth: 190 },
      { field: 'gstin', headerName: 'GSTIN', flex: 0.8, minWidth: 150, valueGetter: (value) => value || '-' },
      { field: 'phone', headerName: 'Phone', flex: 0.8, minWidth: 140, valueGetter: (value) => value || '-' },
      { field: 'statusText', headerName: 'Status', flex: 0.6, minWidth: 120 }
    ],
    []
  );

  const invoiceColumns = useMemo(
    () => [
      { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
      { field: 'invoiceNo', headerName: 'Invoice', flex: 0.8, minWidth: 150 },
      { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 190 },
      { field: 'warehouseName', headerName: 'Warehouse', flex: 1, minWidth: 180 },
      { field: 'itemText', headerName: 'Items', flex: 1.7, minWidth: 320 },
      { field: 'total', headerName: 'Total', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

  const returnColumns = useMemo(
    () => [
      { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
      { field: 'returnNo', headerName: 'Return', flex: 0.8, minWidth: 150 },
      { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 190 },
      { field: 'warehouseName', headerName: 'Warehouse', flex: 1, minWidth: 180 },
      { field: 'itemText', headerName: 'Items', flex: 1.7, minWidth: 320 },
      { field: 'total', headerName: 'Total', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

  const outstandingColumns = useMemo(
    () => [
      { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 220 },
      { field: 'total', headerName: 'Total Receivable', type: 'number', flex: 0.8, minWidth: 170, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

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
          {tab === 0 && <GridPanel label="Create Customer" onCreate={() => setCustomerOpen(true)}><CommonDataGrid title="Customers" rows={customerRows} columns={customerColumns} fileName="sales-customers" searchPlaceholder="Search customers" selectFilters={[{ field: 'statusText', label: 'Status', options: statusOptions }]} /></GridPanel>}
          {tab === 1 && <GridPanel label="Create Sales Invoice" onCreate={openInvoiceDialog}><CommonDataGrid title="Sales Invoices" rows={invoiceRows} columns={invoiceColumns} fileName="sales-invoices" searchPlaceholder="Search invoices" dateField="date" selectFilters={[{ field: 'customerName', label: 'Customer', options: customerOptions }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></GridPanel>}
          {tab === 2 && <GridPanel label="Create Sales Return" onCreate={openReturnDialog}><CommonDataGrid title="Sales Returns" rows={returnRows} columns={returnColumns} fileName="sales-returns" searchPlaceholder="Search returns" dateField="date" selectFilters={[{ field: 'customerName', label: 'Customer', options: customerOptions }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></GridPanel>}
          {tab === 3 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="Sales Register" rows={invoiceRows} columns={invoiceColumns} fileName="sales-register" searchPlaceholder="Search register" dateField="date" selectFilters={[{ field: 'customerName', label: 'Customer', options: customerOptions }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></Box>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="Customer Outstanding" rows={outstandingRows} columns={outstandingColumns} fileName="customer-outstanding" searchPlaceholder="Search customers" /></Box>}
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
            <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Customer" value={invoiceForm.customerId} onChange={(event) => setInvoiceForm({ ...invoiceForm, customerId: event.target.value })}>{customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Warehouse" value={invoiceForm.warehouseId} onChange={(event) => setInvoiceForm({ ...invoiceForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Invoice No" value={invoiceForm.invoiceNo} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceNo: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 6 }}><DateField fullWidth label="Invoice Date" value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoiceDate: event.target.value })} /></Grid></Grid>
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
            <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Customer" value={returnForm.customerId} onChange={(event) => setReturnForm({ ...returnForm, customerId: event.target.value })}>{customers.map((customer) => <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Warehouse" value={returnForm.warehouseId} onChange={(event) => setReturnForm({ ...returnForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Return No" value={returnForm.returnNo} onChange={(event) => setReturnForm({ ...returnForm, returnNo: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 6 }}><DateField fullWidth label="Return Date" value={returnForm.returnDate} onChange={(event) => setReturnForm({ ...returnForm, returnDate: event.target.value })} /></Grid></Grid>
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
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack>{children}</Stack>;
}

function SimpleDialog({ open, title, onClose, onSubmit, children }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><Box component="form" onSubmit={onSubmit}><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions></Box></Dialog>;
}




