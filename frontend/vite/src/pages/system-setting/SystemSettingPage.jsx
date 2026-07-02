import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
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
  }, []);

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
    </Grid>
  );
}
