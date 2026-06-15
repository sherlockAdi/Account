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
  const [unitForm, setUnitForm] = useState({ name: '', code: '', decimalPlaces: 2 });
  const [groupForm, setGroupForm] = useState({ name: '', code: '' });
  const [itemForm, setItemForm] = useState({ name: '', code: '', unitId: '', groupId: '', hsnSac: '', standardRate: 0, reorderLevel: 0, taxRateId: '', taxEffectiveFrom: todayIso(), taxEffectiveTo: '' });
  const [taxForm, setTaxForm] = useState({ itemId: '', taxRateId: '', effectiveFrom: todayIso(), effectiveTo: '' });
  const [movementForm, setMovementForm] = useState({ itemId: '', warehouseId: '', type: 'OPENING', quantity: 0, rate: 0, movementDate: todayIso(), referenceNo: '', narration: '' });

  const warehouses = companies.flatMap((company) => company.branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch, company }))));

  async function loadData() {
    const [unitData, groupData, itemData, taxData, companyData, movementData, summaryData] = await Promise.all([
      api('/inventory/units'),
      api('/inventory/groups'),
      api('/inventory/items'),
      api('/gst/tax-rates'),
      api('/companies'),
      api('/inventory/movements'),
      api('/inventory/reports/stock-summary')
    ]);
    setUnits(unitData);
    setGroups(groupData);
    setItems(itemData);
    setTaxRates(taxData);
    setCompanies(companyData);
    setMovements(movementData);
    setSummary(summaryData);
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
          {tab === 0 && <GridPanel label="Create Unit" onCreate={() => setUnitOpen(true)}><Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Decimals</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{units.map((unit) => <TableRow key={unit.id}><TableCell>{unit.name}</TableCell><TableCell>{unit.code}</TableCell><TableCell>{unit.decimalPlaces}</TableCell><TableCell>{unit.isActive ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></GridPanel>}
          {tab === 1 && <GridPanel label="Create Item Group" onCreate={() => setGroupOpen(true)}><Table size="small"><TableHead><TableRow><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Items</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{groups.map((group) => <TableRow key={group.id}><TableCell>{group.name}</TableCell><TableCell>{group.code}</TableCell><TableCell>{group.items?.map((item) => item.name).join(', ') || '-'}</TableCell><TableCell>{group.isActive ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></GridPanel>}
          {tab === 2 && <GridPanel label="Create Item" onCreate={() => { setItemForm({ name: '', code: '', unitId: units[0]?.id || '', groupId: groups[0]?.id || '', hsnSac: '', standardRate: 0, reorderLevel: 0, taxRateId: taxRates[0]?.id || '', taxEffectiveFrom: todayIso(), taxEffectiveTo: '' }); setItemOpen(true); }}><Table size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell>Group</TableCell><TableCell>Unit</TableCell><TableCell>HSN/SAC</TableCell><TableCell>Tax History</TableCell><TableCell align="right">Rate</TableCell><TableCell align="right">Reorder</TableCell><TableCell>Action</TableCell></TableRow></TableHead><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{item.name}<br />{item.code}</TableCell><TableCell>{item.group?.name || '-'}</TableCell><TableCell>{item.unit.code}</TableCell><TableCell>{item.hsnSac || '-'}</TableCell><TableCell>{item.taxRates?.map((entry) => `${entry.taxRate.name}: ${formatDate(entry.effectiveFrom)} to ${entry.effectiveTo ? formatDate(entry.effectiveTo) : '' || 'Open'}`).join(', ') || 'Not configured'}</TableCell><TableCell align="right">{Number(item.standardRate).toFixed(2)}</TableCell><TableCell align="right">{Number(item.reorderLevel).toFixed(3)}</TableCell><TableCell><Button size="small" onClick={() => { setTaxForm({ itemId: item.id, taxRateId: taxRates[0]?.id || '', effectiveFrom: todayIso(), effectiveTo: '' }); setTaxOpen(true); }}>Add Tax Period</Button></TableCell></TableRow>)}</TableBody></Table></GridPanel>}
          {tab === 3 && <GridPanel label="Create Movement" onCreate={() => { setMovementForm({ itemId: items[0]?.id || '', warehouseId: warehouses[0]?.id || '', type: 'OPENING', quantity: 0, rate: 0, movementDate: todayIso(), referenceNo: '', narration: '' }); setMovementOpen(true); }}><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Item</TableCell><TableCell>Warehouse</TableCell><TableCell>Type</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead><TableBody>{movements.map((movement) => <TableRow key={movement.id}><TableCell>{formatDate(movement.movementDate)}</TableCell><TableCell>{movement.item.name}</TableCell><TableCell>{movement.warehouse.name}</TableCell><TableCell>{movement.type}</TableCell><TableCell align="right">{Number(movement.quantity).toFixed(3)} {movement.item.unit.code}</TableCell><TableCell align="right">{Number(movement.amount).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table></GridPanel>}
          {tab === 4 && <Box sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell>Group</TableCell><TableCell>Unit</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Value</TableCell><TableCell align="right">Reorder</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{summary.map((row) => <TableRow key={row.itemId}><TableCell>{row.itemName}<br />{row.itemCode}</TableCell><TableCell>{row.groupName || '-'}</TableCell><TableCell>{row.unit}</TableCell><TableCell align="right">{row.quantity.toFixed(3)}</TableCell><TableCell align="right">{row.value.toFixed(2)}</TableCell><TableCell align="right">{row.reorderLevel.toFixed(3)}</TableCell><TableCell>{row.belowReorder ? 'Below reorder' : 'OK'}</TableCell></TableRow>)}</TableBody></Table></Box>}
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
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack><TableContainer>{children}</TableContainer></Stack>;
}

function SimpleDialog({ open, title, onClose, onSubmit, children }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><Box component="form" onSubmit={onSubmit}><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>{children}</Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions></Box></Dialog>;
}




