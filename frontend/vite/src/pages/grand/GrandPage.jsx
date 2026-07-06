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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const categoryTypes = ['ANNUAL', 'GOVERNMENT_GRANT'];

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

const emptyCategoryForm = {
  name: '',
  code: '',
  category: 'ANNUAL',
  costCenterId: '',
  isAnnual: false,
  isActive: true
};

const emptyGrantForm = {
  budgetTypeId: '',
  name: '',
  code: '',
  amount: 0,
  isDefault: false,
  isActive: true
};

function money(value) {
  return Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

export default function GrandPage() {
  const [tab, setTab] = useState(0);
  const [categories, setCategories] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [grantForm, setGrantForm] = useState(emptyGrantForm);

  async function loadData() {
    try {
      setError('');
      const [categoryData, costCenterData] = await Promise.all([
        api('/accounting/budgets'),
        api('/cost-center/centers')
      ]);
      setCategories(categoryData);
      setCostCenters(costCenterData);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const categoryRows = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        categoryText: `${category.name} | ${category.code}`,
        typeText: category.category || '-',
        costCenterText: category.costCenter?.name || '-',
        annualText: category.isAnnual ? 'Yes' : 'No',
        statusText: category.isActive ? 'Active' : 'Inactive',
        grantCountText: category.grants?.length || 0
      })),
    [categories]
  );

  const grantRows = useMemo(
    () =>
      categories.flatMap((category) =>
        (category.grants || []).map((grant) => ({
          ...grant,
          grantText: `${grant.name} | ${grant.code}`,
          categoryText: `${category.name} | ${category.code}`,
          amountText: money(grant.amount),
          defaultText: grant.isDefault ? 'Default' : 'Standard',
          statusText: grant.isActive ? 'Active' : 'Inactive'
        }))
      ),
    [categories]
  );

  function openCategoryDialog() {
    setGrantOpen(false);
    setCategoryForm(emptyCategoryForm);
    setCategoryOpen(true);
  }

  function openGrantDialog() {
    setCategoryOpen(false);
    setGrantForm({
      ...emptyGrantForm,
      budgetTypeId: categories[0]?.id || ''
    });
    setGrantOpen(true);
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

  async function saveCategory() {
    const payload = {
      name: categoryForm.name.trim(),
      code: categoryForm.code.trim().toUpperCase(),
      category: categoryForm.category,
      costCenterId: categoryForm.costCenterId || undefined,
      isAnnual: categoryForm.isAnnual,
      isActive: categoryForm.isActive
    };
    await run(() => api('/accounting/budgets', { method: 'POST', body: JSON.stringify(payload) }), 'Category created', () => setCategoryOpen(false));
  }

  async function saveGrant() {
    const payload = {
      name: grantForm.name.trim(),
      code: grantForm.code.trim().toUpperCase(),
      amount: Number(grantForm.amount),
      isDefault: grantForm.isDefault,
      isActive: grantForm.isActive
    };
    await run(
      () => api(`/accounting/budgets/${grantForm.budgetTypeId}/grants`, { method: 'POST', body: JSON.stringify(payload) }),
      'Grant created',
      () => setGrantOpen(false)
    );
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
        <Typography variant="h3">Grant</Typography>
        <Typography color="text.secondary">Simple category and grant masters.</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
        <Tab label="Category" />
        <Tab label="Grant" />
      </Tabs>

      {tab === 0 && (
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5">Category</Typography>
              <Typography color="text.secondary">Create the grant category table here.</Typography>
            </Box>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={openCategoryDialog}>
              Create Category
            </Button>
          </Stack>
          <CommonDataGrid
            title="Categories"
            rows={categoryRows}
            columns={[
              { field: 'categoryText', headerName: 'Category', flex: 1.2, minWidth: 220 },
              { field: 'typeText', headerName: 'Type', width: 170, renderCell: ({ value }) => <Chip size="small" label={value} variant="outlined" /> },
              { field: 'costCenterText', headerName: 'Cost Centre', flex: 1, minWidth: 180 },
              { field: 'grantCountText', headerName: 'Grants', width: 120, type: 'number' },
              { field: 'annualText', headerName: 'Annual', width: 120 },
              { field: 'statusText', headerName: 'Status', width: 120, renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'Active' ? 'success' : 'default'} variant="outlined" /> }
            ]}
            fileName="grant-categories"
            searchPlaceholder="Search category"
            selectFilters={[
              { field: 'typeText', label: 'Type', options: categoryTypes.map((value) => ({ value, label: value })) },
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
              <Typography variant="h5">Grant</Typography>
              <Typography color="text.secondary">Create grant entries under each category.</Typography>
            </Box>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={openGrantDialog} disabled={!categories.length}>
              Create Grant
            </Button>
          </Stack>
          <CommonDataGrid
            title="Grants"
            rows={grantRows}
            columns={[
              { field: 'grantText', headerName: 'Grant', flex: 1.2, minWidth: 220 },
              { field: 'categoryText', headerName: 'Category', flex: 1.1, minWidth: 220 },
              { field: 'amountText', headerName: 'Amount', width: 140, align: 'right', headerAlign: 'right' },
              { field: 'defaultText', headerName: 'Default', width: 120, renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'Default' ? 'primary' : 'default'} variant="outlined" /> },
              { field: 'statusText', headerName: 'Status', width: 120, renderCell: ({ value }) => <Chip size="small" label={value} color={value === 'Active' ? 'success' : 'default'} variant="outlined" /> }
            ]}
            fileName="grants"
            searchPlaceholder="Search grant or code"
            selectFilters={[
              { field: 'categoryText', label: 'Category', options: Array.from(new Set(grantRows.map((row) => row.categoryText))).map((value) => ({ value, label: value })) },
              { field: 'defaultText', label: 'Default', options: [{ value: 'Default', label: 'Default' }, { value: 'Standard', label: 'Standard' }] },
              { field: 'statusText', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }
            ]}
            height={560}
          />
        </Stack>
      )}

      <Dialog open={categoryOpen} onClose={() => setCategoryOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); saveCategory().catch((saveError) => setError(saveError.message)); }}>
          <DialogTitle>Create Category</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required />
              <TextField label="Code" value={categoryForm.code} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })} required />
              <TextField select label="Type" value={categoryForm.category} onChange={(event) => setCategoryForm({ ...categoryForm, category: event.target.value })}>
                {categoryTypes.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Cost Centre" value={categoryForm.costCenterId} onChange={(event) => setCategoryForm({ ...categoryForm, costCenterId: event.target.value })}>
                <MenuItem value="">Optional</MenuItem>
                {costCenters.map((costCenter) => (
                  <MenuItem key={costCenter.id} value={costCenter.id}>
                    {costCenter.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Annual" value={categoryForm.isAnnual ? 'yes' : 'no'} onChange={(event) => setCategoryForm({ ...categoryForm, isAnnual: event.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
              <TextField select label="Status" value={categoryForm.isActive ? 'yes' : 'no'} onChange={(event) => setCategoryForm({ ...categoryForm, isActive: event.target.value === 'yes' })}>
                <MenuItem value="yes">Active</MenuItem>
                <MenuItem value="no">Inactive</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCategoryOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); saveGrant().catch((saveError) => setError(saveError.message)); }}>
          <DialogTitle>Create Grant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Category" value={grantForm.budgetTypeId} onChange={(event) => setGrantForm({ ...grantForm, budgetTypeId: event.target.value })} required>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Name" value={grantForm.name} onChange={(event) => setGrantForm({ ...grantForm, name: event.target.value })} required />
              <TextField label="Code" value={grantForm.code} onChange={(event) => setGrantForm({ ...grantForm, code: event.target.value })} required />
              <TextField type="number" label="Amount" value={grantForm.amount} onChange={(event) => setGrantForm({ ...grantForm, amount: event.target.value })} />
              <TextField select label="Default Grant" value={grantForm.isDefault ? 'yes' : 'no'} onChange={(event) => setGrantForm({ ...grantForm, isDefault: event.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
              <TextField select label="Status" value={grantForm.isActive ? 'yes' : 'no'} onChange={(event) => setGrantForm({ ...grantForm, isActive: event.target.value === 'yes' })}>
                <MenuItem value="yes">Active</MenuItem>
                <MenuItem value="no">Inactive</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
