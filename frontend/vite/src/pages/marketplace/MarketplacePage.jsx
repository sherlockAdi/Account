import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
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
import Typography from '@mui/material/Typography';

import ApiOutlined from '@ant-design/icons/ApiOutlined';
import AppstoreAddOutlined from '@ant-design/icons/AppstoreAddOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import CloudSyncOutlined from '@ant-design/icons/CloudSyncOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import KeyOutlined from '@ant-design/icons/KeyOutlined';
import PauseCircleOutlined from '@ant-design/icons/PauseCircleOutlined';
import PlayCircleOutlined from '@ant-design/icons/PlayCircleOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import ShopOutlined from '@ant-design/icons/ShopOutlined';

import { useAuth } from 'contexts/AuthContext';

import DateField from 'components/DateField';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const categories = ['ALL', 'ACCOUNTING', 'AUTOMATION', 'COMMERCE', 'COMPLIANCE', 'INTEGRATION', 'REPORTING'];
const eventOptions = ['sales.invoice.created', 'sales.return.created', 'purchase.invoice.created', 'inventory.low_stock', 'voucher.posted', 'payroll.processed'];
const scopeOptions = ['accounting.read', 'inventory.read', 'inventory.write', 'sales.invoice.read', 'sales.invoice.write', 'reports.read'];
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '-';

async function api(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

export default function MarketplacePage() {
  const { token } = useAuth();
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({ recentInstallations: [] });
  const [catalog, setCatalog] = useState([]);
  const [installations, setInstallations] = useState([]);
  const [apiApps, setApiApps] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [installAddon, setInstallAddon] = useState(null);
  const [installForm, setInstallForm] = useState({ companyId: '', plan: 'Professional' });
  const [apiOpen, setApiOpen] = useState(false);
  const [apiForm, setApiForm] = useState({ name: '', companyId: '', scopes: ['inventory.read'], expiresAt: '' });
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '', companyId: '', events: ['sales.invoice.created'] });
  const [credential, setCredential] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const visibleCatalog = useMemo(() => catalog.filter((addon) => {
    const categoryMatch = category === 'ALL' || addon.category === category;
    const text = `${addon.name} ${addon.publisher} ${addon.description}`.toLowerCase();
    return categoryMatch && text.includes(search.toLowerCase());
  }), [catalog, category, search]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, catalogData, installationData, appData, webhookData, companyData] = await Promise.all([
        api('/marketplace/dashboard', token),
        api('/marketplace/catalog', token),
        api('/marketplace/installations', token),
        api('/marketplace/api-apps', token),
        api('/marketplace/webhooks', token),
        api('/companies', token)
      ]);
      setDashboard(dashboardData);
      setCatalog(catalogData);
      setInstallations(installationData);
      setApiApps(appData);
      setWebhooks(webhookData);
      setCompanies(companyData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function run(action, success) {
    try {
      setError('');
      setMessage('');
      const result = await action();
      setMessage(success);
      await loadData();
      return result;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    }
  }

  function beginInstall(addon) {
    setInstallAddon(addon);
    setInstallForm({ companyId: companies[0]?.id || '', plan: addon.pricingModel === 'FREE' ? 'Free' : 'Professional' });
  }

  async function submitInstall() {
    const result = await run(() => api('/marketplace/installations', token, {
      method: 'POST',
      body: JSON.stringify({ addonId: installAddon.id, ...installForm, companyId: installForm.companyId || undefined })
    }), `${installAddon.name} installed successfully`);
    if (result) setInstallAddon(null);
  }

  async function submitApiApp() {
    const result = await run(() => api('/marketplace/api-apps', token, {
      method: 'POST',
      body: JSON.stringify({ ...apiForm, companyId: apiForm.companyId || undefined, expiresAt: apiForm.expiresAt || undefined })
    }), 'API app created');
    if (result) {
      setApiOpen(false);
      setCredential({ title: 'API credentials created', clientId: result.clientId, secret: result.secret });
    }
  }

  async function submitWebhook() {
    const result = await run(() => api('/marketplace/webhooks', token, {
      method: 'POST',
      body: JSON.stringify({ ...webhookForm, companyId: webhookForm.companyId || undefined })
    }), 'Webhook endpoint created');
    if (result) {
      setWebhookOpen(false);
      setCredential({ title: 'Webhook signing secret', secret: result.secret });
    }
  }

  async function rotateSecret(app) {
    const result = await run(() => api(`/marketplace/api-apps/${app.id}/rotate-secret`, token, { method: 'POST' }), 'API secret rotated');
    if (result) setCredential({ title: `New secret for ${app.name}`, clientId: app.clientId, secret: result.secret });
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box><Typography variant="h3">App Marketplace</Typography><Typography color="text.secondary">Extend the ERP with add-ons, secure API apps, integrations, and event webhooks.</Typography></Box>
          <Stack direction="row" spacing={1}><Button startIcon={<ReloadOutlined />} onClick={loadData} disabled={loading}>Refresh</Button><Button variant="contained" startIcon={<PlusOutlined />} onClick={() => setApiOpen(true)}>Create API App</Button></Stack>
        </Stack>
      </Grid>
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Overview" /><Tab label="Discover Add-ons" /><Tab label={`Installed (${installations.length})`} /><Tab label="API Apps" /><Tab label="Webhooks" />
          </Tabs>
          {tab === 0 && <Overview dashboard={dashboard} installations={installations} webhooks={webhooks} onBrowse={() => setTab(1)} />}
          {tab === 1 && <Catalog addons={visibleCatalog} category={category} setCategory={setCategory} search={search} setSearch={setSearch} onInstall={beginInstall} />}
          {tab === 2 && <Installed installations={installations} onStatus={(entry, status) => run(() => api(`/marketplace/installations/${entry.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) }), `${entry.addon.name} updated`)} onRemove={(entry) => run(() => api(`/marketplace/installations/${entry.id}`, token, { method: 'DELETE' }), `${entry.addon.name} uninstalled`)} />}
          {tab === 3 && <ApiApps apps={apiApps} onCreate={() => setApiOpen(true)} onRotate={rotateSecret} onRevoke={(app) => run(() => api(`/marketplace/api-apps/${app.id}`, token, { method: 'DELETE' }), `${app.name} revoked`)} />}
          {tab === 4 && <Webhooks webhooks={webhooks} onCreate={() => setWebhookOpen(true)} onTest={(hook) => run(() => api(`/marketplace/webhooks/${hook.id}/test`, token, { method: 'POST' }), `Test event sent to ${hook.name}`)} onStatus={(hook, status) => run(() => api(`/marketplace/webhooks/${hook.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }), `${hook.name} ${status.toLowerCase()}`)} onDelete={(hook) => run(() => api(`/marketplace/webhooks/${hook.id}`, token, { method: 'DELETE' }), `${hook.name} deleted`)} />}
        </Box>
      </Grid>

      <Dialog open={Boolean(installAddon)} onClose={() => setInstallAddon(null)} fullWidth maxWidth="sm">
        <DialogTitle>Install {installAddon?.name}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Alert severity="info">{installAddon?.pricingModel === 'FREE' ? 'This add-on is free.' : 'Includes a 14-day trial before billing starts.'}</Alert><TextField select label="Company" value={installForm.companyId} onChange={(e) => setInstallForm({ ...installForm, companyId: e.target.value })}>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField><TextField label="Plan" value={installForm.plan} onChange={(e) => setInstallForm({ ...installForm, plan: e.target.value })} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setInstallAddon(null)}>Cancel</Button><Button variant="contained" onClick={submitInstall}>Install Add-on</Button></DialogActions>
      </Dialog>

      <Dialog open={apiOpen} onClose={() => setApiOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create API App</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Application Name" value={apiForm.name} onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })} required /><TextField select label="Company Scope" value={apiForm.companyId} onChange={(e) => setApiForm({ ...apiForm, companyId: e.target.value })}><MenuItem value="">All companies</MenuItem>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField><TextField select SelectProps={{ multiple: true }} label="Permissions" value={apiForm.scopes} onChange={(e) => setApiForm({ ...apiForm, scopes: e.target.value })}>{scopeOptions.map((scope) => <MenuItem key={scope} value={scope}>{scope}</MenuItem>)}</TextField><DateField label="Expires On (optional)" value={apiForm.expiresAt} onChange={(e) => setApiForm({ ...apiForm, expiresAt: e.target.value })} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setApiOpen(false)}>Cancel</Button><Button variant="contained" onClick={submitApiApp}>Generate Credentials</Button></DialogActions>
      </Dialog>

      <Dialog open={webhookOpen} onClose={() => setWebhookOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Webhook Endpoint</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Endpoint Name" value={webhookForm.name} onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })} required /><TextField label="Endpoint URL" value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder="https://your-app.example/webhooks/erp" required /><TextField select label="Company Scope" value={webhookForm.companyId} onChange={(e) => setWebhookForm({ ...webhookForm, companyId: e.target.value })}><MenuItem value="">All companies</MenuItem>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField><TextField select SelectProps={{ multiple: true }} label="Events" value={webhookForm.events} onChange={(e) => setWebhookForm({ ...webhookForm, events: e.target.value })}>{eventOptions.map((event) => <MenuItem key={event} value={event}>{event}</MenuItem>)}</TextField></Stack></DialogContent>
        <DialogActions><Button onClick={() => setWebhookOpen(false)}>Cancel</Button><Button variant="contained" onClick={submitWebhook}>Create Endpoint</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(credential)} onClose={() => setCredential(null)} fullWidth maxWidth="sm">
        <DialogTitle>{credential?.title}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Alert severity="warning">Store this secret now. It will not be shown again.</Alert>{credential?.clientId && <TextField label="Client ID" value={credential.clientId} InputProps={{ readOnly: true }} />}<TextField label="Secret" value={credential?.secret || ''} InputProps={{ readOnly: true }} multiline /></Stack></DialogContent>
        <DialogActions><Button variant="contained" onClick={() => setCredential(null)}>Done</Button></DialogActions>
      </Dialog>
    </Grid>
  );
}

function Overview({ dashboard, installations, webhooks, onBrowse }) {
  const cards = [
    ['Available Add-ons', dashboard.available || 0, <ShopOutlined />],
    ['Active Extensions', dashboard.activeInstallations || 0, <AppstoreAddOutlined />],
    ['API Apps', dashboard.activeApiApps || 0, <ApiOutlined />],
    ['Monthly Cost', money(dashboard.monthlySpend), <CloudSyncOutlined />]
  ];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{cards.map(([label, value, icon]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></Box><Box sx={{ color: 'primary.main', fontSize: 24 }}>{icon}</Box></Stack></CardContent></Card></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, lg: 7 }}><Card variant="outlined"><CardContent><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}><Typography variant="h5">Installed Extensions</Typography><Button onClick={onBrowse}>Browse Marketplace</Button></Stack>{installations.length ? <Stack divider={<Divider flexItem />} spacing={1.5}>{installations.slice(0, 4).map((entry) => <Stack key={entry.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography fontWeight={600}>{entry.addon.name}</Typography><Typography variant="caption" color="text.secondary">{entry.addon.publisher} | v{entry.addon.version}</Typography></Box><StatusChip status={entry.status} /></Stack>)}</Stack> : <Alert severity="info">No add-ons installed yet.</Alert>}</CardContent></Card></Grid><Grid size={{ xs: 12, lg: 5 }}><Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 2 }}>Integration Health</Typography><Stack spacing={1.5}><Alert severity={dashboard.failingWebhooks ? 'warning' : 'success'}>{dashboard.activeWebhooks || 0} active webhooks, {dashboard.failingWebhooks || 0} need attention</Alert><Typography color="text.secondary">{webhooks.reduce((sum, hook) => sum + hook.successCount, 0)} successful deliveries across configured endpoints.</Typography></Stack></CardContent></Card></Grid></Grid></Stack>;
}

function Catalog({ addons, category, setCategory, search, setSearch, onInstall }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2}><TextField size="small" label="Search add-ons" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }} /><TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value)} sx={{ minWidth: 200 }}>{categories.map((item) => <MenuItem key={item} value={item}>{item === 'ALL' ? 'All categories' : item}</MenuItem>)}</TextField></Stack><Grid container spacing={2}>{addons.map((addon) => <Grid key={addon.id} size={{ xs: 12, md: 6, xl: 4 }}><Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}><CardContent sx={{ flexGrow: 1 }}><Stack direction="row" spacing={1} sx={{ mb: 1 }}><Chip size="small" label={addon.category} />{addon.isFeatured && <Chip size="small" color="primary" label="Featured" />}</Stack><Typography variant="h4">{addon.name}</Typography><Typography variant="caption" color="text.secondary">by {addon.publisher} | v{addon.version}</Typography><Typography sx={{ my: 2 }} color="text.secondary">{addon.description}</Typography><Stack spacing={0.75}>{(addon.features || []).map((feature) => <Stack key={feature} direction="row" spacing={1}><CheckCircleOutlined style={{ color: '#52c41a' }} /><Typography variant="body2">{feature}</Typography></Stack>)}</Stack></CardContent><CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}><Typography fontWeight={700}>{addon.pricingModel === 'FREE' ? 'Free' : `${money(addon.price)} / ${addon.pricingModel === 'ANNUAL' ? 'year' : 'month'}`}</Typography>{addon.installation ? <Chip color="success" label={addon.installation.status === 'TRIAL' ? 'Trial active' : 'Installed'} /> : <Button variant="contained" onClick={() => onInstall(addon)}>Install</Button>}</CardActions></Card></Grid>)}</Grid></Stack>;
}

function Installed({ installations, onStatus, onRemove }) {
  return <TableContainer><Table><TableHead><TableRow><TableCell>Add-on</TableCell><TableCell>Company</TableCell><TableCell>Plan</TableCell><TableCell>Status</TableCell><TableCell>Billing / Trial</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{installations.map((entry) => <TableRow key={entry.id}><TableCell><Typography fontWeight={600}>{entry.addon.name}</Typography><Typography variant="caption" color="text.secondary">v{entry.addon.version} by {entry.addon.publisher}</Typography></TableCell><TableCell>{entry.company?.name || 'All companies'}</TableCell><TableCell>{entry.plan}</TableCell><TableCell><StatusChip status={entry.status} /></TableCell><TableCell>{entry.status === 'TRIAL' ? `Trial ends ${date(entry.trialEndsAt)}` : entry.nextBillingAt ? date(entry.nextBillingAt) : 'No billing'}</TableCell><TableCell align="right"><Button size="small" startIcon={entry.status === 'SUSPENDED' ? <PlayCircleOutlined /> : <PauseCircleOutlined />} onClick={() => onStatus(entry, entry.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED')}>{entry.status === 'SUSPENDED' ? 'Resume' : 'Suspend'}</Button><Button size="small" color="error" startIcon={<DeleteOutlined />} onClick={() => onRemove(entry)}>Uninstall</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function ApiApps({ apps, onCreate, onRotate, onRevoke }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h5">API Applications</Typography><Typography color="text.secondary">Scoped credentials for external applications and integrations.</Typography></Box><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>Create App</Button></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Application</TableCell><TableCell>Client ID</TableCell><TableCell>Permissions</TableCell><TableCell>Last Used</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{apps.map((app) => <TableRow key={app.id}><TableCell><Typography fontWeight={600}>{app.name}</Typography><Typography variant="caption">{app.company?.name || 'All companies'}</Typography></TableCell><TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{app.clientId}</Typography><Typography variant="caption" color="text.secondary">{app.secretPreview}</Typography></TableCell><TableCell>{(app.scopes || []).map((scope) => <Chip key={scope} size="small" label={scope} sx={{ mr: 0.5, mb: 0.5 }} />)}</TableCell><TableCell>{date(app.lastUsedAt)}</TableCell><TableCell><StatusChip status={app.status} /></TableCell><TableCell align="right"><Button size="small" startIcon={<KeyOutlined />} disabled={app.status === 'REVOKED'} onClick={() => onRotate(app)}>Rotate</Button><Button size="small" color="error" disabled={app.status === 'REVOKED'} onClick={() => onRevoke(app)}>Revoke</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Stack>;
}

function Webhooks({ webhooks, onCreate, onTest, onStatus, onDelete }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h5">Event Webhooks</Typography><Typography color="text.secondary">Send signed ERP events to external systems and monitor delivery health.</Typography></Box><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>Add Endpoint</Button></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Endpoint</TableCell><TableCell>Events</TableCell><TableCell>Deliveries</TableCell><TableCell>Last Result</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{webhooks.map((hook) => <TableRow key={hook.id}><TableCell><Typography fontWeight={600}>{hook.name}</Typography><Typography variant="caption" color="text.secondary">{hook.url}</Typography></TableCell><TableCell>{(hook.events || []).map((event) => <Chip key={event} size="small" label={event} sx={{ mr: 0.5, mb: 0.5 }} />)}</TableCell><TableCell><Typography color="success.main">{hook.successCount} successful</Typography><Typography variant="caption" color="error">{hook.failureCount} failed</Typography></TableCell><TableCell>{hook.lastStatusCode || '-'}<Typography variant="caption" display="block" color="text.secondary">{date(hook.lastDeliveryAt)}</Typography></TableCell><TableCell><StatusChip status={hook.status} /></TableCell><TableCell align="right"><Button size="small" onClick={() => onTest(hook)} disabled={hook.status === 'PAUSED'}>Test</Button><Button size="small" onClick={() => onStatus(hook, hook.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}>{hook.status === 'PAUSED' ? 'Resume' : 'Pause'}</Button><Button size="small" color="error" onClick={() => onDelete(hook)}><DeleteOutlined /></Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Stack>;
}

function StatusChip({ status }) {
  const color = status === 'ACTIVE' || status === 'VERIFIED' ? 'success' : status === 'TRIAL' ? 'info' : status === 'FAILING' || status === 'REVOKED' ? 'error' : 'warning';
  return <Chip size="small" color={color} label={status} />;
}


