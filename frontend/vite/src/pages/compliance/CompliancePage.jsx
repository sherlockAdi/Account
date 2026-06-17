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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CalendarOutlined from '@ant-design/icons/CalendarOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import StopOutlined from '@ant-design/icons/StopOutlined';

import { useAuth } from 'contexts/AuthContext';

import DateField from 'components/DateField';
import { formatDate, todayIso, toIsoDate } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => todayIso();
const types = ['TAX', 'INVOICE', 'PAYROLL', 'NUMBERING', 'STATUTORY'];
const emptyRule = {
  id: '', name: '', code: '', type: 'TAX', companyId: '', country: 'India', state: '',
  effectiveFrom: today(), effectiveTo: '', description: '', configuration: '{\n  "rate": 18\n}', sourceUrl: '', notes: ''
};
const emptyObligation = { name: '', code: 'GSTR3B', periodLabel: 'June 2026', dueDate: '2026-07-20', assignedTo: 'Accounts Team', notes: '' };
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

export default function CompliancePage() {
  const { token } = useAuth();
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({ nextObligations: [], recentRules: [] });
  const [rules, setRules] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [readiness, setReadiness] = useState({ score: 0, checks: [] });
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({ type: '', status: '', onDate: '' });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [obligationOpen, setObligationOpen] = useState(false);
  const [obligationForm, setObligationForm] = useState(emptyObligation);
  const [filing, setFiling] = useState(null);
  const [referenceNo, setReferenceNo] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredRules = useMemo(() => rules.filter((rule) =>
    (!filters.type || rule.type === filters.type) &&
    (!filters.status || rule.status === filters.status) &&
    (!filters.onDate || (toIsoDate(rule.effectiveFrom) <= filters.onDate && (!rule.effectiveTo || toIsoDate(rule.effectiveTo) >= filters.onDate)))
  ), [rules, filters]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, ruleData, obligationData, readinessData, companyData] = await Promise.all([
        api('/compliance/dashboard', token), api('/compliance/rules', token), api('/compliance/obligations', token),
        api('/compliance/readiness', token), api('/companies', token)
      ]);
      setDashboard(dashboardData);
      setRules(ruleData);
      setObligations(obligationData);
      setReadiness(readinessData);
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

  function openRule(rule) {
    setRuleForm(rule ? {
      ...rule,
      companyId: rule.companyId || '',
      effectiveFrom: toIsoDate(rule.effectiveFrom),
      effectiveTo: toIsoDate(rule.effectiveTo),
      state: rule.state || '', description: rule.description || '', sourceUrl: rule.sourceUrl || '',
      notes: rule.notes || '', configuration: JSON.stringify(rule.configuration, null, 2)
    } : { ...emptyRule, companyId: companies[0]?.id || '' });
    setRuleOpen(true);
  }

  async function saveRule() {
    let configuration;
    try {
      configuration = JSON.parse(ruleForm.configuration);
    } catch {
      setError('Configuration must be valid JSON');
      return;
    }
    const payload = {
      ...ruleForm, configuration, companyId: ruleForm.companyId || undefined,
      state: ruleForm.state || undefined, effectiveTo: ruleForm.effectiveTo || undefined,
      sourceUrl: ruleForm.sourceUrl || undefined
    };
    delete payload.id;
    delete payload.status;
    delete payload.version;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.company;
    const result = await run(() => api(ruleForm.id ? `/compliance/rules/${ruleForm.id}` : '/compliance/rules', token, {
      method: ruleForm.id ? 'PATCH' : 'POST', body: JSON.stringify(payload)
    }), ruleForm.id ? 'Compliance rule updated' : 'New compliance rule version created');
    if (result) setRuleOpen(false);
  }

  async function saveObligation() {
    const result = await run(() => api('/compliance/obligations', token, {
      method: 'POST',
      body: JSON.stringify({ ...obligationForm, companyId: companies[0]?.id })
    }), 'Compliance obligation added');
    if (result) setObligationOpen(false);
  }

  async function fileObligation() {
    const result = await run(() => api(`/compliance/obligations/${filing.id}/status`, token, {
      method: 'PATCH', body: JSON.stringify({ status: 'FILED', referenceNo })
    }), `${filing.name} marked filed`);
    if (result) setFiling(null);
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box><Typography variant="h3">Compliance Rules</Typography><Typography color="text.secondary">Version statutory rules by jurisdiction and effective date, then monitor filing readiness.</Typography></Box>
          <Stack direction="row" spacing={1}><Button onClick={loadData} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button><Button variant="outlined" startIcon={<CalendarOutlined />} onClick={() => { setObligationForm(emptyObligation); setObligationOpen(true); }}>Add Obligation</Button><Button variant="contained" startIcon={<PlusOutlined />} onClick={() => openRule()}>New Rule Version</Button></Stack>
        </Stack>
      </Grid>
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Overview" /><Tab label={`Rule Register (${rules.length})`} /><Tab label="Filing Calendar" /><Tab label="Readiness" />
          </Tabs>
          {tab === 0 && <Overview dashboard={dashboard} readiness={readiness} onRules={() => setTab(1)} />}
          {tab === 1 && <RuleRegister rules={filteredRules} filters={filters} setFilters={setFilters} onEdit={openRule} onStatus={(rule, status) => run(() => api(`/compliance/rules/${rule.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }), `${rule.code} marked ${status.toLowerCase()}`)} />}
          {tab === 2 && <FilingCalendar obligations={obligations} onStatus={(item, status) => status === 'FILED' ? (setFiling(item), setReferenceNo('')) : run(() => api(`/compliance/obligations/${item.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }), `${item.name} marked ${status.toLowerCase()}`)} onAdd={() => setObligationOpen(true)} />}
          {tab === 3 && <Readiness readiness={readiness} />}
        </Box>
      </Grid>

      <Dialog open={ruleOpen} onClose={() => setRuleOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{ruleForm.id ? `Edit ${ruleForm.code} v${ruleForm.version}` : 'Create Compliance Rule Version'}</DialogTitle>
        <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Rule Name" value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} required /></Grid>
          <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Rule Code" value={ruleForm.code} onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })} required /></Grid>
          <Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="Type" value={ruleForm.type} onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value })}>{types.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Company Scope" value={ruleForm.companyId} onChange={(e) => setRuleForm({ ...ruleForm, companyId: e.target.value })}><MenuItem value="">All companies</MenuItem>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Country" value={ruleForm.country} onChange={(e) => setRuleForm({ ...ruleForm, country: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="State / Jurisdiction" value={ruleForm.state} onChange={(e) => setRuleForm({ ...ruleForm, state: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><DateField fullWidth label="Effective From" value={ruleForm.effectiveFrom} onChange={(e) => setRuleForm({ ...ruleForm, effectiveFrom: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><DateField fullWidth label="Effective To" value={ruleForm.effectiveTo} onChange={(e) => setRuleForm({ ...ruleForm, effectiveTo: e.target.value })} /></Grid>
          <Grid size={12}><TextField fullWidth label="Description" value={ruleForm.description} onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })} /></Grid>
          <Grid size={12}><TextField fullWidth multiline minRows={5} label="Rule Configuration (JSON)" value={ruleForm.configuration} onChange={(e) => setRuleForm({ ...ruleForm, configuration: e.target.value })} helperText="Store rates, thresholds, required fields, numbering patterns, or other structured rule values." /></Grid>
          <Grid size={12}><TextField fullWidth label="Official Source URL" value={ruleForm.sourceUrl} onChange={(e) => setRuleForm({ ...ruleForm, sourceUrl: e.target.value })} /></Grid>
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setRuleOpen(false)}>Cancel</Button><Button variant="contained" onClick={saveRule}>Save Draft</Button></DialogActions>
      </Dialog>

      <Dialog open={obligationOpen} onClose={() => setObligationOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Filing Obligation</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Obligation" value={obligationForm.name} onChange={(e) => setObligationForm({ ...obligationForm, name: e.target.value })} /><TextField label="Code" value={obligationForm.code} onChange={(e) => setObligationForm({ ...obligationForm, code: e.target.value })} /><TextField label="Period" value={obligationForm.periodLabel} onChange={(e) => setObligationForm({ ...obligationForm, periodLabel: e.target.value })} /><DateField label="Due Date" value={obligationForm.dueDate} onChange={(e) => setObligationForm({ ...obligationForm, dueDate: e.target.value })} /><TextField label="Assigned To" value={obligationForm.assignedTo} onChange={(e) => setObligationForm({ ...obligationForm, assignedTo: e.target.value })} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setObligationOpen(false)}>Cancel</Button><Button variant="contained" onClick={saveObligation}>Add Obligation</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(filing)} onClose={() => setFiling(null)} fullWidth maxWidth="xs">
        <DialogTitle>Mark {filing?.name} Filed</DialogTitle>
        <DialogContent><TextField fullWidth sx={{ mt: 1 }} label="Acknowledgement / Reference No" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} /></DialogContent>
        <DialogActions><Button onClick={() => setFiling(null)}>Cancel</Button><Button variant="contained" onClick={fileObligation}>Confirm Filing</Button></DialogActions>
      </Dialog>
    </Grid>
  );
}

function Overview({ dashboard, readiness, onRules }) {
  const cards = [['Effective Rules', dashboard.activeRules || 0], ['Draft Versions', dashboard.draftRules || 0], ['Due in 30 Days', dashboard.upcomingObligations || 0], ['Overdue', dashboard.overdueObligations || 0]];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, lg: 7 }}><Card variant="outlined"><CardContent><Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2 }}><Typography variant="h5">Upcoming Obligations</Typography><Button onClick={onRules}>Manage Rules</Button></Stack><Stack spacing={1.5}>{dashboard.nextObligations?.map((item) => <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography fontWeight={600}>{item.name} - {item.periodLabel}</Typography><Typography variant="caption" color="text.secondary">Due {formatDate(item.dueDate)}</Typography></Box><Status status={item.status} /></Stack>)}</Stack></CardContent></Card></Grid><Grid size={{ xs: 12, lg: 5 }}><Card variant="outlined"><CardContent><Typography variant="h5">Compliance Readiness</Typography><Typography variant="h2" sx={{ mt: 2 }}>{readiness.score}%</Typography><LinearProgress variant="determinate" value={readiness.score} color={readiness.score >= 80 ? 'success' : 'warning'} sx={{ my: 2, height: 8, borderRadius: 4 }} /><Typography color="text.secondary">{dashboard.itemTaxPeriods || 0} item tax periods and {dashboard.salaryStructures || 0} active salary structures are monitored.</Typography></CardContent></Card></Grid></Grid></Stack>;
}

function RuleRegister({ rules, filters, setFilters, onEdit, onStatus }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2}><TextField select size="small" label="Rule Type" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} sx={{ minWidth: 180 }}><MenuItem value="">All types</MenuItem>{types.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField><TextField select size="small" label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} sx={{ minWidth: 160 }}><MenuItem value="">All statuses</MenuItem>{['DRAFT', 'ACTIVE', 'ARCHIVED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField><DateField size="small" label="Effective On" value={filters.onDate} onChange={(e) => setFilters({ ...filters, onDate: e.target.value })} /></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Rule</TableCell><TableCell>Type</TableCell><TableCell>Jurisdiction</TableCell><TableCell>Effective Period</TableCell><TableCell>Scope</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{rules.map((rule) => <TableRow key={rule.id}><TableCell><Typography fontWeight={600}>{rule.name}</Typography><Typography variant="caption">{rule.code} v{rule.version}</Typography></TableCell><TableCell>{rule.type}</TableCell><TableCell>{rule.country}{rule.state ? ` / ${rule.state}` : ''}</TableCell><TableCell>{formatDate(rule.effectiveFrom)} to {formatDate(rule.effectiveTo, 'Open ended')}</TableCell><TableCell>{rule.company?.name || 'All companies'}</TableCell><TableCell><Status status={rule.status} /></TableCell><TableCell align="right">{rule.status !== 'ACTIVE' && <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(rule)}>Edit</Button>}{rule.status === 'DRAFT' && <Button size="small" color="success" onClick={() => onStatus(rule, 'ACTIVE')}>Activate</Button>}{rule.status === 'ACTIVE' && <Button size="small" color="warning" onClick={() => onStatus(rule, 'ARCHIVED')}>Archive</Button>}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Stack>;
}

function FilingCalendar({ obligations, onStatus, onAdd }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h5">Statutory Filing Calendar</Typography><Typography color="text.secondary">Track preparation, filing, and acknowledgement references.</Typography></Box><Button variant="contained" startIcon={<PlusOutlined />} onClick={onAdd}>Add Obligation</Button></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Due Date</TableCell><TableCell>Obligation</TableCell><TableCell>Period</TableCell><TableCell>Owner</TableCell><TableCell>Status</TableCell><TableCell>Reference</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>{obligations.map((item) => <TableRow key={item.id}><TableCell>{formatDate(item.dueDate)}</TableCell><TableCell><Typography fontWeight={600}>{item.name}</Typography><Typography variant="caption">{item.code}</Typography></TableCell><TableCell>{item.periodLabel}</TableCell><TableCell>{item.assignedTo || '-'}</TableCell><TableCell><Status status={item.status} /></TableCell><TableCell>{item.referenceNo || '-'}</TableCell><TableCell align="right">{item.status === 'PENDING' && <Button size="small" onClick={() => onStatus(item, 'READY')}>Mark Ready</Button>}{item.status !== 'FILED' && <Button size="small" color="success" onClick={() => onStatus(item, 'FILED')}>File</Button>}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Stack>;
}

function Readiness({ readiness }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Card variant="outlined"><CardContent><Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}><SafetyCertificateOutlined style={{ fontSize: 48, color: readiness.score >= 80 ? '#52c41a' : '#faad14' }} /><Box sx={{ flexGrow: 1 }}><Typography variant="h4">Readiness Score: {readiness.score}%</Typography><LinearProgress variant="determinate" value={readiness.score} color={readiness.score >= 80 ? 'success' : 'warning'} sx={{ mt: 1.5, height: 10, borderRadius: 5 }} /></Box></Stack></CardContent></Card><Grid container spacing={2}>{readiness.checks?.map((check) => <Grid key={check.key} size={{ xs: 12, md: 6 }}><Card variant="outlined"><CardContent><Stack direction="row" spacing={2}>{check.passed ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} /> : <StopOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />}<Box><Typography fontWeight={600}>{check.label}</Typography><Typography color="text.secondary">{check.detail}</Typography></Box></Stack></CardContent></Card></Grid>)}</Grid></Stack>;
}

function Status({ status }) {
  const color = ['ACTIVE', 'READY', 'FILED'].includes(status) ? 'success' : status === 'DRAFT' || status === 'PENDING' ? 'warning' : status === 'OVERDUE' ? 'error' : 'default';
  const icon = status === 'OVERDUE' ? <ClockCircleOutlined /> : undefined;
  return <Chip size="small" color={color} icon={icon} label={status} />;
}




