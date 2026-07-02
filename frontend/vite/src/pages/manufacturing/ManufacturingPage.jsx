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
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => todayIso();

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

export default function ManufacturingPage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({ recentEntries: [] });
  const [boms, setBoms] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [requirements, setRequirements] = useState(null);
  const [bomOpen, setBomOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadedTabs, setLoadedTabs] = useState({});
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [bomForm, setBomForm] = useState({
    name: '',
    code: '',
    finishedItemId: '',
    version: 1,
    outputQuantity: 1,
    effectiveFrom: today(),
    effectiveTo: '',
    notes: '',
    components: [{ itemId: '', quantity: 1, wastagePercent: 0 }]
  });
  const [orderForm, setOrderForm] = useState({
    bomId: '',
    warehouseId: '',
    orderNo: `MO-${Date.now().toString().slice(-6)}`,
    orderDate: today(),
    plannedStartDate: today(),
    plannedEndDate: '',
    plannedQuantity: 1,
    notes: ''
  });
  const [completeForm, setCompleteForm] = useState({
    entryNo: `PE-${Date.now().toString().slice(-6)}`,
    productionDate: today(),
    quantity: 1,
    notes: ''
  });

  const warehouses = useMemo(
    () =>
      companies.flatMap((company) =>
        company.branches.flatMap((branch) =>
          branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))
        )
      ),
    [companies]
  );
  const entries = useMemo(
    () => orders.flatMap((order) => order.entries.map((entry) => ({ ...entry, order }))),
    [orders]
  );

  async function ensureItems() {
    if (itemsLoaded && items.length) return items;
    const itemData = await api('/inventory/items');
    setItems(itemData);
    setItemsLoaded(true);
    return itemData;
  }

  async function ensureCompanies() {
    if (companiesLoaded && companies.length) return companies;
    const companyData = await api('/companies');
    setCompanies(companyData);
    setCompaniesLoaded(true);
    return companyData;
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setError('');
      if (tabIndex === 0) {
        const [dashboardData, orderData] = await Promise.all([
          api('/manufacturing/dashboard'),
          api('/manufacturing/orders')
        ]);
        setDashboard(dashboardData);
        setOrders(orderData);
      }
      if (tabIndex === 1) setBoms(await api('/manufacturing/boms'));
      if (tabIndex === 2 || tabIndex === 3) setOrders(await api('/manufacturing/orders'));
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

  async function openBom() {
    const itemData = await ensureItems();
    setBomForm({
      name: '',
      code: '',
      finishedItemId: itemData[0]?.id || '',
      version: 1,
      outputQuantity: 1,
      effectiveFrom: today(),
      effectiveTo: '',
      notes: '',
      components: [{ itemId: itemData[1]?.id || itemData[0]?.id || '', quantity: 1, wastagePercent: 0 }]
    });
    setBomOpen(true);
  }

  async function openOrder() {
    const [bomData, companyData] = await Promise.all([
      boms.length ? Promise.resolve(boms) : api('/manufacturing/boms'),
      ensureCompanies()
    ]);
    if (!boms.length) setBoms(bomData);
    const freshWarehouses = companyData.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));
    setOrderForm({
      bomId: bomData[0]?.id || '',
      warehouseId: freshWarehouses[0]?.id || '',
      orderNo: `MO-${Date.now().toString().slice(-6)}`,
      orderDate: today(),
      plannedStartDate: today(),
      plannedEndDate: '',
      plannedQuantity: 1,
      notes: ''
    });
    setOrderOpen(true);
  }

  async function openCompletion(order) {
    try {
      setError('');
      const requirementData = await api(`/manufacturing/orders/${order.id}/material-requirements`);
      setRequirements(requirementData);
      setSelectedOrder(order);
      setCompleteForm({
        entryNo: `PE-${Date.now().toString().slice(-6)}`,
        productionDate: today(),
        quantity: Math.min(1, requirementData.remainingQuantity),
        notes: ''
      });
      setCompleteOpen(true);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  function updateBomComponent(index, key, value) {
    setBomForm((current) => ({
      ...current,
      components: current.components.map((component, position) =>
        position === index ? { ...component, [key]: value } : component
      )
    }));
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box>
            <Typography variant="h3">Manufacturing Control Panel</Typography>
            <Typography color="text.secondary">BOM, planning, material consumption, finished stock and production costing.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<PlusOutlined />} onClick={openBom}>New BOM</Button>
            <Button variant="contained" startIcon={<ToolOutlined />} onClick={openOrder}>New Production Order</Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Dashboard" />
            <Tab label="Bills of Material" />
            <Tab label="Production Orders" />
            <Tab label="Production History" />
          </Tabs>

          {tab === 0 && <DashboardPanel dashboard={dashboard} orders={orders} />}
          {tab === 1 && <BomTable boms={boms} />}
          {tab === 2 && <OrderTable orders={orders} onComplete={openCompletion} />}
          {tab === 3 && <ProductionHistory entries={entries} />}
        </Box>
      </Grid>

      <Dialog open={bomOpen} onClose={() => setBomOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(
            () => api('/manufacturing/boms', {
              method: 'POST',
              body: JSON.stringify({
                ...bomForm,
                version: Number(bomForm.version),
                outputQuantity: Number(bomForm.outputQuantity),
                effectiveTo: bomForm.effectiveTo || undefined,
                components: bomForm.components.map((component) => ({
                  ...component,
                  quantity: Number(component.quantity),
                  wastagePercent: Number(component.wastagePercent || 0)
                }))
              })
            }),
            'BOM created',
            () => setBomOpen(false)
          );
        }}>
          <DialogTitle>Create Bill of Material</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="BOM Name" value={bomForm.name} onChange={(event) => setBomForm({ ...bomForm, name: event.target.value })} required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Code" value={bomForm.code} onChange={(event) => setBomForm({ ...bomForm, code: event.target.value })} required /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Version" value={bomForm.version} onChange={(event) => setBomForm({ ...bomForm, version: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 8 }}><TextField select fullWidth label="Finished Item" value={bomForm.finishedItemId} onChange={(event) => setBomForm({ ...bomForm, finishedItemId: event.target.value })}>{items.map((item) => <MenuItem key={item.id} value={item.id}>{item.name} ({item.unit.code})</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Output Quantity" value={bomForm.outputQuantity} onChange={(event) => setBomForm({ ...bomForm, outputQuantity: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><DateField fullWidth label="Effective From" value={bomForm.effectiveFrom} onChange={(event) => setBomForm({ ...bomForm, effectiveFrom: event.target.value })} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><DateField fullWidth label="Effective To" value={bomForm.effectiveTo} onChange={(event) => setBomForm({ ...bomForm, effectiveTo: event.target.value })} /></Grid>
              </Grid>
              <Typography variant="h5">Components</Typography>
              {bomForm.components.map((component, index) => (
                <Grid container spacing={2} key={index}>
                  <Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Raw Material" value={component.itemId} onChange={(event) => updateBomComponent(index, 'itemId', event.target.value)}>{items.filter((item) => item.id !== bomForm.finishedItemId).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} ({item.unit.code})</MenuItem>)}</TextField></Grid>
                  <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="Quantity" value={component.quantity} onChange={(event) => updateBomComponent(index, 'quantity', event.target.value)} /></Grid>
                  <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth type="number" label="Wastage %" value={component.wastagePercent} onChange={(event) => updateBomComponent(index, 'wastagePercent', event.target.value)} /></Grid>
                  <Grid size={{ xs: 12, md: 2 }}><Button color="error" disabled={bomForm.components.length === 1} onClick={() => setBomForm((current) => ({ ...current, components: current.components.filter((_, position) => position !== index) }))}>Remove</Button></Grid>
                </Grid>
              ))}
              <Button onClick={() => setBomForm((current) => ({ ...current, components: [...current.components, { itemId: items.find((item) => item.id !== current.finishedItemId)?.id || '', quantity: 1, wastagePercent: 0 }] }))}>Add Component</Button>
              <TextField label="Notes" multiline minRows={2} value={bomForm.notes} onChange={(event) => setBomForm({ ...bomForm, notes: event.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setBomOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save BOM</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={orderOpen} onClose={() => setOrderOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(
            () => api('/manufacturing/orders', {
              method: 'POST',
              body: JSON.stringify({
                ...orderForm,
                plannedQuantity: Number(orderForm.plannedQuantity),
                plannedEndDate: orderForm.plannedEndDate || undefined
              })
            }),
            'Production order created',
            () => setOrderOpen(false)
          );
        }}>
          <DialogTitle>Create Production Order</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select label="BOM" value={orderForm.bomId} onChange={(event) => setOrderForm({ ...orderForm, bomId: event.target.value })}>{boms.filter((bom) => bom.isActive).map((bom) => <MenuItem key={bom.id} value={bom.id}>{bom.code} v{bom.version} - {bom.finishedItem.name}</MenuItem>)}</TextField>
            <TextField select label="Production Warehouse" value={orderForm.warehouseId} onChange={(event) => setOrderForm({ ...orderForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField>
            <Grid container spacing={2}>
              <Grid size={6}><TextField fullWidth label="Order No" value={orderForm.orderNo} onChange={(event) => setOrderForm({ ...orderForm, orderNo: event.target.value })} /></Grid>
              <Grid size={6}><TextField fullWidth type="number" label="Planned Quantity" value={orderForm.plannedQuantity} onChange={(event) => setOrderForm({ ...orderForm, plannedQuantity: event.target.value })} /></Grid>
              <Grid size={4}><DateField fullWidth label="Order Date" value={orderForm.orderDate} onChange={(event) => setOrderForm({ ...orderForm, orderDate: event.target.value })} /></Grid>
              <Grid size={4}><DateField fullWidth label="Start Date" value={orderForm.plannedStartDate} onChange={(event) => setOrderForm({ ...orderForm, plannedStartDate: event.target.value })} /></Grid>
              <Grid size={4}><DateField fullWidth label="End Date" value={orderForm.plannedEndDate} onChange={(event) => setOrderForm({ ...orderForm, plannedEndDate: event.target.value })} /></Grid>
            </Grid>
            <TextField label="Notes" multiline minRows={2} value={orderForm.notes} onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })} />
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setOrderOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Create Order</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={completeOpen} onClose={() => setCompleteOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(
            () => api(`/manufacturing/orders/${selectedOrder.id}/complete`, {
              method: 'POST',
              body: JSON.stringify({ ...completeForm, quantity: Number(completeForm.quantity) })
            }),
            'Production completion posted to stock and accounts',
            () => setCompleteOpen(false)
          );
        }}>
          <DialogTitle>Post Production: {selectedOrder?.orderNo}</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity={requirements?.requirements.some((row) => row.shortageQuantity > 0) ? 'warning' : 'info'}>
              Remaining order quantity: {Number(requirements?.remainingQuantity || 0).toFixed(3)} {requirements?.outputUnit}
            </Alert>
            <Grid container spacing={2}>
              <Grid size={4}><TextField fullWidth label="Entry No" value={completeForm.entryNo} onChange={(event) => setCompleteForm({ ...completeForm, entryNo: event.target.value })} /></Grid>
              <Grid size={4}><DateField fullWidth label="Production Date" value={completeForm.productionDate} onChange={(event) => setCompleteForm({ ...completeForm, productionDate: event.target.value })} /></Grid>
              <Grid size={4}><TextField fullWidth type="number" label="Output Quantity" value={completeForm.quantity} onChange={(event) => setCompleteForm({ ...completeForm, quantity: event.target.value })} /></Grid>
            </Grid>
            <CommonDataGrid
              title="Material Requirements"
              rows={(requirements?.requirements || []).map((row) => ({
                ...row,
                requiredText: `${Number(row.quantity || 0).toFixed(3)} ${row.unit}`,
                availableText: Number(row.availableQuantity || 0).toFixed(3),
                shortageText: Number(row.shortageQuantity || 0).toFixed(3),
                shortageStatus: Number(row.shortageQuantity || 0) > 0 ? 'Shortage' : 'Available'
              }))}
              columns={[
                { field: 'itemName', headerName: 'Material', flex: 1, minWidth: 180 },
                { field: 'requiredText', headerName: 'Required', width: 140, align: 'right', headerAlign: 'right' },
                { field: 'availableText', headerName: 'Available', width: 140, align: 'right', headerAlign: 'right' },
                { field: 'shortageText', headerName: 'Shortage', width: 140, align: 'right', headerAlign: 'right' },
                { field: 'shortageStatus', headerName: 'Status', width: 130 }
              ]}
              getRowId={(row) => row.itemId}
              selectFilters={[{ field: 'shortageStatus', label: 'Status' }]}
              fileName="material-requirements"
              height={320}
              pageSize={25}
            />
            <TextField label="Production Notes" multiline minRows={2} value={completeForm.notes} onChange={(event) => setCompleteForm({ ...completeForm, notes: event.target.value })} />
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setCompleteOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={requirements?.requirements.some((row) => row.shortageQuantity > 0)}>Post Production</Button></DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}

function DashboardPanel({ dashboard, orders }) {
  const cards = [
    ['Active BOMs', dashboard.activeBoms || 0],
    ['Open Orders', dashboard.openOrders || 0],
    ['Completed Orders', dashboard.completedOrders || 0],
    ['Completion', `${dashboard.completionPercent || 0}%`]
  ];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}>
    <Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h2">{value}</Typography></CardContent></Card></Grid>)}</Grid>
    <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 1 }}>Overall Production Progress</Typography><LinearProgress variant="determinate" value={Math.min(100, dashboard.completionPercent || 0)} sx={{ height: 10, borderRadius: 5 }} /><Stack direction="row" sx={{ justifyContent: 'space-between', mt: 1 }}><Typography color="text.secondary">Completed {Number(dashboard.totalCompleted || 0).toFixed(3)}</Typography><Typography color="text.secondary">Planned {Number(dashboard.totalPlanned || 0).toFixed(3)}</Typography></Stack></CardContent></Card>
    <Typography variant="h5">Open Production Orders</Typography>
    <OrderTable orders={orders.filter((order) => ['PLANNED', 'IN_PROGRESS'].includes(order.status))} compact />
  </Stack>;
}

function BomTable({ boms }) {
  const rows = boms.map((bom) => ({
    ...bom,
    bomText: `${bom.name} | ${bom.code} v${bom.version}`,
    finishedItemName: bom.finishedItem.name,
    outputText: `${Number(bom.outputQuantity).toFixed(3)} ${bom.finishedItem.unit.code}`,
    componentsText: bom.components.map((component) => `${component.item.name}: ${Number(component.quantity).toFixed(3)} ${component.item.unit.code}${Number(component.wastagePercent) ? ` + ${Number(component.wastagePercent)}%` : ''}`).join(', '),
    effectiveFromDate: bom.effectiveFrom,
    effectivePeriod: `${formatDate(bom.effectiveFrom)} to ${bom.effectiveTo ? formatDate(bom.effectiveTo) : 'Open'}`,
    statusText: bom.isActive ? 'Active' : 'Inactive'
  }));

  return (
    <CommonDataGrid
      title="Bills of Material"
      rows={rows}
      columns={[
        { field: 'bomText', headerName: 'BOM', flex: 1, minWidth: 180 },
        { field: 'finishedItemName', headerName: 'Finished Item', flex: 1, minWidth: 160 },
        { field: 'outputText', headerName: 'Output', width: 140 },
        { field: 'componentsText', headerName: 'Components', flex: 1.4, minWidth: 240 },
        { field: 'effectivePeriod', headerName: 'Effective Period', width: 210 },
        { field: 'statusText', headerName: 'Status', width: 120 }
      ]}
      searchPlaceholder="Search BOM, item, or component"
      dateField="effectiveFromDate"
      selectFilters={[
        { field: 'finishedItemName', label: 'Finished Item' },
        { field: 'statusText', label: 'Status' }
      ]}
      fileName="manufacturing-boms"
    />
  );
}

function OrderTable({ orders, onComplete, compact = false }) {
  const rows = orders.map((order) => {
    const progress = Number(order.plannedQuantity) ? (Number(order.completedQuantity) / Number(order.plannedQuantity)) * 100 : 0;
    return {
      ...order,
      orderText: `${order.orderNo} | ${formatDate(order.orderDate)}`,
      finishedItemName: order.bom.finishedItem.name,
      bomText: `BOM ${order.bom.code} v${order.bom.version}`,
      warehouseName: order.warehouse.name,
      orderDateValue: order.orderDate,
      progressText: `${Number(order.completedQuantity).toFixed(3)} / ${Number(order.plannedQuantity).toFixed(3)} ${order.bom.finishedItem.unit.code}`,
      progressValue: Math.min(100, progress)
    };
  });
  const columns = [
    { field: 'orderText', headerName: 'Order', flex: 1, minWidth: 170 },
    { field: 'finishedItemName', headerName: 'Finished Item', flex: 1, minWidth: 170 },
    { field: 'warehouseName', headerName: 'Warehouse', flex: 1, minWidth: 150 },
    {
      field: 'progressText',
      headerName: 'Progress',
      width: 220,
      renderCell: ({ row }) => (
        <Box sx={{ width: '100%' }}>
          <Typography variant="caption">{row.progressText}</Typography>
          <LinearProgress variant="determinate" value={row.progressValue} />
        </Box>
      )
    },
    { field: 'status', headerName: 'Status', width: 140, renderCell: ({ value }) => <StatusChip status={value} /> }
  ];
  if (!compact) {
    columns.push({
      field: 'action',
      headerName: 'Action',
      width: 170,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Button size="small" variant="contained" disabled={!['PLANNED', 'IN_PROGRESS'].includes(row.status)} onClick={() => onComplete(row)}>
          Post Production
        </Button>
      )
    });
  }

  return (
    <CommonDataGrid
      title={compact ? 'Open Production Orders' : 'Production Orders'}
      rows={rows}
      columns={columns}
      searchPlaceholder="Search order, item, or warehouse"
      dateField="orderDateValue"
      selectFilters={[
        { field: 'warehouseName', label: 'Warehouse' },
        { field: 'status', label: 'Status' }
      ]}
      fileName={compact ? 'open-production-orders' : 'production-orders'}
      height={compact ? 380 : 520}
      pageSize={25}
    />
  );
}

function ProductionHistory({ entries }) {
  const rows = entries.map((entry) => ({
    ...entry,
    date: entry.productionDate,
    dateText: formatDate(entry.productionDate),
    entryText: `${entry.entryNo} | ${entry.order.orderNo}`,
    outputText: `${entry.outputItem.name}: ${Number(entry.quantity).toFixed(3)} ${entry.outputItem.unit.code}`,
    consumedText: entry.consumptions.map((consumption) => `${consumption.item.name}: ${Number(consumption.quantity).toFixed(3)} ${consumption.item.unit.code}`).join(', '),
    materialCostText: Number(entry.materialCost).toFixed(2),
    unitCostText: Number(entry.unitCost).toFixed(2)
  }));

  return (
    <CommonDataGrid
      title="Production History"
      rows={rows}
      columns={[
        { field: 'dateText', headerName: 'Date', width: 130 },
        { field: 'entryText', headerName: 'Entry / Order', flex: 1, minWidth: 170 },
        { field: 'outputText', headerName: 'Output', flex: 1, minWidth: 200 },
        { field: 'consumedText', headerName: 'Consumed Materials', flex: 1.4, minWidth: 260 },
        { field: 'materialCostText', headerName: 'Material Cost', width: 150, align: 'right', headerAlign: 'right' },
        { field: 'unitCostText', headerName: 'Unit Cost', width: 130, align: 'right', headerAlign: 'right' }
      ]}
      searchPlaceholder="Search entry, order, output, or material"
      dateField="date"
      fileName="production-history"
    />
  );
}

function StatusChip({ status }) {
  const colors = { PLANNED: 'default', IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'error' };
  return <Chip size="small" color={colors[status]} label={status.replace('_', ' ')} />;
}




