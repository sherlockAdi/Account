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
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import StopOutlined from '@ant-design/icons/StopOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import { useAuth } from 'contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const when = (value) => value ? new Date(value).toLocaleString('en-IN') : '-';
const modules = ['accounting', 'purchase', 'sales', 'banking', 'inventory', 'payroll', 'marketplace'];
const entityTypes = {
  accounting: 'voucher', purchase: 'purchase_invoice', sales: 'sales_invoice', banking: 'payment_advice',
  inventory: 'stock_adjustment', payroll: 'payroll_run', marketplace: 'addon_installation'
};

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

export default function ApprovalsPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({ inbox: [], recent: [] });
  const [requests, setRequests] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [history, setHistory] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [decision, setDecision] = useState(null);
  const [decisionForm, setDecisionForm] = useState({ decision: 'APPROVED', comments: '' });
  const [detail, setDetail] = useState(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ policyId: '', companyId: '', entityId: '', entityNumber: '', title: '', amount: 0, notes: '' });
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    name: '', code: '', module: 'accounting', entityType: 'voucher', companyId: '', minAmount: 0, maxAmount: '',
    description: '', steps: [{ name: 'Manager Review', approverRoleCode: 'admin', minApprovals: 1, escalationHours: 24 }]
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState({});
  const [referenceLoaded, setReferenceLoaded] = useState(false);

  const filteredRequests = useMemo(() => requests.filter((item) => !statusFilter || item.status === statusFilter), [requests, statusFilter]);
  const selectedPolicy = policies.find((item) => item.id === requestForm.policyId);

  async function ensureReferenceData() {
    if (referenceLoaded && policies.length && roles.length && companies.length) return { policyData: policies, roleData: roles, companyData: companies };
    const [policyData, roleData, companyData] = await Promise.all([
      policies.length ? Promise.resolve(policies) : api('/approvals/policies', token),
      roles.length ? Promise.resolve(roles) : api('/identity/roles', token),
      companies.length ? Promise.resolve(companies) : api('/companies', token)
    ]);
    setPolicies(policyData);
    setRoles(roleData);
    setCompanies(companyData);
    setReferenceLoaded(true);
    return { policyData, roleData, companyData };
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setLoading(true);
      setError('');
      if (tabIndex === 0) setDashboard(await api('/approvals/dashboard', token));
      if (tabIndex === 1 || tabIndex === 2) setRequests(await api('/approvals/requests', token));
      if (tabIndex === 3) {
        setPolicies(await api('/approvals/policies', token));
        await ensureReferenceData();
      }
      if (tabIndex === 4) setHistory(await api('/approvals/history', token));
      setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTabData(tab); }, [tab]);

  async function run(action, success) {
    try {
      setError('');
      setMessage('');
      const result = await action();
      setMessage(success);
      await loadTabData(tab, true);
      return result;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    }
  }

  async function openRequest() {
    const { policyData, companyData } = await ensureReferenceData();
    const policy = policyData.find((item) => item.isActive);
    setRequestForm({ policyId: policy?.id || '', companyId: companyData[0]?.id || '', entityId: '', entityNumber: '', title: '', amount: 0, notes: '' });
    setRequestOpen(true);
  }

  async function submitRequest() {
    const policy = policies.find((item) => item.id === requestForm.policyId);
    if (!policy) return setError('Select an approval policy');
    const result = await run(() => api('/approvals/requests', token, {
      method: 'POST',
      body: JSON.stringify({
        ...requestForm, companyId: requestForm.companyId || undefined, amount: Number(requestForm.amount),
        module: policy.module, entityType: policy.entityType
      })
    }), 'Approval request submitted');
    if (result) setRequestOpen(false);
  }

  async function submitDecision() {
    const result = await run(() => api(`/approvals/requests/${decision.id}/decision`, token, {
      method: 'POST', body: JSON.stringify(decisionForm)
    }), `Request ${decisionForm.decision.toLowerCase()}`);
    if (result) setDecision(null);
  }

  function updateStep(index, changes) {
    setPolicyForm({ ...policyForm, steps: policyForm.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...changes } : step) });
  }

  async function submitPolicy() {
    const result = await run(() => api('/approvals/policies', token, {
      method: 'POST',
      body: JSON.stringify({
        ...policyForm, companyId: policyForm.companyId || undefined,
        minAmount: Number(policyForm.minAmount || 0), maxAmount: policyForm.maxAmount === '' ? undefined : Number(policyForm.maxAmount),
        steps: policyForm.steps.map((step) => ({ ...step, minApprovals: Number(step.minApprovals), escalationHours: step.escalationHours ? Number(step.escalationHours) : undefined }))
      })
    }), 'Approval policy created');
    if (result) setPolicyOpen(false);
  }

  function openDecision(request, type) {
    setDecision(request);
    setDecisionForm({ decision: type, comments: '' });
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', p: 2, pb: 0 }}><Chip icon={<SafetyCertificateOutlined />} color="primary" label={`Approver: ${user?.fullName || user?.email}`} /><Button onClick={() => loadTabData(tab, true)} disabled={loading}>Refresh</Button><Button variant="contained" startIcon={<PlusOutlined />} onClick={openRequest}>Submit Request</Button></Stack>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Overview" /><Tab label={`My Inbox (${dashboard.myPending || 0})`} /><Tab label="All Requests" /><Tab label="Policies" /><Tab label="Decision History" />
          </Tabs>
          {tab === 0 && <Overview dashboard={dashboard} onInbox={() => setTab(1)} />}
          {tab === 1 && <RequestTable requests={requests.filter((item) => item.canApprove && item.status === 'PENDING')} onDetail={setDetail} onDecision={openDecision} empty="No requests are waiting for your approval." />}
          {tab === 2 && <AllRequests requests={filteredRequests} status={statusFilter} setStatus={setStatusFilter} onDetail={setDetail} onDecision={openDecision} />}
          {tab === 3 && <Policies policies={policies} onCreate={async () => { await ensureReferenceData(); setPolicyOpen(true); }} onToggle={(policy) => run(() => api(`/approvals/policies/${policy.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ isActive: !policy.isActive }) }), `${policy.name} ${policy.isActive ? 'disabled' : 'enabled'}`)} />}
          {tab === 4 && <History history={history} />}
        </Box>
      </Grid>

      <Dialog open={Boolean(decision)} onClose={() => setDecision(null)} fullWidth maxWidth="sm">
        <DialogTitle>{decisionForm.decision === 'APPROVED' ? 'Approve' : 'Reject'} {decision?.entityNumber || decision?.title}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Alert severity={decisionForm.decision === 'APPROVED' ? 'success' : 'warning'}>{decision?.title} | {money(decision?.amount)}</Alert><TextField multiline minRows={3} label="Comments" value={decisionForm.comments} onChange={(e) => setDecisionForm({ ...decisionForm, comments: e.target.value })} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setDecision(null)}>Cancel</Button><Button color={decisionForm.decision === 'APPROVED' ? 'success' : 'error'} variant="contained" onClick={submitDecision}>{decisionForm.decision === 'APPROVED' ? 'Approve' : 'Reject'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md">
        <DialogTitle>Approval Request Details</DialogTitle>
        <DialogContent>{detail && <Stack spacing={2} sx={{ mt: 1 }}><Grid container spacing={2}><Detail label="Request" value={detail.title} /><Detail label="Reference" value={detail.entityNumber || detail.entityId} /><Detail label="Maker" value={detail.maker.fullName} /><Detail label="Amount" value={money(detail.amount)} /><Detail label="Policy" value={detail.policy.name} /><Detail label="Status" value={detail.status} /></Grid><Alert severity={detail.dueAt && new Date(detail.dueAt) < new Date() ? 'warning' : 'info'}>Current step {detail.currentStep}: {detail.policy.steps.find((step) => step.sequence === detail.currentStep)?.name || 'Completed'} | Due {when(detail.dueAt)}</Alert><Typography variant="h5">Approval Trail</Typography>{detail.decisions.length ? detail.decisions.map((item) => <Stack key={item.id} direction="row" spacing={1}><Status status={item.decision} /><Typography>{item.approver.fullName}: {item.comments || 'No comments'} ({when(item.createdAt)})</Typography></Stack>) : <Typography color="text.secondary">No decisions recorded yet.</Typography>}</Stack>}</DialogContent>
        <DialogActions>{detail && <Button href={`/${detail.module}`}>Open {detail.module}</Button>}<Button variant="contained" onClick={() => setDetail(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={requestOpen} onClose={() => setRequestOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Submit Approval Request</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField select label="Approval Policy" value={requestForm.policyId} onChange={(e) => setRequestForm({ ...requestForm, policyId: e.target.value })}>{policies.filter((item) => item.isActive).map((policy) => <MenuItem key={policy.id} value={policy.id}>{policy.name} ({policy.module})</MenuItem>)}</TextField><TextField select label="Company" value={requestForm.companyId} onChange={(e) => setRequestForm({ ...requestForm, companyId: e.target.value })}>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField><TextField label="Request Title" value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} /><Grid container spacing={2}><Grid size={6}><TextField fullWidth label="Reference Number" value={requestForm.entityNumber} onChange={(e) => setRequestForm({ ...requestForm, entityNumber: e.target.value })} /></Grid><Grid size={6}><TextField fullWidth label="Record ID" value={requestForm.entityId} onChange={(e) => setRequestForm({ ...requestForm, entityId: e.target.value })} /></Grid></Grid><TextField type="number" label="Amount" value={requestForm.amount} onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })} helperText={selectedPolicy ? `Policy range: ${money(selectedPolicy.minAmount)} to ${selectedPolicy.maxAmount ? money(selectedPolicy.maxAmount) : 'No limit'}` : ''} /><TextField multiline minRows={2} label="Submission Notes" value={requestForm.notes} onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setRequestOpen(false)}>Cancel</Button><Button variant="contained" onClick={submitRequest}>Submit for Approval</Button></DialogActions>
      </Dialog>

      <Dialog open={policyOpen} onClose={() => setPolicyOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Approval Policy</DialogTitle>
        <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}><Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Policy Name" value={policyForm.name} onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Code" value={policyForm.code} onChange={(e) => setPolicyForm({ ...policyForm, code: e.target.value.toUpperCase() })} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="Company Scope" value={policyForm.companyId} onChange={(e) => setPolicyForm({ ...policyForm, companyId: e.target.value })}><MenuItem value="">All companies</MenuItem>{companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField></Grid><Grid size={4}><TextField select fullWidth label="Module" value={policyForm.module} onChange={(e) => setPolicyForm({ ...policyForm, module: e.target.value, entityType: entityTypes[e.target.value] })}>{modules.map((module) => <MenuItem key={module} value={module}>{module}</MenuItem>)}</TextField></Grid><Grid size={4}><TextField fullWidth label="Minimum Amount" type="number" value={policyForm.minAmount} onChange={(e) => setPolicyForm({ ...policyForm, minAmount: e.target.value })} /></Grid><Grid size={4}><TextField fullWidth label="Maximum Amount" type="number" value={policyForm.maxAmount} onChange={(e) => setPolicyForm({ ...policyForm, maxAmount: e.target.value })} /></Grid><Grid size={12}><TextField fullWidth label="Description" value={policyForm.description} onChange={(e) => setPolicyForm({ ...policyForm, description: e.target.value })} /></Grid><Grid size={12}><Divider><Chip label="Approval Chain" /></Divider></Grid>{policyForm.steps.map((step, index) => <Grid key={index} size={12}><Card variant="outlined"><CardContent><Grid container spacing={2}><Grid size={1}><Typography variant="h4">{index + 1}</Typography></Grid><Grid size={4}><TextField fullWidth label="Step Name" value={step.name} onChange={(e) => updateStep(index, { name: e.target.value })} /></Grid><Grid size={3}><TextField select fullWidth label="Approver Role" value={step.approverRoleCode} onChange={(e) => updateStep(index, { approverRoleCode: e.target.value })}>{roles.map((role) => <MenuItem key={role.id} value={role.code}>{role.name}</MenuItem>)}</TextField></Grid><Grid size={2}><TextField fullWidth type="number" label="Approvals" value={step.minApprovals} onChange={(e) => updateStep(index, { minApprovals: e.target.value })} /></Grid><Grid size={2}><TextField fullWidth type="number" label="SLA Hours" value={step.escalationHours} onChange={(e) => updateStep(index, { escalationHours: e.target.value })} /></Grid></Grid></CardContent></Card></Grid>)}<Grid size={12}><Button onClick={() => setPolicyForm({ ...policyForm, steps: [...policyForm.steps, { name: `Level ${policyForm.steps.length + 1} Review`, approverRoleCode: roles[0]?.code || 'admin', minApprovals: 1, escalationHours: 24 }] })}>Add Approval Level</Button></Grid></Grid></DialogContent>
        <DialogActions><Button onClick={() => setPolicyOpen(false)}>Cancel</Button><Button variant="contained" onClick={submitPolicy}>Create Policy</Button></DialogActions>
      </Dialog>
    </Grid>
  );
}

function Overview({ dashboard, onInbox }) {
  const cards = [['Pending Requests', dashboard.pending || 0], ['My Inbox', dashboard.myPending || 0], ['Overdue SLA', dashboard.overdue || 0], ['Pending Value', money(dashboard.pendingValue)]];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, lg: 7 }}><Card variant="outlined"><CardContent><Stack direction="row" sx={{ justifyContent: 'space-between', mb: 2 }}><Typography variant="h5">Waiting for You</Typography><Button onClick={onInbox}>Open Inbox</Button></Stack>{dashboard.inbox?.length ? <Stack divider={<Divider />} spacing={1.5}>{dashboard.inbox.map((item) => <Stack key={item.id} direction="row" sx={{ justifyContent: 'space-between' }}><Box><Typography fontWeight={600}>{item.title}</Typography><Typography variant="caption">{item.entityNumber} | Maker: {item.maker.fullName}</Typography></Box><Typography fontWeight={700}>{money(item.amount)}</Typography></Stack>)}</Stack> : <Alert severity="success">Your approval inbox is clear.</Alert>}</CardContent></Card></Grid><Grid size={{ xs: 12, lg: 5 }}><Card variant="outlined"><CardContent><Typography variant="h5">Workflow Health</Typography><Stack spacing={1.5} sx={{ mt: 2 }}><Alert severity={dashboard.overdue ? 'warning' : 'success'}>{dashboard.overdue || 0} requests have crossed their SLA.</Alert><Typography color="text.secondary">{dashboard.activePolicies || 0} active policies. {dashboard.approvedThisMonth || 0} requests approved this month.</Typography></Stack></CardContent></Card></Grid></Grid></Stack>;
}

function AllRequests({ requests, status, setStatus, onDetail, onDecision }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 180 }}><MenuItem value="">All statuses</MenuItem>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField><RequestTable requests={requests} onDetail={onDetail} onDecision={onDecision} /></Stack>;
}

function RequestTable({ requests, onDetail, onDecision, empty }) {
  if (!requests.length) return <Alert severity="info" sx={{ m: 2.5 }}>{empty || 'No approval requests found.'}</Alert>;
  const rows = requests.map((item) => {
    const current = item.policy.steps.find((step) => step.sequence === item.currentStep);
    const overdue = item.status === 'PENDING' && item.dueAt && new Date(item.dueAt) < new Date();
    return {
      ...item,
      requestText: `${item.title} | ${item.entityNumber || item.entityId || ''}`,
      makerName: item.maker.fullName,
      amountText: money(item.amount),
      levelText: item.status === 'PENDING' ? `${item.currentStep}. ${current?.name || ''}` : 'Complete',
      slaText: item.dueAt ? when(item.dueAt) : '-',
      dueDate: item.dueAt,
      overdueText: overdue ? 'Overdue' : 'On time'
    };
  });
  return (
    <CommonDataGrid
      title="Approval Requests"
      rows={rows}
      columns={[
        { field: 'requestText', headerName: 'Request', flex: 1.2, minWidth: 220 },
        { field: 'module', headerName: 'Module', width: 130 },
        { field: 'makerName', headerName: 'Maker', flex: 1, minWidth: 160 },
        { field: 'amountText', headerName: 'Amount', width: 140, align: 'right', headerAlign: 'right' },
        { field: 'levelText', headerName: 'Current Level', flex: 1, minWidth: 160 },
        { field: 'slaText', headerName: 'SLA', width: 190, renderCell: ({ row }) => <Chip size="small" color={row.overdueText === 'Overdue' ? 'error' : 'default'} icon={row.overdueText === 'Overdue' ? <ClockCircleOutlined /> : undefined} label={row.slaText} /> },
        { field: 'status', headerName: 'Status', width: 130, renderCell: ({ value }) => <Status status={value} /> },
        { field: 'actions', headerName: 'Actions', width: 250, sortable: false, filterable: false, renderCell: ({ row }) => <Stack direction="row" spacing={0.5}><Button size="small" startIcon={<EyeOutlined />} onClick={() => onDetail(row)}>View</Button>{row.canApprove && <><Button size="small" color="success" onClick={() => onDecision(row, 'APPROVED')}>Approve</Button><Button size="small" color="error" onClick={() => onDecision(row, 'REJECTED')}>Reject</Button></>}</Stack> }
      ]}
      searchPlaceholder="Search request, reference, maker, or module"
      dateField="dueDate"
      selectFilters={[
        { field: 'module', label: 'Module' },
        { field: 'status', label: 'Status' },
        { field: 'overdueText', label: 'SLA' }
      ]}
      fileName="approval-requests"
    />
  );
}

function Policies({ policies, onCreate, onToggle }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box><Typography variant="h5">Approval Policies</Typography><Typography color="text.secondary">Configure amount thresholds, approver roles, levels, and escalation SLAs.</Typography></Box><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>New Policy</Button></Stack><Grid container spacing={2}>{policies.map((policy) => <Grid key={policy.id} size={{ xs: 12, lg: 6 }}><Card variant="outlined"><CardContent><Stack direction="row" sx={{ justifyContent: 'space-between' }}><Box><Typography variant="h4">{policy.name}</Typography><Typography variant="caption">{policy.code} | {policy.module}.{policy.entityType}</Typography></Box><Status status={policy.isActive ? 'ACTIVE' : 'DISABLED'} /></Stack><Typography color="text.secondary" sx={{ my: 1.5 }}>{policy.description || 'No description'}</Typography><Typography fontWeight={600}>Range: {money(policy.minAmount)} to {policy.maxAmount ? money(policy.maxAmount) : 'No limit'}</Typography><Stack spacing={1} sx={{ mt: 2 }}>{policy.steps.map((step) => <Stack key={step.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}><Chip size="small" label={step.sequence} /><Typography>{step.name} ({step.approverRoleCode})</Typography><Typography variant="caption" color="text.secondary">{step.escalationHours ? `${step.escalationHours}h SLA` : ''}</Typography></Stack>)}</Stack><Button sx={{ mt: 2 }} color={policy.isActive ? 'warning' : 'success'} onClick={() => onToggle(policy)}>{policy.isActive ? 'Disable Policy' : 'Enable Policy'}</Button></CardContent></Card></Grid>)}</Grid></Stack>;
}

function History({ history }) {
  const rows = history.map((item) => ({
    ...item,
    dateText: when(item.createdAt),
    createdDate: item.createdAt,
    requestText: `${item.request.title} | ${item.request.entityNumber || ''}`,
    stepName: item.step.name,
    approverName: item.approver.fullName,
    commentsText: item.comments || '-'
  }));
  return (
    <CommonDataGrid
      title="Decision History"
      rows={rows}
      columns={[
        { field: 'dateText', headerName: 'Date', width: 190 },
        { field: 'requestText', headerName: 'Request', flex: 1.2, minWidth: 220 },
        { field: 'stepName', headerName: 'Step', flex: 1, minWidth: 160 },
        { field: 'approverName', headerName: 'Approver', flex: 1, minWidth: 160 },
        { field: 'decision', headerName: 'Decision', width: 130, renderCell: ({ value }) => <Status status={value} /> },
        { field: 'commentsText', headerName: 'Comments', flex: 1, minWidth: 180 }
      ]}
      searchPlaceholder="Search request, approver, decision, or comments"
      dateField="createdDate"
      selectFilters={[{ field: 'decision', label: 'Decision' }, { field: 'approverName', label: 'Approver' }]}
      fileName="approval-history"
    />
  );
}

function Detail({ label, value }) {
  return <Grid size={{ xs: 12, md: 6 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography>{value || '-'}</Typography></Grid>;
}

function Status({ status }) {
  const color = ['APPROVED', 'ACTIVE'].includes(status) ? 'success' : ['REJECTED', 'OVERDUE'].includes(status) ? 'error' : status === 'PENDING' ? 'warning' : 'default';
  const icon = status === 'APPROVED' ? <CheckCircleOutlined /> : status === 'REJECTED' ? <StopOutlined /> : undefined;
  return <Chip size="small" color={color} icon={icon} label={status} />;
}
