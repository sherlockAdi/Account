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
  const [loadedTabs, setLoadedTabs] = useState({});
  const [referenceLoaded, setReferenceLoaded] = useState(false);
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

  async function ensureReferenceData() {
    if (referenceLoaded && vendors.length && items.length && companies.length) return { vendorData: vendors, itemData: items, companyData: companies };
    const [vendorData, itemData, companyData] = await Promise.all([
      vendors.length ? Promise.resolve(vendors) : api('/purchase/vendors'),
      items.length ? Promise.resolve(items) : api('/inventory/items'),
      companies.length ? Promise.resolve(companies) : api('/companies')
    ]);
    setVendors(vendorData);
    setItems(itemData);
    setCompanies(companyData);
    setReferenceLoaded(true);
    return { vendorData, itemData, companyData };
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setError('');
      if (tabIndex === 0) setVendors(await api('/purchase/vendors'));
      if (tabIndex === 1 || tabIndex === 3) {
        await ensureReferenceData();
        setInvoices(await api('/purchase/invoices'));
      }
      if (tabIndex === 2) {
        await ensureReferenceData();
        setReturns(await api('/purchase/returns'));
      }
      if (tabIndex === 4) setOutstanding(await api('/purchase/reports/vendor-outstanding'));
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
    const { vendorData, itemData, companyData } = await ensureReferenceData();
    const freshWarehouses = companyData.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));
    setInvoiceForm({ vendorId: vendorData[0]?.id || '', warehouseId: freshWarehouses[0]?.id || '', invoiceNo: `PI-${Date.now().toString().slice(-5)}`, invoiceDate: todayIso(), supplierInvoiceNo: '', narration: '', lines: [{ itemId: itemData[0]?.id || '', quantity: 1, rate: Number(itemData[0]?.standardRate || 0) }] });
    setInvoiceOpen(true);
  }

  async function openReturnDialog() {
    const { vendorData, itemData, companyData } = await ensureReferenceData();
    const freshWarehouses = companyData.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));
    setReturnForm({ vendorId: vendorData[0]?.id || '', warehouseId: freshWarehouses[0]?.id || '', returnNo: `PR-${Date.now().toString().slice(-5)}`, returnDate: todayIso(), supplierReturnNo: '', narration: '', lines: [{ itemId: itemData[0]?.id || '', quantity: 1, rate: Number(itemData[0]?.standardRate || 0) }] });
    setReturnOpen(true);
  }

  function updateLine(index, key, value) {
    setInvoiceForm((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  function updateReturnLine(index, key, value) {
    setReturnForm((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  const statusOptions = [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }];
  const vendorOptions = useMemo(() => vendors.map((vendor) => ({ value: vendor.name, label: vendor.name })), [vendors]);
  const warehouseOptions = useMemo(
    () => Array.from(new Set(warehouses.map((warehouse) => warehouse.name))).map((name) => ({ value: name, label: name })),
    [warehouses]
  );

  const vendorRows = useMemo(
    () =>
      vendors.map((vendor) => ({
        ...vendor,
        vendor: `${vendor.name} ${vendor.code}`,
        ledgerName: vendor.ledger?.name || '-',
        statusText: vendor.isActive ? 'Active' : 'Inactive'
      })),
    [vendors]
  );

  const invoiceRows = useMemo(
    () =>
      invoices.map((invoice) => ({
        ...invoice,
        date: invoice.invoiceDate,
        vendorName: invoice.vendor?.name || '-',
        warehouseName: invoice.warehouse?.name || '-',
        itemText: invoice.lines?.map((line) => `${line.item?.name || '-'} ${Number(line.quantity).toFixed(3)} ${line.item?.unit?.code || ''}`).join(', ') || '-',
        total: Number(invoice.totalAmount || 0)
      })),
    [invoices]
  );

  const returnRows = useMemo(
    () =>
      returns.map((purchaseReturn) => ({
        ...purchaseReturn,
        date: purchaseReturn.returnDate,
        vendorName: purchaseReturn.vendor?.name || '-',
        warehouseName: purchaseReturn.warehouse?.name || '-',
        itemText: purchaseReturn.lines?.map((line) => `${line.item?.name || '-'} ${Number(line.quantity).toFixed(3)} ${line.item?.unit?.code || ''}`).join(', ') || '-',
        total: Number(purchaseReturn.totalAmount || 0)
      })),
    [returns]
  );

  const outstandingRows = useMemo(
    () => outstanding.map((row) => ({ ...row, id: row.vendorId, total: Number(row.totalPayable || 0) })),
    [outstanding]
  );

  const vendorColumns = useMemo(
    () => [
      { field: 'vendor', headerName: 'Vendor', flex: 1, minWidth: 210 },
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
      { field: 'supplierInvoiceNo', headerName: 'Supplier Invoice', flex: 0.8, minWidth: 160, valueGetter: (value) => value || '-' },
      { field: 'vendorName', headerName: 'Vendor', flex: 1, minWidth: 190 },
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
      { field: 'supplierReturnNo', headerName: 'Supplier Return', flex: 0.8, minWidth: 160, valueGetter: (value) => value || '-' },
      { field: 'vendorName', headerName: 'Vendor', flex: 1, minWidth: 190 },
      { field: 'warehouseName', headerName: 'Warehouse', flex: 1, minWidth: 180 },
      { field: 'itemText', headerName: 'Items', flex: 1.7, minWidth: 320 },
      { field: 'total', headerName: 'Total', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

  const outstandingColumns = useMemo(
    () => [
      { field: 'vendorName', headerName: 'Vendor', flex: 1, minWidth: 220 },
      { field: 'total', headerName: 'Total Payable', type: 'number', flex: 0.8, minWidth: 170, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

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
          {tab === 0 && <GridPanel label="Create Vendor" onCreate={() => setVendorOpen(true)}><CommonDataGrid title="Vendors" rows={vendorRows} columns={vendorColumns} fileName="purchase-vendors" searchPlaceholder="Search vendors" selectFilters={[{ field: 'statusText', label: 'Status', options: statusOptions }]} /></GridPanel>}
          {tab === 1 && <GridPanel label="Create Purchase Invoice" onCreate={openInvoiceDialog}><CommonDataGrid title="Purchase Invoices" rows={invoiceRows} columns={invoiceColumns} fileName="purchase-invoices" searchPlaceholder="Search invoices" dateField="date" selectFilters={[{ field: 'vendorName', label: 'Vendor', options: vendorOptions }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></GridPanel>}
          {tab === 2 && <GridPanel label="Create Purchase Return" onCreate={openReturnDialog}><CommonDataGrid title="Purchase Returns" rows={returnRows} columns={returnColumns} fileName="purchase-returns" searchPlaceholder="Search returns" dateField="date" selectFilters={[{ field: 'vendorName', label: 'Vendor', options: vendorOptions }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></GridPanel>}
          {tab === 3 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="Purchase Register" rows={invoiceRows} columns={invoiceColumns} fileName="purchase-register" searchPlaceholder="Search register" dateField="date" selectFilters={[{ field: 'vendorName', label: 'Vendor', options: vendorOptions }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></Box>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="Vendor Outstanding" rows={outstandingRows} columns={outstandingColumns} fileName="vendor-outstanding" searchPlaceholder="Search vendors" /></Box>}
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
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack>{children}</Stack>;
}

function SimpleDialog({ open, title, onClose, onSubmit, children }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><Box component="form" onSubmit={onSubmit}><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions></Box></Dialog>;
}




