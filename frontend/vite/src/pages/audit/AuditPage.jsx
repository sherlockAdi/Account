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

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import StopOutlined from '@ant-design/icons/StopOutlined';

import { useAuth } from 'contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

async function api(path, token, options) {
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

export default function AuditPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({ voucherVerification: {}, recent: [] });
  const [logs, setLogs] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [security, setSecurity] = useState({ recentSecurityEvents: [] });
  const [filters, setFilters] = useState({ module: '', outcome: '', from: '2026-06-01', to: today() });
  const [selectedLog, setSelectedLog] = useState(null);
  const [verifyVoucher, setVerifyVoucher] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ status: 'VERIFIED', remarks: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const modules = useMemo(() => [...new Set(logs.map((log) => log.module))].sort(), [logs]);
  const editLogs = useMemo(() => logs.filter((log) => ['UPDATE', 'DELETE'].includes(log.action)), [logs]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
      const [dashboardData, logData, voucherData, securityData] = await Promise.all([
        api('/audit/dashboard', token),
        api(`/audit/logs?${query}`, token),
        api('/audit/vouchers', token),
        api('/audit/security', token)
      ]);
      setDashboard(dashboardData);
      setLogs(logData);
      setVouchers(voucherData);
      setSecurity(securityData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function submitVerification() {
    try {
      setError('');
      await api(`/audit/vouchers/${verifyVoucher.id}/verify`, token, {
        method: 'PATCH',
        body: JSON.stringify(verifyForm)
      });
      setVerifyVoucher(null);
      setMessage(`Voucher marked ${verifyForm.status.toLowerCase()}`);
      await loadData();
    } catch (verifyError) {
      setError(verifyError.message);
    }
  }

  function openVerification(voucher, status) {
    setVerifyVoucher(voucher);
    setVerifyForm({ status, remarks: voucher.verification?.remarks || '' });
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box><Typography variant="h3">Audit & Security Control</Typography><Typography color="text.secondary">Immutable activity history, edit review, voucher verification and security monitoring.</Typography></Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Chip icon={<SafetyCertificateOutlined />} color="primary" label={`Reviewer: ${user?.fullName || user?.email}`} /><Button variant="contained" onClick={loadData} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button></Stack>
        </Stack>
      </Grid>
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Dashboard" /><Tab label="Audit Log" /><Tab label="Edit Log" /><Tab label="Voucher Verification" /><Tab label="Security" />
          </Tabs>
          {tab === 0 && <Dashboard dashboard={dashboard} onInspect={setSelectedLog} />}
          {tab === 1 && <AuditLog logs={logs} filters={filters} setFilters={setFilters} modules={modules} onApply={loadData} onInspect={setSelectedLog} />}
          {tab === 2 && <EditLog logs={editLogs} onInspect={setSelectedLog} />}
          {tab === 3 && <VoucherVerification vouchers={vouchers} onVerify={openVerification} />}
          {tab === 4 && <Security security={security} />}
        </Box>
      </Grid>

      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} fullWidth maxWidth="md">
        <DialogTitle>Audit Event Details</DialogTitle>
        <DialogContent>{selectedLog && <Stack spacing={2} sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Detail label="Event" value={`${selectedLog.module}.${selectedLog.action}`} />
            <Detail label="Outcome" value={selectedLog.outcome} />
            <Detail label="User" value={selectedLog.user?.fullName || selectedLog.user?.email || 'System / Anonymous'} />
            <Detail label="Time" value={new Date(selectedLog.createdAt).toLocaleString()} />
            <Detail label="Method / Path" value={`${selectedLog.method || '-'} ${selectedLog.path || '-'}`} wide />
            <Detail label="IP Address" value={selectedLog.ipAddress || '-'} />
          </Grid>
          <Typography variant="h5">Sanitized Changes</Typography><JsonBlock value={selectedLog.changes} />
          <Typography variant="h5">Execution Metadata</Typography><JsonBlock value={selectedLog.metadata} />
        </Stack>}</DialogContent>
        <DialogActions><Button variant="contained" onClick={() => setSelectedLog(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(verifyVoucher)} onClose={() => setVerifyVoucher(null)} fullWidth maxWidth="sm">
        <DialogTitle>{verifyForm.status === 'VERIFIED' ? 'Verify' : 'Reject'} Voucher: {verifyVoucher?.voucherNo}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Alert severity={verifyForm.status === 'VERIFIED' ? 'success' : 'warning'}>Debit and credit totals: {money(verifyVoucher?.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0))}</Alert><TextField multiline minRows={3} label="Review Remarks" value={verifyForm.remarks} onChange={(event) => setVerifyForm({ ...verifyForm, remarks: event.target.value })} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setVerifyVoucher(null)}>Cancel</Button><Button color={verifyForm.status === 'VERIFIED' ? 'success' : 'error'} variant="contained" onClick={submitVerification}>Confirm {verifyForm.status}</Button></DialogActions>
      </Dialog>
    </Grid>
  );
}

function Dashboard({ dashboard, onInspect }) {
  const verification = dashboard.voucherVerification || {};
  const cards = [['Total Events', dashboard.totalEvents || 0], ['Mutations (24h)', dashboard.mutations24h || 0], ['Failures (24h)', dashboard.failures24h || 0], ['Verified Vouchers', `${verification.verified || 0}/${verification.total || 0}`]];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><Grid container spacing={2}><Grid size={{ xs: 12, md: 4 }}><Card variant="outlined"><CardContent><Typography variant="h5">Voucher Review</Typography><Stack spacing={1} sx={{ mt: 2 }}><Metric label="Verified" value={verification.verified} color="success.main" /><Metric label="Unverified" value={verification.unverified} color="warning.main" /><Metric label="Rejected" value={verification.rejected} color="error.main" /></Stack></CardContent></Card></Grid><Grid size={{ xs: 12, md: 8 }}><Typography variant="h5" sx={{ mb: 1 }}>Recent Activity</Typography><LogTable logs={dashboard.recent || []} onInspect={onInspect} compact /></Grid></Grid></Stack>;
}

function AuditLog({ logs, filters, setFilters, modules, onApply, onInspect }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth size="small" label="Module" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}><MenuItem value="">All Modules</MenuItem>{modules.map((module) => <MenuItem key={module} value={module}>{module}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth size="small" label="Outcome" value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}><MenuItem value="">All</MenuItem><MenuItem value="SUCCESS">Success</MenuItem><MenuItem value="FAILURE">Failure</MenuItem></TextField></Grid><Grid size={{ xs: 6, md: 2 }}><TextField fullWidth size="small" type="date" label="From" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid><Grid size={{ xs: 6, md: 2 }}><TextField fullWidth size="small" type="date" label="To" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} InputLabelProps={{ shrink: true }} /></Grid><Grid size={{ xs: 12, md: 2 }}><Button fullWidth variant="contained" onClick={onApply}>Apply Filters</Button></Grid></Grid><LogTable logs={logs} onInspect={onInspect} /></Stack>;
}

function EditLog({ logs, onInspect }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Alert severity="info">Edit history shows successful and failed UPDATE/DELETE requests with sanitized submitted changes.</Alert><LogTable logs={logs} onInspect={onInspect} showEntity /></Stack>;
}

function LogTable({ logs, onInspect, compact = false, showEntity = false }) {
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Time</TableCell><TableCell>User</TableCell><TableCell>Event</TableCell>{showEntity && <TableCell>Entity</TableCell>}<TableCell>Description</TableCell><TableCell>Outcome</TableCell><TableCell align="right">Details</TableCell></TableRow></TableHead><TableBody>{logs.slice(0, compact ? 8 : 500).map((log) => <TableRow hover key={log.id}><TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell><TableCell>{log.user?.fullName || log.user?.email || 'System'}</TableCell><TableCell>{log.module}.{log.action}</TableCell>{showEntity && <TableCell>{log.entityType || '-'}<br /><Typography variant="caption">{log.entityId || ''}</Typography></TableCell>}<TableCell>{log.description}</TableCell><TableCell><OutcomeChip outcome={log.outcome} /></TableCell><TableCell align="right"><Button size="small" startIcon={<EyeOutlined />} onClick={() => onInspect(log)}>View</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}

function VoucherVerification({ vouchers, onVerify }) {
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Voucher</TableCell><TableCell>Particulars</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell><TableCell>Verification</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{vouchers.map((voucher) => {
    const debit = voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0);
    const credit = voucher.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount), 0);
    const status = voucher.verification?.status || 'UNVERIFIED';
    return <TableRow key={voucher.id}><TableCell>{voucher.voucherDate.slice(0, 10)}</TableCell><TableCell>{voucher.voucherNo}<br /><Typography variant="caption">{voucher.voucherType}</Typography></TableCell><TableCell>{voucher.lines.map((line) => line.ledger.name).join(', ')}</TableCell><TableCell align="right">{money(debit)}</TableCell><TableCell align="right">{money(credit)}</TableCell><TableCell><VerificationChip status={status} />{voucher.verification?.verifiedBy && <Typography variant="caption" display="block">{voucher.verification.verifiedBy.fullName}</Typography>}</TableCell><TableCell align="right"><Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}><Button size="small" color="success" startIcon={<CheckCircleOutlined />} onClick={() => onVerify(voucher, 'VERIFIED')}>Verify</Button><Button size="small" color="error" startIcon={<StopOutlined />} onClick={() => onVerify(voucher, 'REJECTED')}>Reject</Button></Stack></TableCell></TableRow>;
  })}</TableBody></Table></TableContainer>;
}

function Security({ security }) {
  const cards = [['Successful Logins', security.loginSuccesses || 0], ['Failed Logins', security.loginFailures || 0], ['Failed Operations', security.failedOperations || 0], ['Unique IPs', security.uniqueIpCount || 0]];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Alert severity={security.loginFailures ? 'warning' : 'success'}>Security activity for the last {security.periodDays || 7} days. Passwords and tokens are always redacted.</Alert><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><Table size="small"><TableHead><TableRow><TableCell>Time</TableCell><TableCell>Event</TableCell><TableCell>IP</TableCell><TableCell>User Agent</TableCell><TableCell>Outcome</TableCell></TableRow></TableHead><TableBody>{(security.recentSecurityEvents || []).map((log) => <TableRow key={log.id}><TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell><TableCell>{log.description}</TableCell><TableCell>{log.ipAddress || '-'}</TableCell><TableCell>{log.userAgent || '-'}</TableCell><TableCell><OutcomeChip outcome={log.outcome} /></TableCell></TableRow>)}</TableBody></Table></Stack>;
}

function Detail({ label, value, wide = false }) {
  return <Grid size={{ xs: 12, md: wide ? 8 : 4 }}><Typography color="text.secondary">{label}</Typography><Typography>{value}</Typography></Grid>;
}

function JsonBlock({ value }) {
  return <Box component="pre" sx={{ m: 0, p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 12 }}>{JSON.stringify(value || {}, null, 2)}</Box>;
}

function Metric({ label, value = 0, color }) {
  return <Stack direction="row" sx={{ justifyContent: 'space-between' }}><Typography>{label}</Typography><Typography sx={{ color, fontWeight: 600 }}>{value}</Typography></Stack>;
}

function OutcomeChip({ outcome }) {
  return <Chip size="small" color={outcome === 'SUCCESS' ? 'success' : 'error'} label={outcome} />;
}

function VerificationChip({ status }) {
  const colors = { VERIFIED: 'success', REJECTED: 'error', UNVERIFIED: 'warning' };
  return <Chip size="small" color={colors[status]} label={status} />;
}
