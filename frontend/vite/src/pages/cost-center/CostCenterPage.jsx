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
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';

import CommonDataGrid from 'components/CommonDataGrid';

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

const emptyForm = { name: '', code: '', notes: '', isActive: true };

export default function CostCenterPage() {
  const [costCenters, setCostCenters] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCostCenter, setSelectedCostCenter] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const data = await api('/cost-center/centers');
      setCostCenters(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setSelectedCostCenter(null);
    setOpen(true);
  }

  function openEdit(costCenter) {
    setSelectedCostCenter(costCenter);
    setForm({
      name: costCenter.name || '',
      code: costCenter.code || '',
      notes: costCenter.notes || '',
      isActive: Boolean(costCenter.isActive)
    });
    setOpen(true);
  }

  async function run(action, success) {
    try {
      setError('');
      setMessage('');
      await action();
      setMessage(success);
      setOpen(false);
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function saveCostCenter() {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      notes: form.notes.trim() || undefined,
      isActive: form.isActive
    };
    if (selectedCostCenter) {
      await run(() => api(`/cost-center/centers/${selectedCostCenter.id}`, { method: 'PATCH', body: JSON.stringify(payload) }), 'Cost centre updated');
      return;
    }
    await run(() => api('/cost-center/centers', { method: 'POST', body: JSON.stringify(payload) }), 'Cost centre created');
  }

  const rows = useMemo(
    () =>
      costCenters.map((center) => ({
        ...center,
        statusText: center.isActive ? 'Active' : 'Inactive',
        notesText: center.notes || '-'
      })),
    [costCenters]
  );

  const summary = useMemo(
    () => ({
      total: costCenters.length,
      active: costCenters.filter((center) => center.isActive).length,
      inactive: costCenters.filter((center) => !center.isActive).length
    }),
    [costCenters]
  );

  const columns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 220,
        renderCell: (params) => <Button variant="text" onClick={() => openEdit(params.row)} sx={{ justifyContent: 'flex-start', px: 0 }}>{params.value}</Button>
      },
      { field: 'code', headerName: 'Code', flex: 0.7, minWidth: 140 },
      { field: 'notesText', headerName: 'Notes', flex: 1.4, minWidth: 260 },
      {
        field: 'statusText',
        headerName: 'Status',
        flex: 0.6,
        minWidth: 120,
        renderCell: (params) => <Chip size="small" label={params.value} color={params.value === 'Active' ? 'success' : 'default'} variant="outlined" />
      }
    ],
    []
  );

  return (
    <Stack spacing={2.5} sx={{ p: 2.5 }}>
      {(message || error) && (
        <Alert severity={error ? 'error' : 'success'} onClose={() => (error ? setError('') : setMessage(''))}>
          {error || message}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-start' } }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h3">Cost Centre</Typography>
          <Typography color="text.secondary">Simple cost centre master for tracking department or location wise expense allocation.</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Button startIcon={<ReloadOutlined />} onClick={loadData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button variant="contained" startIcon={<PlusOutlined />} onClick={openCreate}>
            Create Cost Centre
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">Total</Typography>
              <Typography variant="h3">{summary.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">Active</Typography>
              <Typography variant="h3">{summary.active}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="text.secondary">Inactive</Typography>
              <Typography variant="h3">{summary.inactive}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <CommonDataGrid
        title="Cost Centres"
        rows={rows}
        columns={columns}
        fileName="cost-centres"
        searchPlaceholder="Search cost centres"
        onRowClick={(params) => openEdit(params.row)}
        selectFilters={[
          { field: 'statusText', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }
        ]}
      />

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedCostCenter ? 'Edit Cost Centre' : 'Create Cost Centre'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <TextField label="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
            <TextField label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} multiline minRows={3} />
            <TextField select label="Status" value={form.isActive ? 'true' : 'false'} onChange={(event) => setForm({ ...form, isActive: event.target.value === 'true' })}>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCostCenter}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
