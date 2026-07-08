import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import PlusOutlined from '@ant-design/icons/PlusOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';
import { formatDate } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const budgetCategories = ['ANNUAL', 'GOVERNMENT_GRANT'];
const budgetStatuses = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'];

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

const emptyBudgetTypeForm = {
  name: '',
  code: '',
  category: 'ANNUAL',
  costCenterId: '',
  isAnnual: false,
  isActive: true
};

const emptyBudgetForm = {
  budgetTypeId: '',
  name: '',
  code: '',
  fiscalYear: '',
  costCenterId: '',
  periodFrom: '',
  periodTo: '',
  totalAmount: 0,
  status: 'DRAFT',
  notes: ''
};

export default function BudgetPage() {
  const [tab, setTab] = useState(0);
  const [budgetTypes, setBudgetTypes] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [budgetTypeOpen, setBudgetTypeOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetTypeForm, setBudgetTypeForm] = useState(emptyBudgetTypeForm);
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm);

  async function loadData() {
    try {
      setError('');
      const [budgetTypeData, budgetData, costCenterData] = await Promise.all([
        api('/accounting/budgets'),
        api('/budget/budgets'),
        api('/cost-center/centers')
      ]);
      setBudgetTypes(budgetTypeData);
      setBudgets(budgetData);
      setCostCenters(costCenterData);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const budgetTypeRows = useMemo(
    () =>
      budgetTypes.map((budgetType) => ({
        ...budgetType,
        budgetTypeText: `${budgetType.name} | ${budgetType.code}`,
        categoryText: budgetType.category || '-',
        costCenterText: budgetType.costCenter?.name || '-',
        annualText: budgetType.isAnnual ? 'Yes' : 'No',
        statusText: budgetType.isActive ? 'Active' : 'Inactive'
      })),
    [budgetTypes]
  );

  const budgetRows = useMemo(
    () =>
      budgets.map((budget) => ({
        ...budget,
        budgetText: `${budget.name} | ${budget.code}`,
        budgetTypeText: budget.budgetType ? `${budget.budgetType.name} | ${budget.budgetType.code}` : '-',
        costCenterText: budget.costCenter?.name || '-',
        fiscalYearText: budget.fiscalYear || '-',
        periodText: `${formatDate(budget.periodFrom)} to ${formatDate(budget.periodTo)}`,
        totalText: Number(budget.totalAmount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
        statusText: budget.status || '-',
        notesText: budget.notes || '-'
      })),
    [budgets]
  );

  function openBudgetTypeDialog() {
    setBudgetOpen(false);
    setBudgetTypeForm(emptyBudgetTypeForm);
    setBudgetTypeOpen(true);
  }

  function openBudgetDialog() {
    setBudgetTypeOpen(false);
    setBudgetForm(emptyBudgetForm);
    setBudgetOpen(true);
  }

  async function run(action, success, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(success);
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function saveBudgetType() {
    const payload = {
      name: budgetTypeForm.name.trim(),
      code: budgetTypeForm.code.trim().toUpperCase(),
      category: budgetTypeForm.category,
      costCenterId: budgetTypeForm.costCenterId || undefined,
      isAnnual: budgetTypeForm.isAnnual,
      isActive: budgetTypeForm.isActive
    };
    await run(() => api('/accounting/budgets', { method: 'POST', body: JSON.stringify(payload) }), 'Budget Type created', () => setBudgetTypeOpen(false));
  }

  async function saveBudget() {
    const payload = {
      budgetTypeId: budgetForm.budgetTypeId || undefined,
      name: budgetForm.name.trim(),
      code: budgetForm.code.trim().toUpperCase(),
      fiscalYear: budgetForm.fiscalYear.trim(),
      costCenterId: budgetForm.costCenterId || undefined,
      periodFrom: budgetForm.periodFrom,
      periodTo: budgetForm.periodTo,
      totalAmount: Number(budgetForm.totalAmount || 0),
      status: budgetForm.status,
      notes: budgetForm.notes.trim() || undefined
    };
    await run(() => api('/budget/budgets', { method: 'POST', body: JSON.stringify(payload) }), 'Budget created', () => setBudgetOpen(false));
  }

  return (
    <Stack spacing={2.5} sx={{ p: 2.5 }}>
      {(message || error) && (
        <Box>
          <Alert severity={error ? 'error' : 'success'} onClose={() => (error ? setError('') : setMessage(''))}>
            {error || message}
          </Alert>
        </Box>
      )}

      <Box>
        <Typography variant="h3">Budget</Typography>
        <Typography color="text.secondary">Simple budget types and budgets with optional cost centre reference.</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
        <Tab label="Budget Type" />
        <Tab label="Budget" />
      </Tabs>

      {tab === 0 && (
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5">Budget Types</Typography>
              <Typography color="text.secondary">Which type of budget this is, like annual budget or government budget.</Typography>
            </Box>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => openBudgetTypeDialog()}>
              Create Budget Type
            </Button>
          </Stack>
          <CommonDataGrid
            title="Budget Types"
            rows={budgetTypeRows}
            columns={[
              { field: 'budgetTypeText', headerName: 'Budget Type', flex: 1.2, minWidth: 240 },
              { field: 'categoryText', headerName: 'Category', width: 180, renderCell: ({ value }) => <Chip size="small" label={value} variant="outlined" /> },
              { field: 'costCenterText', headerName: 'Cost Centre', flex: 1, minWidth: 180 },
              { field: 'annualText', headerName: 'Annual', width: 120 },
              { field: 'statusText', headerName: 'Status', width: 120, renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'Active' ? 'success' : 'default'} variant="outlined" /> }
            ]}
            fileName="budget-types"
            searchPlaceholder="Search budget types"
            selectFilters={[
              { field: 'categoryText', label: 'Category', options: budgetCategories.map((category) => ({ value: category, label: category })) },
              { field: 'annualText', label: 'Annual', options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] },
              { field: 'statusText', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }
            ]}
            height={560}
          />
        </Stack>
      )}

      {tab === 1 && (
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5">Budget</Typography>
              <Typography color="text.secondary">Budget master with optional cost centre reference.</Typography>
            </Box>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => openBudgetDialog()}>
              Create Budget
            </Button>
          </Stack>
          <CommonDataGrid
            title="Budgets"
            rows={budgetRows}
            columns={[
              { field: 'budgetText', headerName: 'Budget', flex: 1.2, minWidth: 220 },
              { field: 'budgetTypeText', headerName: 'Budget Type', flex: 1.1, minWidth: 200 },
              { field: 'costCenterText', headerName: 'Cost Centre', flex: 1, minWidth: 180 },
              { field: 'fiscalYearText', headerName: 'Fiscal Year', width: 140 },
              { field: 'periodText', headerName: 'Period', flex: 1.2, minWidth: 220 },
              { field: 'totalText', headerName: 'Amount', width: 150, align: 'right', headerAlign: 'right' },
              { field: 'statusText', headerName: 'Status', width: 120, renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'ACTIVE' ? 'success' : 'default'} variant="outlined" /> }
            ]}
            fileName="budgets"
            searchPlaceholder="Search budgets"
            selectFilters={[
              { field: 'costCenterText', label: 'Cost Centre', options: Array.from(new Set(budgetRows.map((row) => row.costCenterText))).map((value) => ({ value, label: value })) },
              { field: 'statusText', label: 'Status', options: budgetStatuses.map((value) => ({ value, label: value })) }
            ]}
            height={560}
          />
        </Stack>
      )}

      <Dialog open={budgetTypeOpen} onClose={() => setBudgetTypeOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); saveBudgetType().catch((saveError) => setError(saveError.message)); }}>
          <DialogTitle>Create Budget Type</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={budgetTypeForm.name} onChange={(event) => setBudgetTypeForm({ ...budgetTypeForm, name: event.target.value })} required />
              <TextField label="Code" value={budgetTypeForm.code} onChange={(event) => setBudgetTypeForm({ ...budgetTypeForm, code: event.target.value })} required />
              <TextField select label="Category" value={budgetTypeForm.category} onChange={(event) => setBudgetTypeForm({ ...budgetTypeForm, category: event.target.value })}>
                {budgetCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Cost Centre" value={budgetTypeForm.costCenterId} onChange={(event) => setBudgetTypeForm({ ...budgetTypeForm, costCenterId: event.target.value })}>
                <MenuItem value="">Optional</MenuItem>
                {costCenters.map((costCenter) => (
                  <MenuItem key={costCenter.id} value={costCenter.id}>
                    {costCenter.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Annual Budget" value={budgetTypeForm.isAnnual ? 'yes' : 'no'} onChange={(event) => setBudgetTypeForm({ ...budgetTypeForm, isAnnual: event.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
              <TextField select label="Status" value={budgetTypeForm.isActive ? 'yes' : 'no'} onChange={(event) => setBudgetTypeForm({ ...budgetTypeForm, isActive: event.target.value === 'yes' })}>
                <MenuItem value="yes">Active</MenuItem>
                <MenuItem value="no">Inactive</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBudgetTypeOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={budgetOpen} onClose={() => setBudgetOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); saveBudget().catch((saveError) => setError(saveError.message)); }}>
          <DialogTitle>Create Budget</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={budgetForm.name} onChange={(event) => setBudgetForm({ ...budgetForm, name: event.target.value })} required />
              <TextField label="Code" value={budgetForm.code} onChange={(event) => setBudgetForm({ ...budgetForm, code: event.target.value })} required />
              <TextField select label="Budget Type" value={budgetForm.budgetTypeId} onChange={(event) => setBudgetForm({ ...budgetForm, budgetTypeId: event.target.value })}>
                <MenuItem value="">Optional</MenuItem>
                {budgetTypes.map((budgetType) => (
                  <MenuItem key={budgetType.id} value={budgetType.id}>
                    {budgetType.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Fiscal Year" value={budgetForm.fiscalYear} onChange={(event) => setBudgetForm({ ...budgetForm, fiscalYear: event.target.value })} required />
              <TextField select label="Cost Centre" value={budgetForm.costCenterId} onChange={(event) => setBudgetForm({ ...budgetForm, costCenterId: event.target.value })}>
                <MenuItem value="">Optional</MenuItem>
                {costCenters.map((costCenter) => (
                  <MenuItem key={costCenter.id} value={costCenter.id}>
                    {costCenter.name}
                  </MenuItem>
                ))}
              </TextField>
              <DateField fullWidth label="Period From" value={budgetForm.periodFrom} onChange={(event) => setBudgetForm({ ...budgetForm, periodFrom: event.target.value })} required />
              <DateField fullWidth label="Period To" value={budgetForm.periodTo} onChange={(event) => setBudgetForm({ ...budgetForm, periodTo: event.target.value })} required />
              <TextField
                label="Amount"
                type="number"
                value={budgetForm.totalAmount}
                onChange={(event) => setBudgetForm({ ...budgetForm, totalAmount: event.target.value })}
                inputProps={{ min: 0, step: '0.01' }}
              />
              <TextField select label="Status" value={budgetForm.status} onChange={(event) => setBudgetForm({ ...budgetForm, status: event.target.value })}>
                {budgetStatuses.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Notes" value={budgetForm.notes} onChange={(event) => setBudgetForm({ ...budgetForm, notes: event.target.value })} multiline minRows={3} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBudgetOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
