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
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import StopOutlined from '@ant-design/icons/StopOutlined';

import { useAuth } from 'contexts/AuthContext';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const today = () => todayIso();
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
  const [loadedTabs, setLoadedTabs] = useState({});

  const modules = useMemo(() => [...new Set(logs.map((log) => log.module))].sort(), [logs]);
  const editLogs = useMemo(() => logs.filter((log) => ['UPDATE', 'DELETE'].includes(log.action)), [logs]);

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    try {
      setLoading(true);
      setError('');
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
      if (tabIndex === 0) setDashboard(await api('/audit/dashboard', token));
      if (tabIndex === 1 || tabIndex === 2) setLogs(await api(`/audit/logs?${query}`, token));
      if (tabIndex === 3) setVouchers(await api('/audit/vouchers', token));
      if (tabIndex === 4) setSecurity(await api('/audit/security', token));
      setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTabData(tab); }, [tab]);

  async function submitVerification() {
    try {
      setError('');
      await api(`/audit/vouchers/${verifyVoucher.id}/verify`, token, {
        method: 'PATCH',
        body: JSON.stringify(verifyForm)
      });
      setVerifyVoucher(null);
      setMessage(`Voucher marked ${verifyForm.status.toLowerCase()}`);
      await loadTabData(3, true);
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
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Chip icon={<SafetyCertificateOutlined />} color="primary" label={`Reviewer: ${user?.fullName || user?.email}`} /><Button variant="contained" onClick={() => loadTabData(tab, true)} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button></Stack>
        </Stack>
      </Grid>
      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Dashboard" /><Tab label="Audit Log" /><Tab label="Edit Log" /><Tab label="Voucher Verification" /><Tab label="Security" />
          </Tabs>
          {tab === 0 && <Dashboard dashboard={dashboard} onInspect={setSelectedLog} />}
          {tab === 1 && <AuditLog logs={logs} filters={filters} setFilters={setFilters} modules={modules} onApply={() => loadTabData(1, true)} onInspect={setSelectedLog} />}
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
  return <Stack spacing={2} sx={{ p: 2.5 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth size="small" label="Module" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })}><MenuItem value="">All Modules</MenuItem>{modules.map((module) => <MenuItem key={module} value={module}>{module}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth size="small" label="Outcome" value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}><MenuItem value="">All</MenuItem><MenuItem value="SUCCESS">Success</MenuItem><MenuItem value="FAILURE">Failure</MenuItem></TextField></Grid><Grid size={{ xs: 6, md: 2 }}><DateField fullWidth size="small" label="From" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></Grid><Grid size={{ xs: 6, md: 2 }}><DateField fullWidth size="small" label="To" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></Grid><Grid size={{ xs: 12, md: 2 }}><Button fullWidth variant="contained" onClick={onApply}>Apply Filters</Button></Grid></Grid><LogTable logs={logs} onInspect={onInspect} /></Stack>;
}

function EditLog({ logs, onInspect }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Alert severity="info">Edit history shows successful and failed UPDATE/DELETE requests with sanitized submitted changes.</Alert><LogTable logs={logs} onInspect={onInspect} showEntity /></Stack>;
}

function LogTable({ logs, onInspect, compact = false, showEntity = false }) {
  const rows = logs.slice(0, compact ? 8 : 500).map((log) => ({
    ...log,
    timeText: new Date(log.createdAt).toLocaleString(),
    userText: log.user?.fullName || log.user?.email || 'System',
    eventText: `${log.module}.${log.action}`,
    entityText: `${log.entityType || '-'} ${log.entityId || ''}`.trim()
  }));
  const columns = [
    { field: 'timeText', headerName: 'Time', width: 190 },
    { field: 'userText', headerName: 'User', flex: 1, minWidth: 150 },
    { field: 'eventText', headerName: 'Event', flex: 1, minWidth: 150 },
    ...(showEntity ? [{ field: 'entityText', headerName: 'Entity', flex: 1, minWidth: 170 }] : []),
    { field: 'description', headerName: 'Description', flex: 1.4, minWidth: 240 },
    { field: 'outcome', headerName: 'Outcome', width: 130, renderCell: ({ value }) => <OutcomeChip outcome={value} /> },
    { field: 'details', headerName: 'Details', width: 120, sortable: false, filterable: false, renderCell: ({ row }) => <Button size="small" startIcon={<EyeOutlined />} onClick={() => onInspect(row)}>View</Button> }
  ];

  return (
    <CommonDataGrid
      title={showEntity ? 'Edit Log' : compact ? 'Recent Activity' : 'Audit Log'}
      rows={rows}
      columns={columns}
      searchPlaceholder="Search audit event, user, path, or description"
      dateField="createdAt"
      selectFilters={[
        { field: 'module', label: 'Module' },
        { field: 'action', label: 'Action' },
        { field: 'outcome', label: 'Outcome' }
      ]}
      fileName={showEntity ? 'edit-log' : 'audit-log'}
      height={compact ? 380 : 520}
      pageSize={25}
    />
  );
}

function VoucherVerification({ vouchers, onVerify }) {
  const rows = vouchers.map((voucher) => {
    const debit = voucher.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount), 0);
    const credit = voucher.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount), 0);
    const status = voucher.verification?.status || 'UNVERIFIED';
    return {
      ...voucher,
      dateText: formatDate(voucher.voucherDate),
      voucherText: `${voucher.voucherNo} | ${voucher.voucherType}`,
      particularsText: voucher.lines.map((line) => line.ledger.name).join(', '),
      debitText: money(debit),
      creditText: money(credit),
      verificationStatus: status,
      verifiedByText: voucher.verification?.verifiedBy?.fullName || '-'
    };
  });

  return (
    <CommonDataGrid
      title="Voucher Verification"
      rows={rows}
      columns={[
        { field: 'dateText', headerName: 'Date', width: 130 },
        { field: 'voucherText', headerName: 'Voucher', flex: 1, minWidth: 170 },
        { field: 'particularsText', headerName: 'Particulars', flex: 1.5, minWidth: 240 },
        { field: 'debitText', headerName: 'Debit', width: 140, align: 'right', headerAlign: 'right' },
        { field: 'creditText', headerName: 'Credit', width: 140, align: 'right', headerAlign: 'right' },
        { field: 'verificationStatus', headerName: 'Verification', width: 150, renderCell: ({ value }) => <VerificationChip status={value} /> },
        { field: 'actions', headerName: 'Action', width: 190, sortable: false, filterable: false, renderCell: ({ row }) => <Stack direction="row" spacing={0.5}><Button size="small" color="success" startIcon={<CheckCircleOutlined />} onClick={() => onVerify(row, 'VERIFIED')}>Verify</Button><Button size="small" color="error" startIcon={<StopOutlined />} onClick={() => onVerify(row, 'REJECTED')}>Reject</Button></Stack> }
      ]}
      searchPlaceholder="Search voucher, type, ledger, or reviewer"
      dateField="voucherDate"
      selectFilters={[{ field: 'voucherType', label: 'Voucher Type' }, { field: 'verificationStatus', label: 'Verification' }, { field: 'verifiedByText', label: 'Verified By' }]}
      fileName="voucher-verification"
    />
  );
}

function Security({ security }) {
  const cards = [['Successful Logins', security.loginSuccesses || 0], ['Failed Logins', security.loginFailures || 0], ['Failed Operations', security.failedOperations || 0], ['Unique IPs', security.uniqueIpCount || 0]];
  const rows = (security.recentSecurityEvents || []).map((log) => ({ ...log, timeText: new Date(log.createdAt).toLocaleString(), ipText: log.ipAddress || '-', userAgentText: log.userAgent || '-' }));
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Alert severity={security.loginFailures ? 'warning' : 'success'}>Security activity for the last {security.periodDays || 7} days. Passwords and tokens are always redacted.</Alert><Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid><CommonDataGrid title="Security Events" rows={rows} columns={[{ field: 'timeText', headerName: 'Time', width: 190 }, { field: 'description', headerName: 'Event', flex: 1.2, minWidth: 220 }, { field: 'ipText', headerName: 'IP', width: 150 }, { field: 'userAgentText', headerName: 'User Agent', flex: 1, minWidth: 220 }, { field: 'outcome', headerName: 'Outcome', width: 130, renderCell: ({ value }) => <OutcomeChip outcome={value} /> }]} searchPlaceholder="Search security event, IP, or user agent" dateField="createdAt" selectFilters={[{ field: 'outcome', label: 'Outcome' }, { field: 'ipText', label: 'IP' }]} fileName="security-events" /></Stack>;
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




