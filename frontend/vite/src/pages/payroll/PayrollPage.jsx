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

import DollarOutlined from '@ant-design/icons/DollarOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const now = new Date();
const today = () => todayIso();
const money = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
const monthName = (month) => new Date(2026, Number(month) - 1).toLocaleString('en-IN', { month: 'long' });

async function api(path, options) {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

const emptyEmployee = {
  branchId: '', employeeCode: '', firstName: '', lastName: '', email: '', phone: '',
  designation: '', department: '', dateOfJoining: today(), pan: '', uan: '', esiNumber: '',
  bankAccountNo: '', bankIfsc: ''
};

export default function PayrollPage() {
  const [tab, setTab] = useState(0);
  const [dashboard, setDashboard] = useState({});
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [runs, setRuns] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [preview, setPreview] = useState({ lines: [], totals: {} });
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [salaryForm, setSalaryForm] = useState({
    effectiveFrom: today(), effectiveTo: '', basic: 25000, hra: 10000, specialAllowance: 5000,
    conveyanceAllowance: 1600, otherAllowance: 0, pfPercent: 12, esiPercent: 0.75,
    professionalTax: 200, tds: 0, notes: ''
  });
  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: '', workingDays: 26, payableDays: 26, overtimeHours: 0, overtimeAmount: 0, notes: ''
  });
  const [runForm, setRunForm] = useState({
    runNo: `PAY-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    paymentDate: today(), branchId: '', notes: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const branches = useMemo(() => companies.flatMap((company) => company.branches.map((branch) => ({ ...branch, company }))), [companies]);
  const attendanceByEmployee = useMemo(() => new Map(attendance.map((row) => [row.employeeId, row])), [attendance]);

  async function loadBase() {
    const [dashboardData, employeeData, runData, companyData] = await Promise.all([
      api('/payroll/dashboard'), api('/payroll/employees'), api('/payroll/runs'), api('/companies')
    ]);
    setDashboard(dashboardData);
    setEmployees(employeeData);
    setRuns(runData);
    setCompanies(companyData);
  }

  async function loadPeriod() {
    const query = `year=${period.year}&month=${period.month}`;
    const [attendanceData, previewData] = await Promise.all([
      api(`/payroll/attendance?${query}`),
      api(`/payroll/preview?${query}${runForm.branchId ? `&branchId=${runForm.branchId}` : ''}`)
    ]);
    setAttendance(attendanceData);
    setPreview(previewData);
  }

  useEffect(() => { loadBase().catch((loadError) => setError(loadError.message)); }, []);
  useEffect(() => { loadPeriod().catch((loadError) => setError(loadError.message)); }, [period.year, period.month, runForm.branchId]);

  async function save(action, success, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(success);
      await Promise.all([loadBase(), loadPeriod()]);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function openSalary(employee) {
    setSelectedEmployee(employee);
    setSalaryForm({
      effectiveFrom: today(), effectiveTo: '', basic: 25000, hra: 10000, specialAllowance: 5000,
      conveyanceAllowance: 1600, otherAllowance: 0, pfPercent: 12, esiPercent: 0.75,
      professionalTax: 200, tds: 0, notes: ''
    });
    setSalaryOpen(true);
  }

  function openAttendance(employee) {
    const existing = attendanceByEmployee.get(employee.id);
    setSelectedEmployee(employee);
    setAttendanceForm({
      employeeId: employee.id,
      workingDays: existing ? Number(existing.workingDays) : 26,
      payableDays: existing ? Number(existing.payableDays) : 26,
      overtimeHours: existing ? Number(existing.overtimeHours) : 0,
      overtimeAmount: existing ? Number(existing.overtimeAmount) : 0,
      notes: existing?.notes || ''
    });
    setAttendanceOpen(true);
  }

  function numericBody(form, keys) {
    return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, keys.includes(key) ? Number(value || 0) : value || undefined]));
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && <Grid size={12}><Alert severity={error ? 'error' : 'success'} onClose={() => error ? setError('') : setMessage('')}>{error || message}</Alert></Grid>}
      <Grid size={12}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box>
            <Typography variant="h3">Payroll Control Panel</Typography>
            <Typography color="text.secondary">Employees, effective salary structures, attendance, statutory deductions and accounting.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<PlusOutlined />} onClick={() => {
              setEmployeeForm({ ...emptyEmployee, branchId: branches[0]?.id || '' });
              setEmployeeOpen(true);
            }}>New Employee</Button>
            <Button variant="contained" startIcon={<DollarOutlined />} onClick={() => setTab(3)}>Process Payroll</Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Dashboard" /><Tab label="Employees" /><Tab label="Attendance" /><Tab label="Payroll Processing" /><Tab label="Payslips & History" />
          </Tabs>
          {tab === 0 && <Dashboard dashboard={dashboard} runs={runs} />}
          {tab === 1 && <EmployeeTable employees={employees} onSalary={openSalary} />}
          {tab === 2 && <AttendancePanel employees={employees} attendanceByEmployee={attendanceByEmployee} period={period} setPeriod={setPeriod} onEdit={openAttendance} />}
          {tab === 3 && <ProcessingPanel period={period} setPeriod={setPeriod} preview={preview} runForm={runForm} setRunForm={setRunForm} branches={branches} onProcess={() => save(
            () => api('/payroll/runs/process', { method: 'POST', body: JSON.stringify({ ...runForm, year: Number(period.year), month: Number(period.month), branchId: runForm.branchId || undefined }) }),
            'Payroll processed and posted to accounts', () => {}
          )} />}
          {tab === 4 && <RunHistory runs={runs} />}
        </Box>
      </Grid>

      <Dialog open={employeeOpen} onClose={() => setEmployeeOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          save(() => api('/payroll/employees', { method: 'POST', body: JSON.stringify(employeeForm) }), 'Employee created', () => setEmployeeOpen(false));
        }}>
          <DialogTitle>Create Employee</DialogTitle>
          <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Branch" value={employeeForm.branchId} onChange={(e) => setEmployeeForm({ ...employeeForm, branchId: e.target.value })} required>{branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.company.name} - {branch.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Employee Code" value={employeeForm.employeeCode} onChange={(e) => setEmployeeForm({ ...employeeForm, employeeCode: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12, md: 4 }}><DateField fullWidth label="Date of Joining" value={employeeForm.dateOfJoining} onChange={(e) => setEmployeeForm({ ...employeeForm, dateOfJoining: e.target.value })} required /></Grid>
            {['firstName', 'lastName', 'email', 'phone', 'designation', 'department', 'pan', 'uan', 'esiNumber', 'bankAccountNo', 'bankIfsc'].map((field) => <Grid key={field} size={{ xs: 12, md: field === 'firstName' || field === 'lastName' ? 6 : 4 }}><TextField fullWidth label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())} value={employeeForm[field]} onChange={(e) => setEmployeeForm({ ...employeeForm, [field]: e.target.value })} required={field === 'firstName'} /></Grid>)}
          </Grid></DialogContent>
          <DialogActions><Button onClick={() => setEmployeeOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save Employee</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={salaryOpen} onClose={() => setSalaryOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          const keys = ['basic', 'hra', 'specialAllowance', 'conveyanceAllowance', 'otherAllowance', 'pfPercent', 'esiPercent', 'professionalTax', 'tds'];
          save(() => api(`/payroll/employees/${selectedEmployee.id}/salary-structures`, { method: 'POST', body: JSON.stringify(numericBody(salaryForm, keys)) }), 'Salary structure assigned', () => setSalaryOpen(false));
        }}>
          <DialogTitle>Salary Structure: {selectedEmployee?.firstName} {selectedEmployee?.lastName}</DialogTitle>
          <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={6}><DateField fullWidth label="Effective From" value={salaryForm.effectiveFrom} onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })} /></Grid>
            <Grid size={6}><DateField fullWidth label="Effective To" value={salaryForm.effectiveTo} onChange={(e) => setSalaryForm({ ...salaryForm, effectiveTo: e.target.value })} /></Grid>
            {['basic', 'hra', 'specialAllowance', 'conveyanceAllowance', 'otherAllowance', 'pfPercent', 'esiPercent', 'professionalTax', 'tds'].map((field) => <Grid key={field} size={{ xs: 6, md: 4 }}><TextField fullWidth type="number" label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())} value={salaryForm[field]} onChange={(e) => setSalaryForm({ ...salaryForm, [field]: e.target.value })} /></Grid>)}
            <Grid size={12}><TextField fullWidth multiline minRows={2} label="Notes" value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} /></Grid>
          </Grid></DialogContent>
          <DialogActions><Button onClick={() => setSalaryOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Assign Structure</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={attendanceOpen} onClose={() => setAttendanceOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => {
          event.preventDefault();
          const body = numericBody({ ...attendanceForm, year: period.year, month: period.month }, ['year', 'month', 'workingDays', 'payableDays', 'overtimeHours', 'overtimeAmount']);
          save(() => api('/payroll/attendance', { method: 'POST', body: JSON.stringify(body) }), 'Attendance saved', () => setAttendanceOpen(false));
        }}>
          <DialogTitle>Attendance: {selectedEmployee?.firstName} {selectedEmployee?.lastName}</DialogTitle>
          <DialogContent><Grid container spacing={2} sx={{ mt: 0.5 }}>
            {['workingDays', 'payableDays', 'overtimeHours', 'overtimeAmount'].map((field) => <Grid key={field} size={6}><TextField fullWidth type="number" label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())} value={attendanceForm[field]} onChange={(e) => setAttendanceForm({ ...attendanceForm, [field]: e.target.value })} /></Grid>)}
            <Grid size={12}><TextField fullWidth multiline minRows={2} label="Notes" value={attendanceForm.notes} onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })} /></Grid>
          </Grid></DialogContent>
          <DialogActions><Button onClick={() => setAttendanceOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save Attendance</Button></DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}

function Dashboard({ dashboard, runs }) {
  const latest = dashboard.latestRun;
  const cards = [
    ['Active Employees', dashboard.activeEmployees || 0],
    ['Current Attendance', dashboard.attendanceReady || 0],
    ['Processed Runs', dashboard.processedRuns || 0],
    ['Latest Net Payroll', money(latest?.totalNet)]
  ];
  return <Stack spacing={2.5} sx={{ p: 2.5 }}>
    <Grid container spacing={2}>{cards.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card></Grid>)}</Grid>
    <Typography variant="h5">Recent Payroll Runs</Typography><RunTable runs={runs.slice(0, 5)} />
  </Stack>;
}

function EmployeeTable({ employees, onSalary }) {
  return <TableContainer sx={{ p: 2.5 }}><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Department / Designation</TableCell><TableCell>Branch</TableCell><TableCell>Joining</TableCell><TableCell>Current Gross</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{employees.map((employee) => {
    const salary = employee.salaryStructures[0];
    const gross = salary ? ['basic', 'hra', 'specialAllowance', 'conveyanceAllowance', 'otherAllowance'].reduce((sum, key) => sum + Number(salary[key]), 0) : 0;
    return <TableRow key={employee.id}><TableCell>{employee.firstName} {employee.lastName}<br /><Typography variant="caption">{employee.employeeCode}</Typography></TableCell><TableCell>{employee.department || '-'}<br />{employee.designation || '-'}</TableCell><TableCell>{employee.branch.name}</TableCell><TableCell>{formatDate(employee.dateOfJoining)}</TableCell><TableCell>{salary ? money(gross) : <Chip size="small" color="warning" label="Not assigned" />}</TableCell><TableCell><Chip size="small" color={employee.status === 'ACTIVE' ? 'success' : 'default'} label={employee.status} /></TableCell><TableCell align="right"><Button size="small" onClick={() => onSalary(employee)}>Add Salary Revision</Button></TableCell></TableRow>;
  })}</TableBody></Table></TableContainer>;
}

function PeriodFields({ period, setPeriod }) {
  return <Stack direction="row" spacing={1}><TextField size="small" type="number" label="Year" value={period.year} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })} /><TextField size="small" select label="Month" value={period.month} onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })} sx={{ minWidth: 140 }}>{Array.from({ length: 12 }, (_, index) => <MenuItem key={index + 1} value={index + 1}>{monthName(index + 1)}</MenuItem>)}</TextField></Stack>;
}

function AttendancePanel({ employees, attendanceByEmployee, period, setPeriod, onEdit }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}><Typography variant="h5">Attendance Register</Typography><PeriodFields period={period} setPeriod={setPeriod} /></Stack><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Working Days</TableCell><TableCell align="right">Payable Days</TableCell><TableCell align="right">Overtime</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => {
    const row = attendanceByEmployee.get(employee.id);
    return <TableRow key={employee.id}><TableCell>{employee.employeeCode} - {employee.firstName} {employee.lastName}</TableCell><TableCell align="right">{row ? Number(row.workingDays).toFixed(2) : '-'}</TableCell><TableCell align="right">{row ? Number(row.payableDays).toFixed(2) : '-'}</TableCell><TableCell align="right">{row ? `${Number(row.overtimeHours).toFixed(2)} hrs / ${money(row.overtimeAmount)}` : '-'}</TableCell><TableCell><Chip size="small" color={row ? 'success' : 'warning'} label={row ? 'Ready' : 'Pending'} /></TableCell><TableCell align="right"><Button size="small" variant="outlined" onClick={() => onEdit(employee)}>{row ? 'Edit' : 'Enter'}</Button></TableCell></TableRow>;
  })}</TableBody></Table></Stack>;
}

function ProcessingPanel({ period, setPeriod, preview, runForm, setRunForm, branches, onProcess }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}><Box><Typography variant="h5">Payroll Preview</Typography><Typography color="text.secondary">Only employees with an effective salary structure and attendance are included.</Typography></Box><PeriodFields period={period} setPeriod={setPeriod} /></Stack>
    <Grid container spacing={2}>{[['Gross Earnings', preview.totals.grossEarnings], ['Deductions', preview.totals.totalDeductions], ['Net Pay', preview.totals.netPay]].map(([label, value]) => <Grid key={label} size={{ xs: 12, md: 4 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h3">{money(value)}</Typography></CardContent></Card></Grid>)}</Grid>
    <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell align="right">Days</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">PF</TableCell><TableCell align="right">ESI</TableCell><TableCell align="right">PT / TDS</TableCell><TableCell align="right">Net Pay</TableCell></TableRow></TableHead><TableBody>{preview.lines.map((line) => <TableRow key={line.employeeId}><TableCell>{line.employeeCode} - {line.employeeName}<br />{line.designation}</TableCell><TableCell align="right">{line.payableDays}/{line.workingDays}</TableCell><TableCell align="right">{money(line.grossEarnings)}</TableCell><TableCell align="right">{money(line.providentFund)}</TableCell><TableCell align="right">{money(line.esi)}</TableCell><TableCell align="right">{money(line.professionalTax + line.tds)}</TableCell><TableCell align="right"><strong>{money(line.netPay)}</strong></TableCell></TableRow>)}</TableBody></Table></TableContainer>
    <Card variant="outlined"><CardContent><Typography variant="h5" sx={{ mb: 2 }}>Post Payroll</Typography><Grid container spacing={2}><Grid size={{ xs: 12, md: 3 }}><TextField fullWidth label="Run No" value={runForm.runNo} onChange={(e) => setRunForm({ ...runForm, runNo: e.target.value })} /></Grid><Grid size={{ xs: 12, md: 3 }}><DateField fullWidth label="Payment Date" value={runForm.paymentDate} onChange={(e) => setRunForm({ ...runForm, paymentDate: e.target.value })} /></Grid><Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="Branch Scope" value={runForm.branchId} onChange={(e) => setRunForm({ ...runForm, branchId: e.target.value })}><MenuItem value="">All Branches</MenuItem>{branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><Button fullWidth variant="contained" size="large" disabled={!preview.lines.length} onClick={onProcess}>Process & Post</Button></Grid></Grid></CardContent></Card>
  </Stack>;
}

function RunHistory({ runs }) {
  return <Stack spacing={2} sx={{ p: 2.5 }}><Typography variant="h5">Payroll Runs and Payslips</Typography><RunTable runs={runs} details /></Stack>;
}

function RunTable({ runs, details = false }) {
  return <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Run</TableCell><TableCell>Period</TableCell><TableCell>Branch</TableCell><TableCell align="right">Employees</TableCell><TableCell align="right">Gross</TableCell><TableCell align="right">Deductions</TableCell><TableCell align="right">Net Pay</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{runs.map((run) => <TableRow key={run.id}><TableCell>{run.runNo}<br />{details && <Typography variant="caption">Paid {formatDate(run.paymentDate)}</Typography>}</TableCell><TableCell>{monthName(run.month)} {run.year}</TableCell><TableCell>{run.branch?.name || 'All Branches'}</TableCell><TableCell align="right">{run.payslips.length}</TableCell><TableCell align="right">{money(run.totalGross)}</TableCell><TableCell align="right">{money(run.totalDeductions)}</TableCell><TableCell align="right">{money(run.totalNet)}</TableCell><TableCell><Chip size="small" color={run.status === 'PROCESSED' ? 'success' : 'default'} label={run.status} /></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}




