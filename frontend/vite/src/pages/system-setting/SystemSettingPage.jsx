import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const defaultModules = {
  budget: true,
  grant: true,
  payroll: true,
  sales: true,
  purchase: true,
  costCenter: true
};

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

export default function SystemSettingPage() {
  const [modules, setModules] = useState(defaultModules);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tallyStatus, setTallyStatus] = useState(null);
  const [tallyForm, setTallyForm] = useState({
    enabled: false,
    host: '127.0.0.1',
    port: 9000,
    companyName: 'Default Company',
    direction: 'BOTH',
    autoSync: false,
    syncIntervalSeconds: 300
  });
  const [tallyMessage, setTallyMessage] = useState('');
  const [tallyError, setTallyError] = useState('');
  const [tallyLoading, setTallyLoading] = useState(false);

  async function loadSettings() {
    try {
      setLoading(true);
      setError('');
      const response = await api('/system-setting/modules');
      setModules({ ...defaultModules, ...(response.modules || {}) });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadTallyStatus();
  }, []);

  async function loadTallyStatus() {
    try {
      setTallyError('');
      const response = await api('/tally-sync/status');
      setTallyStatus(response);
      if (response?.setting) {
        setTallyForm({
          enabled: Boolean(response.setting.enabled),
          host: response.setting.host || '127.0.0.1',
          port: response.setting.port || 9000,
          companyName: response.setting.companyName || 'Default Company',
          direction: response.setting.direction || 'BOTH',
          autoSync: Boolean(response.setting.autoSync),
          syncIntervalSeconds: response.setting.syncIntervalSeconds || 300
        });
      }
    } catch (loadError) {
      setTallyError(loadError.message);
    }
  }

  async function saveSettings() {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      const response = await api('/system-setting/modules', {
        method: 'PUT',
        body: JSON.stringify(modules)
      });
      setModules({ ...defaultModules, ...(response.modules || {}) });
      setMessage('System setting saved');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setLoading(false);
    }
  }

  async function runTallyAction(path, successText) {
    try {
      setTallyLoading(true);
      setTallyError('');
      setTallyMessage('');
      const response = await api(path, { method: 'POST' });
      setTallyStatus((current) => (current ? { ...current, setting: response.setting || current.setting } : response));
      setTallyMessage(successText);
    } catch (actionError) {
      setTallyError(actionError.message);
    } finally {
      setTallyLoading(false);
    }
  }

  async function saveTallySettings() {
    try {
      setTallyLoading(true);
      setTallyError('');
      setTallyMessage('');
      const response = await api('/tally-sync/settings', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: tallyForm.enabled,
          host: tallyForm.host,
          port: Number(tallyForm.port),
          companyName: tallyForm.companyName || null,
          direction: tallyForm.direction,
          autoSync: Boolean(tallyForm.autoSync),
          syncIntervalSeconds: Number(tallyForm.syncIntervalSeconds)
        })
      });
      setTallyStatus((current) => ({ ...(current || {}), setting: response }));
      setTallyForm({
        enabled: Boolean(response.enabled),
        host: response.host || '127.0.0.1',
        port: response.port || 9000,
        companyName: response.companyName || 'Default Company',
        direction: response.direction || 'BOTH',
        autoSync: Boolean(response.autoSync),
        syncIntervalSeconds: response.syncIntervalSeconds || 300
      });
      setTallyMessage('Tally sync setting saved');
    } catch (saveError) {
      setTallyError(saveError.message);
    } finally {
      setTallyLoading(false);
    }
  }

  const fields = [
    { key: 'budget', label: 'Budget' },
    { key: 'grant', label: 'Grant' },
    { key: 'payroll', label: 'Payroll' },
    { key: 'sales', label: 'Sales' },
    { key: 'purchase', label: 'Purchase' },
    { key: 'costCenter', label: 'Cost Center' }
  ];

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
        <Stack spacing={1}>
          <Typography variant="h3">System Setting</Typography>
          <Typography color="text.secondary">
            Turn modules on or off with one saved parameter. The selected values are stored together as `enabledModules`.
          </Typography>
        </Stack>
      </Grid>

      <Grid size={12}>
        <MainCard title="Enabled Modules" contentSX={{ p: 2.5 }}>
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                gap: 1
              }}
            >
              {fields.map((field) => (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Checkbox
                      checked={Boolean(modules[field.key])}
                      onChange={(event) => setModules({ ...modules, [field.key]: event.target.checked })}
                    />
                  }
                  label={field.label}
                  sx={{
                    m: 0,
                    p: 1.25,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}
                />
              ))}
            </Box>
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={saveSettings} disabled={loading}>
                {loading ? 'Saving...' : 'Save Setting'}
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="Tally Sync" contentSX={{ p: 2.5 }}>
          <Stack spacing={2}>
            {(tallyMessage || tallyError) && (
              <Alert severity={tallyError ? 'error' : 'success'} onClose={() => (tallyError ? setTallyError('') : setTallyMessage(''))}>
                {tallyError || tallyMessage}
              </Alert>
            )}

            <Typography color="text.secondary">
              Use these buttons to pull everything from Tally into ERP or push all ERP data back to Tally in one click.
            </Typography>

            <Divider />

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(tallyForm.enabled)}
                      onChange={(event) => setTallyForm({ ...tallyForm, enabled: event.target.checked })}
                    />
                  }
                  label="Enable Tally Sync"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Host"
                  value={tallyForm.host}
                  onChange={(event) => setTallyForm({ ...tallyForm, host: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Port"
                  value={tallyForm.port}
                  onChange={(event) => setTallyForm({ ...tallyForm, port: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Company Name"
                  value={tallyForm.companyName}
                  onChange={(event) => setTallyForm({ ...tallyForm, companyName: event.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Direction"
                  value={tallyForm.direction}
                  onChange={(event) => setTallyForm({ ...tallyForm, direction: event.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="BOTH">Both Ways</option>
                  <option value="PULL">Import Only</option>
                  <option value="PUSH">Export Only</option>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={Boolean(tallyForm.autoSync)}
                      onChange={(event) => setTallyForm({ ...tallyForm, autoSync: event.target.checked })}
                    />
                  }
                  label="Auto Sync"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Interval Sec"
                  value={tallyForm.syncIntervalSeconds}
                  onChange={(event) => setTallyForm({ ...tallyForm, syncIntervalSeconds: event.target.value })}
                />
              </Grid>
            </Grid>

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={saveTallySettings} disabled={tallyLoading}>
                {tallyLoading ? 'Saving...' : 'Save Tally Setting'}
              </Button>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button fullWidth variant="outlined" onClick={() => runTallyAction('/tally-sync/test', 'Tally connection looks reachable')} disabled={tallyLoading}>
                  Test Tally
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button fullWidth variant="contained" onClick={() => runTallyAction('/tally-sync/import-all', 'Imported all available Tally data')} disabled={tallyLoading}>
                  Import All
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button fullWidth variant="contained" onClick={() => runTallyAction('/tally-sync/export-all', 'Exported all ERP data to Tally')} disabled={tallyLoading}>
                  Export All
                </Button>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button fullWidth variant="outlined" onClick={() => runTallyAction('/tally-sync/sync', 'Two-way sync completed')} disabled={tallyLoading}>
                  Sync Both Ways
                </Button>
              </Grid>
            </Grid>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                gap: 1.5,
                mt: 1
              }}
            >
              <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Enabled</Typography>
                <Typography variant="h6">{tallyStatus?.setting?.enabled ? 'Yes' : 'No'}</Typography>
              </Box>
              <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Direction</Typography>
                <Typography variant="h6">{tallyStatus?.setting?.direction || 'BOTH'}</Typography>
              </Box>
              <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Host</Typography>
                <Typography variant="h6">{tallyStatus?.setting?.host || '127.0.0.1'}</Typography>
              </Box>
              <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">Mapping Count</Typography>
                <Typography variant="h6">{tallyStatus?.mappingCount ?? 0}</Typography>
              </Box>
            </Box>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
