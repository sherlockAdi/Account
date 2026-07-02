import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';

import EditOutlined from '@ant-design/icons/EditOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';

import { formatDate, toIsoDate } from 'utils/dateFormat';
import { useSearchParams } from 'react-router-dom';

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

const emptyCompany = {
  id: '',
  name: '',
  legalName: '',
  code: '',
  gstin: '',
  pan: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  financialYearStart: '2026-04-01',
  booksStartDate: '2026-04-01',
  isActive: true
};

const emptyBranch = {
  id: '',
  companyId: '',
  name: '',
  code: '',
  gstin: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  isPrimary: false,
  isActive: true
};

const emptyWarehouse = {
  id: '',
  branchId: '',
  name: '',
  code: '',
  addressLine1: '',
  city: '',
  state: '',
  isPrimary: false,
  isActive: true
};

const emptySeries = {
  id: '',
  companyId: '',
  module: '',
  prefix: '',
  nextNumber: 1,
  padding: 5,
  suffix: '',
  isActive: true
};

function dateValue(value) {
  return toIsoDate(value);
}

export default function CompaniesPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [voucherSeries, setVoucherSeries] = useState([]);
  const [loadedTabs, setLoadedTabs] = useState({});
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [warehousesLoaded, setWarehousesLoaded] = useState(false);
  const [seriesLoaded, setSeriesLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [branchForm, setBranchForm] = useState(emptyBranch);
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouse);
  const [seriesForm, setSeriesForm] = useState(emptySeries);

<<<<<<< HEAD
  const branches = useMemo(() => companies.flatMap((company) => company.branches.map((branch) => ({ ...branch, company }))), [companies]);
  const warehouses = useMemo(
    () => branches.flatMap((branch) => branch.warehouses.map((warehouse) => ({ ...warehouse, branch }))),
    [branches]
  );
  const voucherSeries = useMemo(
    () => companies.flatMap((company) => company.voucherSeries.map((series) => ({ ...series, company }))),
    [companies]
  );
  async function loadCompanies() {
    setCompanies(await api('/companies'));
=======
  async function ensureCompanies(force = false) {
    if (!force && companiesLoaded && companies.length) return companies;
    const companyData = await api('/companies?summary=true');
    setCompanies(companyData);
    setCompaniesLoaded(true);
    return companyData;
  }

  async function ensureBranches(force = false) {
    if (!force && branchesLoaded && branches.length) return branches;
    const companyData = await ensureCompanies(force);
    const branchGroups = await Promise.all(companyData.map(async (company) => (await api(`/companies/${company.id}/branches`)).map((branch) => ({ ...branch, company }))));
    const branchData = branchGroups.flat();
    setBranches(branchData);
    setBranchesLoaded(true);
    return branchData;
  }

  async function ensureWarehouses(force = false) {
    if (!force && warehousesLoaded && warehouses.length) return warehouses;
    const branchData = await ensureBranches(force);
    const warehouseGroups = await Promise.all(branchData.map(async (branch) => (await api(`/companies/branches/${branch.id}/warehouses`)).map((warehouse) => ({ ...warehouse, branch }))));
    const warehouseData = warehouseGroups.flat();
    setWarehouses(warehouseData);
    setWarehousesLoaded(true);
    return warehouseData;
  }

  async function ensureVoucherSeries(force = false) {
    if (!force && seriesLoaded && voucherSeries.length) return voucherSeries;
    const companyData = await ensureCompanies(force);
    const seriesGroups = await Promise.all(companyData.map(async (company) => (await api(`/companies/${company.id}/voucher-series`)).map((series) => ({ ...series, company }))));
    const seriesData = seriesGroups.flat();
    setVoucherSeries(seriesData);
    setSeriesLoaded(true);
    return seriesData;
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    setError('');
    if (tabIndex === 0) await ensureCompanies(force);
    if (tabIndex === 1) await ensureBranches(force);
    if (tabIndex === 2) await ensureWarehouses(force);
    if (tabIndex === 3) await ensureVoucherSeries(force);
    setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
>>>>>>> 9b1acf904f7e7821b672e61428e6e17fed0135ee
  }

  useEffect(() => {
    loadTabData(tab).catch((loadError) => setError(loadError.message));
  }, [tab]);

  useEffect(() => {
    const view = searchParams.get('view');
    const tabMap = {
      company: 0,
      branch: 1,
      warehouse: 2,
      'voucher-series': 3
    };
    if (view && tabMap[view] !== undefined) {
      setTab(tabMap[view]);
    }
  }, [searchParams]);

  function openCreateCompany() {
    setCompanyForm(emptyCompany);
    setCompanyModalOpen(true);
  }

  function openEditCompany(company) {
    setCompanyForm({
      ...emptyCompany,
      ...company,
      financialYearStart: dateValue(company.financialYearStart),
      booksStartDate: dateValue(company.booksStartDate)
    });
    setCompanyModalOpen(true);
  }

  async function openCreateBranch() {
    const companyData = await ensureCompanies();
    setBranchForm({ ...emptyBranch, companyId: companyData[0]?.id || '' });
    setBranchModalOpen(true);
  }

  function openEditBranch(branch) {
    setBranchForm({ ...emptyBranch, ...branch, companyId: branch.companyId });
    setBranchModalOpen(true);
  }

  async function openCreateWarehouse() {
    const branchData = await ensureBranches();
    setWarehouseForm({ ...emptyWarehouse, branchId: branchData[0]?.id || '' });
    setWarehouseModalOpen(true);
  }

  function openEditWarehouse(warehouse) {
    setWarehouseForm({ ...emptyWarehouse, ...warehouse, branchId: warehouse.branchId });
    setWarehouseModalOpen(true);
  }

  async function openCreateSeries() {
    const companyData = await ensureCompanies();
    setSeriesForm({ ...emptySeries, companyId: companyData[0]?.id || '' });
    setSeriesModalOpen(true);
  }

  function openEditSeries(series) {
    setSeriesForm({ ...emptySeries, ...series, companyId: series.companyId });
    setSeriesModalOpen(true);
  }

  async function saveCompany(event) {
    event.preventDefault();
    await save(
      () =>
        companyForm.id
          ? api(`/companies/${companyForm.id}`, { method: 'PATCH', body: JSON.stringify(companyForm) })
          : api('/companies', { method: 'POST', body: JSON.stringify(companyForm) }),
      companyForm.id ? 'Company updated' : 'Company created',
      () => setCompanyModalOpen(false)
    );
  }

  async function saveBranch(event) {
    event.preventDefault();
    const { companyId, ...body } = branchForm;
    await save(
      () =>
        branchForm.id
          ? api(`/companies/branches/${branchForm.id}`, { method: 'PATCH', body: JSON.stringify(body) })
          : api(`/companies/${companyId}/branches`, { method: 'POST', body: JSON.stringify(body) }),
      branchForm.id ? 'Branch updated' : 'Branch created',
      () => setBranchModalOpen(false)
    );
  }

  async function saveWarehouse(event) {
    event.preventDefault();
    const { branchId, ...body } = warehouseForm;
    await save(
      () =>
        warehouseForm.id
          ? api(`/companies/warehouses/${warehouseForm.id}`, { method: 'PATCH', body: JSON.stringify(body) })
          : api(`/companies/branches/${branchId}/warehouses`, { method: 'POST', body: JSON.stringify(body) }),
      warehouseForm.id ? 'Warehouse updated' : 'Warehouse created',
      () => setWarehouseModalOpen(false)
    );
  }

  async function saveSeries(event) {
    event.preventDefault();
    const { companyId, ...body } = seriesForm;
    await save(
      () =>
        seriesForm.id
          ? api(`/companies/voucher-series/${seriesForm.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ ...body, nextNumber: Number(body.nextNumber), padding: Number(body.padding) })
            })
          : api(`/companies/${companyId}/voucher-series`, {
              method: 'POST',
              body: JSON.stringify({ ...body, nextNumber: Number(body.nextNumber), padding: Number(body.padding) })
            }),
      seriesForm.id ? 'Voucher series updated' : 'Voucher series created',
      () => setSeriesModalOpen(false)
    );
  }

  async function save(action, successMessage, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(successMessage);
      await loadTabData(tab, true);
      if (tab !== 0) await ensureCompanies(true);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

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
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Companies" />
            <Tab label="Branches" />
            <Tab label="Warehouses" />
            <Tab label="Voucher Series" />
          </Tabs>

          {tab === 0 && <CompanyGrid companies={companies} onCreate={openCreateCompany} onEdit={openEditCompany} />}
          {tab === 1 && <BranchGrid branches={branches} onCreate={openCreateBranch} onEdit={openEditBranch} />}
          {tab === 2 && <WarehouseGrid warehouses={warehouses} onCreate={openCreateWarehouse} onEdit={openEditWarehouse} />}
          {tab === 3 && <SeriesGrid series={voucherSeries} onCreate={openCreateSeries} onEdit={openEditSeries} />}
        </Box>
      </Grid>

      <CompanyModal
        open={companyModalOpen}
        form={companyForm}
        setForm={setCompanyForm}
        onClose={() => setCompanyModalOpen(false)}
        onSubmit={saveCompany}
      />
      <BranchModal
        open={branchModalOpen}
        companies={companies}
        form={branchForm}
        setForm={setBranchForm}
        onClose={() => setBranchModalOpen(false)}
        onSubmit={saveBranch}
      />
      <WarehouseModal
        open={warehouseModalOpen}
        branches={branches}
        form={warehouseForm}
        setForm={setWarehouseForm}
        onClose={() => setWarehouseModalOpen(false)}
        onSubmit={saveWarehouse}
      />
      <SeriesModal
        open={seriesModalOpen}
        companies={companies}
        form={seriesForm}
        setForm={setSeriesForm}
        onClose={() => setSeriesModalOpen(false)}
        onSubmit={saveSeries}
      />
    </Grid>
  );
}

function GridShell({ onCreate, createLabel, children }) {
  return (
    <Stack spacing={2.5} sx={{ p: 2.5 }}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>
          {createLabel}
        </Button>
      </Stack>
      {children}
    </Stack>
  );
}

const statusOptions = [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }];

function CompanyGrid({ companies, onCreate, onEdit }) {
  const rows = companies.map((company) => ({
    ...company,
    companyText: `${company.name} ${company.code}`,
    financialYearDate: company.financialYearStart,
    financialYear: formatDate(company.financialYearStart),
    branchCount: company.branches?.length ?? company._count?.branches ?? 0,
    statusText: company.isActive ? 'Active' : 'Inactive'
  }));
  const columns = [
    { field: 'companyText', headerName: 'Company', flex: 1, minWidth: 220 },
    { field: 'gstin', headerName: 'GSTIN', flex: 0.8, minWidth: 160, valueGetter: (value) => value || '-' },
    { field: 'financialYear', headerName: 'Financial Year', flex: 0.8, minWidth: 160 },
    { field: 'branchCount', headerName: 'Branches', type: 'number', flex: 0.6, minWidth: 120 },
    { field: 'statusText', headerName: 'Status', flex: 0.6, minWidth: 120 },
    { field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 0.6, minWidth: 120, renderCell: (params) => <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(params.row)}>Edit</Button> }
  ];
  return (
    <GridShell onCreate={onCreate} createLabel="Create Company">
<<<<<<< HEAD
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Company</TableCell>
            <TableCell>GSTIN</TableCell>
            <TableCell>Financial Year</TableCell>
            <TableCell>Branches</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id} hover>
              <TableCell>
                <Typography variant="subtitle1">{company.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {company.code}
                </Typography>
              </TableCell>
              <TableCell>{company.gstin || '-'}</TableCell>
              <TableCell>{formatDate(company.financialYearStart)}</TableCell>
              <TableCell>{company.branches.length}</TableCell>
              <TableCell>{company.isActive ? 'Active' : 'Inactive'}</TableCell>
              <TableCell align="right">
                <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(company)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
=======
      <CommonDataGrid title="Companies" rows={rows} columns={columns} fileName="companies" searchPlaceholder="Search companies" dateField="financialYearDate" selectFilters={[{ field: 'statusText', label: 'Status', options: statusOptions }]} />
>>>>>>> 9b1acf904f7e7821b672e61428e6e17fed0135ee
    </GridShell>
  );
}

function BranchGrid({ branches, onCreate, onEdit }) {
  const rows = branches.map((branch) => ({
    ...branch,
    branchText: `${branch.name} ${branch.code}${branch.isPrimary ? ' Primary' : ''}`,
    companyName: branch.company.name,
    warehouseCount: branch.warehouses.length,
    statusText: branch.isActive ? 'Active' : 'Inactive',
    primaryText: branch.isPrimary ? 'Yes' : 'No'
  }));
  const companyOptions = Array.from(new Set(rows.map((row) => row.companyName))).map((company) => ({ value: company, label: company }));
  const columns = [
    { field: 'branchText', headerName: 'Branch', flex: 1, minWidth: 220 },
    { field: 'companyName', headerName: 'Company', flex: 1, minWidth: 190 },
    { field: 'gstin', headerName: 'GSTIN', flex: 0.8, minWidth: 150, valueGetter: (value) => value || '-' },
    { field: 'warehouseCount', headerName: 'Warehouses', type: 'number', flex: 0.7, minWidth: 130 },
    { field: 'primaryText', headerName: 'Primary', flex: 0.6, minWidth: 120 },
    { field: 'statusText', headerName: 'Status', flex: 0.6, minWidth: 120 },
    { field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 0.6, minWidth: 120, renderCell: (params) => <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(params.row)}>Edit</Button> }
  ];
  return (
    <GridShell onCreate={onCreate} createLabel="Create Branch">
<<<<<<< HEAD
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Branch</TableCell>
            <TableCell>Company</TableCell>
            <TableCell>GSTIN</TableCell>
            <TableCell>Warehouses</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {branches.map((branch) => (
            <TableRow key={branch.id} hover>
              <TableCell>
                <Typography variant="subtitle1">{branch.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {branch.code}
                  {branch.isPrimary ? ' | Primary' : ''}
                </Typography>
              </TableCell>
              <TableCell>{branch.company.name}</TableCell>
              <TableCell>{branch.gstin || '-'}</TableCell>
              <TableCell>{branch.warehouses.length}</TableCell>
              <TableCell>{branch.isActive ? 'Active' : 'Inactive'}</TableCell>
              <TableCell align="right">
                <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(branch)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
=======
      <CommonDataGrid title="Branches" rows={rows} columns={columns} fileName="branches" searchPlaceholder="Search branches" selectFilters={[{ field: 'companyName', label: 'Company', options: companyOptions }, { field: 'primaryText', label: 'Primary', options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] }, { field: 'statusText', label: 'Status', options: statusOptions }]} />
>>>>>>> 9b1acf904f7e7821b672e61428e6e17fed0135ee
    </GridShell>
  );
}

function WarehouseGrid({ warehouses, onCreate, onEdit }) {
  const rows = warehouses.map((warehouse) => ({
    ...warehouse,
    warehouseText: `${warehouse.name} ${warehouse.code}${warehouse.isPrimary ? ' Primary' : ''}`,
    branchName: warehouse.branch.name,
    statusText: warehouse.isActive ? 'Active' : 'Inactive',
    primaryText: warehouse.isPrimary ? 'Yes' : 'No'
  }));
  const branchOptions = Array.from(new Set(rows.map((row) => row.branchName))).map((branch) => ({ value: branch, label: branch }));
  const columns = [
    { field: 'warehouseText', headerName: 'Warehouse', flex: 1, minWidth: 220 },
    { field: 'branchName', headerName: 'Branch', flex: 1, minWidth: 180 },
    { field: 'city', headerName: 'City', flex: 0.8, minWidth: 140, valueGetter: (value) => value || '-' },
    { field: 'primaryText', headerName: 'Primary', flex: 0.6, minWidth: 120 },
    { field: 'statusText', headerName: 'Status', flex: 0.6, minWidth: 120 },
    { field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 0.6, minWidth: 120, renderCell: (params) => <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(params.row)}>Edit</Button> }
  ];
  return (
    <GridShell onCreate={onCreate} createLabel="Create Warehouse">
<<<<<<< HEAD
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Warehouse</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>City</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {warehouses.map((warehouse) => (
            <TableRow key={warehouse.id} hover>
              <TableCell>
                <Typography variant="subtitle1">{warehouse.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {warehouse.code}
                  {warehouse.isPrimary ? ' | Primary' : ''}
                </Typography>
              </TableCell>
              <TableCell>{warehouse.branch.name}</TableCell>
              <TableCell>{warehouse.city || '-'}</TableCell>
              <TableCell>{warehouse.isActive ? 'Active' : 'Inactive'}</TableCell>
              <TableCell align="right">
                <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(warehouse)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
=======
      <CommonDataGrid title="Warehouses" rows={rows} columns={columns} fileName="warehouses" searchPlaceholder="Search warehouses" selectFilters={[{ field: 'branchName', label: 'Branch', options: branchOptions }, { field: 'primaryText', label: 'Primary', options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] }, { field: 'statusText', label: 'Status', options: statusOptions }]} />
>>>>>>> 9b1acf904f7e7821b672e61428e6e17fed0135ee
    </GridShell>
  );
}

function SeriesGrid({ series, onCreate, onEdit }) {
  const rows = series.map((item) => ({
    ...item,
    companyName: item.company.name,
    formatText: `${item.prefix}${String(item.nextNumber).padStart(item.padding, '0')}${item.suffix || ''}`,
    statusText: item.isActive ? 'Active' : 'Inactive'
  }));
  const companyOptions = Array.from(new Set(rows.map((row) => row.companyName))).map((company) => ({ value: company, label: company }));
  const columns = [
    { field: 'module', headerName: 'Module', flex: 1, minWidth: 170 },
    { field: 'companyName', headerName: 'Company', flex: 1, minWidth: 190 },
    { field: 'formatText', headerName: 'Format', flex: 1, minWidth: 170 },
    { field: 'nextNumber', headerName: 'Next', type: 'number', flex: 0.6, minWidth: 120 },
    { field: 'statusText', headerName: 'Status', flex: 0.6, minWidth: 120 },
    { field: 'actions', headerName: 'Action', sortable: false, filterable: false, exportable: false, flex: 0.6, minWidth: 120, renderCell: (params) => <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(params.row)}>Edit</Button> }
  ];
  return (
    <GridShell onCreate={onCreate} createLabel="Create Series">
<<<<<<< HEAD
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Module</TableCell>
            <TableCell>Company</TableCell>
            <TableCell>Format</TableCell>
            <TableCell>Next</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {series.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>{item.module}</TableCell>
              <TableCell>{item.company.name}</TableCell>
              <TableCell>
                {item.prefix}
                {String(item.nextNumber).padStart(item.padding, '0')}
                {item.suffix || ''}
              </TableCell>
              <TableCell>{item.nextNumber}</TableCell>
              <TableCell>{item.isActive ? 'Active' : 'Inactive'}</TableCell>
              <TableCell align="right">
                <Button size="small" startIcon={<EditOutlined />} onClick={() => onEdit(item)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
=======
      <CommonDataGrid title="Voucher Series" rows={rows} columns={columns} fileName="voucher-series" searchPlaceholder="Search series" selectFilters={[{ field: 'companyName', label: 'Company', options: companyOptions }, { field: 'statusText', label: 'Status', options: statusOptions }]} />
>>>>>>> 9b1acf904f7e7821b672e61428e6e17fed0135ee
    </GridShell>
  );
}

function CompanyModal({ open, form, setForm, onClose, onSubmit }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>{form.id ? 'Edit Company' : 'Create Company'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              ['name', 'Name'],
              ['legalName', 'Legal name'],
              ['code', 'Code'],
              ['gstin', 'GSTIN'],
              ['pan', 'PAN'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['addressLine1', 'Address line 1'],
              ['addressLine2', 'Address line 2'],
              ['city', 'City'],
              ['state', 'State'],
              ['country', 'Country'],
              ['pincode', 'Pincode']
            ].map(([key, label]) => (
              <Grid key={key} size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label={label}
                  value={form[key] || ''}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  required={['name', 'code'].includes(key)}
                />
              </Grid>
            ))}
            <Grid size={{ xs: 12, md: 6 }}>
              <DateField
                fullWidth
                label="Financial year start"
                value={form.financialYearStart}
                onChange={(event) => setForm({ ...form, financialYearStart: event.target.value })}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <DateField
                fullWidth
                label="Books start date"
                value={form.booksStartDate}
                onChange={(event) => setForm({ ...form, booksStartDate: event.target.value })}
                required
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />}
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function BranchModal({ open, companies, form, setForm, onClose, onSubmit }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>{form.id ? 'Edit Branch' : 'Create Branch'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Company"
                value={form.companyId}
                disabled={Boolean(form.id)}
                onChange={(event) => setForm({ ...form, companyId: event.target.value })}
              >
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {['name', 'code', 'gstin', 'email', 'phone', 'addressLine1', 'addressLine2', 'city', 'state', 'country', 'pincode'].map(
              (key) => (
                <Grid key={key} size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label={key}
                    value={form[key] || ''}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    required={['name', 'code'].includes(key)}
                  />
                </Grid>
              )
            )}
            <Grid size={12}>
              <FormControlLabel
                control={<Checkbox checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />}
                label="Primary branch"
              />
              <FormControlLabel
                control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />}
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function WarehouseModal({ open, branches, form, setForm, onClose, onSubmit }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>{form.id ? 'Edit Warehouse' : 'Create Warehouse'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Branch"
              value={form.branchId}
              disabled={Boolean(form.id)}
              onChange={(event) => setForm({ ...form, branchId: event.target.value })}
            >
              {branches.map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.company.name} - {branch.name}
                </MenuItem>
              ))}
            </TextField>
            {['name', 'code', 'addressLine1', 'city', 'state'].map((key) => (
              <TextField
                key={key}
                label={key}
                value={form[key] || ''}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                required={['name', 'code'].includes(key)}
              />
            ))}
            <Box>
              <FormControlLabel
                control={<Checkbox checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />}
                label="Primary warehouse"
              />
              <FormControlLabel
                control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />}
                label="Active"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function SeriesModal({ open, companies, form, setForm, onClose, onSubmit }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>{form.id ? 'Edit Voucher Series' : 'Create Voucher Series'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Company"
              value={form.companyId}
              disabled={Boolean(form.id)}
              onChange={(event) => setForm({ ...form, companyId: event.target.value })}
            >
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Module" value={form.module} onChange={(event) => setForm({ ...form, module: event.target.value })} required />
            <TextField label="Prefix" value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} required />
            <TextField
              label="Next number"
              type="number"
              value={form.nextNumber}
              onChange={(event) => setForm({ ...form, nextNumber: event.target.value })}
              required
            />
            <TextField
              label="Padding"
              type="number"
              value={form.padding}
              onChange={(event) => setForm({ ...form, padding: event.target.value })}
              required
            />
            <TextField label="Suffix" value={form.suffix || ''} onChange={(event) => setForm({ ...form, suffix: event.target.value })} />
            <FormControlLabel
              control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />}
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
