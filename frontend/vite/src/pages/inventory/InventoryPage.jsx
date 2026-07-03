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
const movementTypes = ['OPENING', 'PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'PRODUCTION_IN', 'CONSUMPTION'];

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

export default function InventoryPage() {
  const [tab, setTab] = useState(0);
  const [units, setUnits] = useState([]);
  const [groups, setGroups] = useState([]);
  const [items, setItems] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState({});
  const [itemRefsLoaded, setItemRefsLoaded] = useState(false);
  const [movementRefsLoaded, setMovementRefsLoaded] = useState(false);
  const [unitForm, setUnitForm] = useState({ name: '', code: '', decimalPlaces: 2 });
  const [groupForm, setGroupForm] = useState({ name: '', code: '' });
  const [itemForm, setItemForm] = useState({ name: '', code: '', unitId: '', groupId: '', hsnSac: '', standardRate: 0, reorderLevel: 0, taxRateId: '', taxEffectiveFrom: todayIso(), taxEffectiveTo: '' });
  const [taxForm, setTaxForm] = useState({ itemId: '', taxRateId: '', effectiveFrom: todayIso(), effectiveTo: '' });
  const [movementForm, setMovementForm] = useState({ itemId: '', warehouseId: '', type: 'OPENING', quantity: 0, rate: 0, movementDate: todayIso(), referenceNo: '', narration: '' });

  const warehouses = companies.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));

  async function ensureItemRefs() {
    if (itemRefsLoaded && units.length && groups.length && taxRates.length) return { unitData: units, groupData: groups, taxData: taxRates };
    const [unitData, groupData, taxData] = await Promise.all([
      units.length ? Promise.resolve(units) : api('/inventory/units'),
      groups.length ? Promise.resolve(groups) : api('/inventory/groups'),
      taxRates.length ? Promise.resolve(taxRates) : api('/gst/tax-rates')
    ]);
    setUnits(unitData);
    setGroups(groupData);
    setTaxRates(taxData);
    setItemRefsLoaded(true);
    return { unitData, groupData, taxData };
  }

  async function ensureMovementRefs() {
    if (movementRefsLoaded && items.length && companies.length) return { itemData: items, companyData: companies };
    const [itemData, companyData] = await Promise.all([
      items.length ? Promise.resolve(items) : api('/inventory/items'),
      companies.length ? Promise.resolve(companies) : api('/companies')
    ]);
    setItems(itemData);
    setCompanies(companyData);
    setMovementRefsLoaded(true);
    return { itemData, companyData };
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setError('');
      if (tabIndex === 0) setUnits(await api('/inventory/units'));
      if (tabIndex === 1) setGroups(await api('/inventory/groups'));
      if (tabIndex === 2) {
        setItems(await api('/inventory/items'));
        await ensureItemRefs();
      }
      if (tabIndex === 3) {
        setMovements(await api('/inventory/movements'));
        await ensureMovementRefs();
      }
      if (tabIndex === 4) setSummary(await api('/inventory/reports/stock-summary'));
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

  async function openItemDialog() {
    const { unitData, groupData, taxData } = await ensureItemRefs();
    setItemForm({ name: '', code: '', unitId: unitData[0]?.id || '', groupId: groupData[0]?.id || '', hsnSac: '', standardRate: 0, reorderLevel: 0, taxRateId: taxData[0]?.id || '', taxEffectiveFrom: todayIso(), taxEffectiveTo: '' });
    setItemOpen(true);
  }

  async function openMovementDialog() {
    const { itemData, companyData } = await ensureMovementRefs();
    const freshWarehouses = companyData.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));
    setMovementForm({ itemId: itemData[0]?.id || '', warehouseId: freshWarehouses[0]?.id || '', type: 'OPENING', quantity: 0, rate: 0, movementDate: todayIso(), referenceNo: '', narration: '' });
    setMovementOpen(true);
  }

  const statusOptions = [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }];
  const groupOptions = useMemo(() => groups.map((group) => ({ value: group.name, label: group.name })), [groups]);
  const unitOptions = useMemo(() => units.map((unit) => ({ value: unit.code, label: unit.code })), [units]);
  const warehouseOptions = useMemo(
    () => Array.from(new Set(warehouses.map((warehouse) => warehouse.name))).map((name) => ({ value: name, label: name })),
    [warehouses]
  );

  const unitRows = useMemo(
    () => units.map((unit) => ({ ...unit, statusText: unit.isActive ? 'Active' : 'Inactive' })),
    [units]
  );

  const groupRows = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        itemNames: group.items?.map((item) => item.name).join(', ') || '-',
        statusText: group.isActive ? 'Active' : 'Inactive'
      })),
    [groups]
  );

  const itemRows = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        itemName: `${item.name} ${item.code}`,
        groupName: item.group?.name || '-',
        unitCode: item.unit?.code || '-',
        taxHistory: item.taxRates?.map((entry) => `${entry.taxRate.name}: ${formatDate(entry.effectiveFrom)} to ${entry.effectiveTo ? formatDate(entry.effectiveTo) : 'Open'}`).join(', ') || 'Not configured',
        rate: Number(item.standardRate || 0),
        reorder: Number(item.reorderLevel || 0)
      })),
    [items]
  );

  const movementRows = useMemo(
    () =>
      movements.map((movement) => ({
        ...movement,
        date: movement.movementDate,
        itemName: movement.item?.name || '-',
        warehouseName: movement.warehouse?.name || '-',
        quantityText: `${Number(movement.quantity || 0).toFixed(3)} ${movement.item?.unit?.code || ''}`,
        amount: Number(movement.amount || 0)
      })),
    [movements]
  );

  const summaryRows = useMemo(
    () =>
      summary.map((row) => ({
        ...row,
        id: row.itemId,
        itemText: `${row.itemName} ${row.itemCode}`,
        groupText: row.groupName || '-',
        quantityAmount: Number(row.quantity || 0),
        valueAmount: Number(row.value || 0),
        reorderAmount: Number(row.reorderLevel || 0),
        statusText: row.belowReorder ? 'Below reorder' : 'OK'
      })),
    [summary]
  );

  const unitColumns = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
      { field: 'code', headerName: 'Code', flex: 0.7, minWidth: 120 },
      { field: 'decimalPlaces', headerName: 'Decimals', type: 'number', flex: 0.7, minWidth: 120 },
      { field: 'statusText', headerName: 'Status', flex: 0.7, minWidth: 120 }
    ],
    []
  );

  const groupColumns = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
      { field: 'code', headerName: 'Code', flex: 0.7, minWidth: 120 },
      { field: 'itemNames', headerName: 'Items', flex: 1.6, minWidth: 300 },
      { field: 'statusText', headerName: 'Status', flex: 0.7, minWidth: 120 }
    ],
    []
  );

  const itemColumns = useMemo(
    () => [
      { field: 'itemName', headerName: 'Item', flex: 1, minWidth: 210 },
      { field: 'groupName', headerName: 'Group', flex: 0.9, minWidth: 170 },
      { field: 'unitCode', headerName: 'Unit', flex: 0.5, minWidth: 100 },
      { field: 'hsnSac', headerName: 'HSN/SAC', flex: 0.7, minWidth: 130, valueGetter: (value) => value || '-' },
      { field: 'taxHistory', headerName: 'Tax History', flex: 1.5, minWidth: 300 },
      { field: 'rate', headerName: 'Rate', type: 'number', flex: 0.7, minWidth: 120, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'reorder', headerName: 'Reorder', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(3) },
      {
        field: 'actions',
        headerName: 'Action',
        sortable: false,
        filterable: false,
        exportable: false,
        flex: 0.8,
        minWidth: 150,
        renderCell: (params) => <Button size="small" onClick={() => { setTaxForm({ itemId: params.row.id, taxRateId: taxRates[0]?.id || '', effectiveFrom: todayIso(), effectiveTo: '' }); setTaxOpen(true); }}>Add Tax Period</Button>
      }
    ],
    [taxRates]
  );

  const movementColumns = useMemo(
    () => [
      { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
      { field: 'itemName', headerName: 'Item', flex: 1, minWidth: 190 },
      { field: 'warehouseName', headerName: 'Warehouse', flex: 1, minWidth: 180 },
      { field: 'type', headerName: 'Type', flex: 0.9, minWidth: 170 },
      { field: 'quantityText', headerName: 'Qty', flex: 0.7, minWidth: 130 },
      { field: 'amount', headerName: 'Amount', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

  const summaryColumns = useMemo(
    () => [
      { field: 'itemText', headerName: 'Item', flex: 1, minWidth: 210 },
      { field: 'groupText', headerName: 'Group', flex: 0.9, minWidth: 170 },
      { field: 'unit', headerName: 'Unit', flex: 0.5, minWidth: 100 },
      { field: 'quantityAmount', headerName: 'Qty', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(3) },
      { field: 'valueAmount', headerName: 'Value', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'reorderAmount', headerName: 'Reorder', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(3) },
      { field: 'statusText', headerName: 'Status', flex: 0.8, minWidth: 140 }
    ],
    []
  );

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => (error ? setError('') : setMessage(''))}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Units" />
            <Tab label="Item Groups" />
            <Tab label="Items" />
            <Tab label="Stock Movements" />
            <Tab label="Stock Summary" />
          </Tabs>
          {tab === 0 && <GridPanel label="Create Unit" onCreate={() => setUnitOpen(true)}><CommonDataGrid title="Units" rows={unitRows} columns={unitColumns} fileName="inventory-units" searchPlaceholder="Search units" selectFilters={[{ field: 'statusText', label: 'Status', options: statusOptions }]} /></GridPanel>}
          {tab === 1 && <GridPanel label="Create Item Group" onCreate={() => setGroupOpen(true)}><CommonDataGrid title="Item Groups" rows={groupRows} columns={groupColumns} fileName="inventory-item-groups" searchPlaceholder="Search item groups" selectFilters={[{ field: 'statusText', label: 'Status', options: statusOptions }]} /></GridPanel>}
          {tab === 2 && <GridPanel label="Create Item" onCreate={openItemDialog}><CommonDataGrid title="Items" rows={itemRows} columns={itemColumns} fileName="inventory-items" searchPlaceholder="Search items" selectFilters={[{ field: 'groupName', label: 'Group', options: groupOptions }, { field: 'unitCode', label: 'Unit', options: unitOptions }]} /></GridPanel>}
          {tab === 3 && <GridPanel label="Create Movement" onCreate={openMovementDialog}><CommonDataGrid title="Stock Movements" rows={movementRows} columns={movementColumns} fileName="stock-movements" searchPlaceholder="Search movements" dateField="date" selectFilters={[{ field: 'type', label: 'Movement Type', options: movementTypes.map((type) => ({ value: type, label: type })) }, { field: 'warehouseName', label: 'Warehouse', options: warehouseOptions }]} /></GridPanel>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><CommonDataGrid title="Stock Summary" rows={summaryRows} columns={summaryColumns} fileName="stock-summary" searchPlaceholder="Search stock" selectFilters={[{ field: 'groupText', label: 'Group', options: Array.from(new Set(summaryRows.map((row) => row.groupText))).map((group) => ({ value: group, label: group })) }, { field: 'unit', label: 'Unit', options: Array.from(new Set(summaryRows.map((row) => row.unit))).map((unit) => ({ value: unit, label: unit })) }, { field: 'statusText', label: 'Status', options: [{ value: 'OK', label: 'OK' }, { value: 'Below reorder', label: 'Below reorder' }] }]} /></Box>}
        </Box>
      </Grid>

      <SimpleDialog open={unitOpen} title="Create Unit" onClose={() => setUnitOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api('/inventory/units', { method: 'POST', body: JSON.stringify({ ...unitForm, decimalPlaces: Number(unitForm.decimalPlaces) }) }), 'Unit created', () => setUnitOpen(false)); }}><TextField label="Name" value={unitForm.name} onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })} required /><TextField label="Code" value={unitForm.code} onChange={(event) => setUnitForm({ ...unitForm, code: event.target.value })} required /><TextField type="number" label="Decimal places" value={unitForm.decimalPlaces} onChange={(event) => setUnitForm({ ...unitForm, decimalPlaces: event.target.value })} /></SimpleDialog>
      <SimpleDialog open={groupOpen} title="Create Item Group" onClose={() => setGroupOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api('/inventory/groups', { method: 'POST', body: JSON.stringify(groupForm) }), 'Item group created', () => setGroupOpen(false)); }}><TextField label="Name" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /><TextField label="Code" value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} required /></SimpleDialog>
      <SimpleDialog open={itemOpen} title="Create Item" onClose={() => setItemOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api('/inventory/items', { method: 'POST', body: JSON.stringify({ ...itemForm, standardRate: Number(itemForm.standardRate), reorderLevel: Number(itemForm.reorderLevel), taxEffectiveTo: itemForm.taxEffectiveTo || undefined }) }), 'Item created', () => setItemOpen(false)); }}><TextField label="Name" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} required /><TextField label="Code" value={itemForm.code} onChange={(event) => setItemForm({ ...itemForm, code: event.target.value })} required /><TextField select label="Group" value={itemForm.groupId} onChange={(event) => setItemForm({ ...itemForm, groupId: event.target.value })}>{groups.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}</TextField><TextField select label="Unit" value={itemForm.unitId} onChange={(event) => setItemForm({ ...itemForm, unitId: event.target.value })}>{units.map((unit) => <MenuItem key={unit.id} value={unit.id}>{unit.name}</MenuItem>)}</TextField><TextField label="HSN/SAC" value={itemForm.hsnSac} onChange={(event) => setItemForm({ ...itemForm, hsnSac: event.target.value })} /><TextField type="number" label="Standard rate" value={itemForm.standardRate} onChange={(event) => setItemForm({ ...itemForm, standardRate: event.target.value })} /><TextField type="number" label="Reorder level" value={itemForm.reorderLevel} onChange={(event) => setItemForm({ ...itemForm, reorderLevel: event.target.value })} /><TextField select label="Tax Rate" value={itemForm.taxRateId} onChange={(event) => setItemForm({ ...itemForm, taxRateId: event.target.value })} required>{taxRates.map((taxRate) => <MenuItem key={taxRate.id} value={taxRate.id}>{taxRate.name}</MenuItem>)}</TextField><DateField label="Tax Effective From" value={itemForm.taxEffectiveFrom} onChange={(event) => setItemForm({ ...itemForm, taxEffectiveFrom: event.target.value })} required /><DateField label="Tax Effective To" value={itemForm.taxEffectiveTo} onChange={(event) => setItemForm({ ...itemForm, taxEffectiveTo: event.target.value })} /></SimpleDialog>
      <SimpleDialog open={taxOpen} title="Add Item Tax Period" onClose={() => setTaxOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api(`/inventory/items/${taxForm.itemId}/tax-rates`, { method: 'POST', body: JSON.stringify({ taxRateId: taxForm.taxRateId, effectiveFrom: taxForm.effectiveFrom, effectiveTo: taxForm.effectiveTo || undefined }) }), 'Item tax period added', () => setTaxOpen(false)); }}><TextField select label="Tax Rate" value={taxForm.taxRateId} onChange={(event) => setTaxForm({ ...taxForm, taxRateId: event.target.value })} required>{taxRates.map((taxRate) => <MenuItem key={taxRate.id} value={taxRate.id}>{taxRate.name}</MenuItem>)}</TextField><DateField label="Effective From" value={taxForm.effectiveFrom} onChange={(event) => setTaxForm({ ...taxForm, effectiveFrom: event.target.value })} required /><DateField label="Effective To" value={taxForm.effectiveTo} onChange={(event) => setTaxForm({ ...taxForm, effectiveTo: event.target.value })} /></SimpleDialog>
      <SimpleDialog open={movementOpen} title="Create Stock Movement" onClose={() => setMovementOpen(false)} onSubmit={(event) => { event.preventDefault(); save(() => api('/inventory/movements', { method: 'POST', body: JSON.stringify({ ...movementForm, quantity: Number(movementForm.quantity), rate: Number(movementForm.rate) }) }), 'Stock movement created', () => setMovementOpen(false)); }}><TextField select label="Item" value={movementForm.itemId} onChange={(event) => setMovementForm({ ...movementForm, itemId: event.target.value })}>{items.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField><TextField select label="Warehouse" value={movementForm.warehouseId} onChange={(event) => setMovementForm({ ...movementForm, warehouseId: event.target.value })}>{warehouses.map((warehouse) => <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.branch.name} - {warehouse.name}</MenuItem>)}</TextField><TextField select label="Type" value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}>{movementTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField><TextField type="number" label="Quantity" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} /><TextField type="number" label="Rate" value={movementForm.rate} onChange={(event) => setMovementForm({ ...movementForm, rate: event.target.value })} /><DateField label="Date" value={movementForm.movementDate} onChange={(event) => setMovementForm({ ...movementForm, movementDate: event.target.value })} /><TextField label="Reference No" value={movementForm.referenceNo} onChange={(event) => setMovementForm({ ...movementForm, referenceNo: event.target.value })} /><TextField label="Narration" value={movementForm.narration} onChange={(event) => setMovementForm({ ...movementForm, narration: event.target.value })} /></SimpleDialog>
    </Grid>
  );
}

function GridPanel({ label, onCreate, children }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack>{children}</Stack>;
}

function SimpleDialog({ open, title, onClose, onSubmit, children }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><Box component="form" onSubmit={onSubmit}><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions></Box></Dialog>;
}




