import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';

import PlusOutlined from '@ant-design/icons/PlusOutlined';
import ArrowRightOutlined from '@ant-design/icons/ArrowRightOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CommonDataGrid from 'components/CommonDataGrid';
import DateField from 'components/DateField';
import { formatDate, todayIso } from 'utils/dateFormat';

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

const natures = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const dc = ['DEBIT', 'CREDIT'];
const defaultLedgerTypeCodes = ['GENERAL', 'CASH', 'BANK', 'CAPITAL', 'CUSTOMER', 'VENDOR', 'TAX', 'EXPENSE', 'INCOME'];
const defaultModules = {
  budget: true,
  grant: true,
  payroll: true,
  sales: true,
  purchase: true,
  costCenter: true
};

export default function AccountingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(0);
  const [groups, setGroups] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [ledgerTypes, setLedgerTypes] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [ledgerReport, setLedgerReport] = useState(null);
  const [loadedTabs, setLoadedTabs] = useState({});
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [ledgersLoaded, setLedgersLoaded] = useState(false);
  const [ledgerTypesLoaded, setLedgerTypesLoaded] = useState(false);
  const [voucherTypesLoaded, setVoucherTypesLoaded] = useState(false);
  const [budgetsLoaded, setBudgetsLoaded] = useState(false);
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [vouchersLoaded, setVouchersLoaded] = useState(false);
  const [trialBalanceLoaded, setTrialBalanceLoaded] = useState(false);
  const [modules, setModules] = useState(defaultModules);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherTypeOpen, setVoucherTypeOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [voucherBudgetOpen, setVoucherBudgetOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', code: '', nature: 'ASSET' });
  const [ledgerTypeOpen, setLedgerTypeOpen] = useState(false);
  const [selectedLedgerType, setSelectedLedgerType] = useState(null);
  const [ledgerTypeForm, setLedgerTypeForm] = useState({ name: '', code: '', notes: '', isActive: true });
  const [ledgerForm, setLedgerForm] = useState({
    name: '',
    code: '',
    groupId: '',
    ledgerType: 'GENERAL',
    openingBalance: 0,
    openingType: 'DEBIT',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankBranch: ''
  });
  const [voucherForm, setVoucherForm] = useState({
    voucherTypeId: '',
    voucherNo: '',
    voucherDate: todayIso(),
    budgetTypeId: '',
    budgetGrantId: '',
    narration: '',
    lines: [
      { ledgerId: '', type: 'DEBIT', amount: 0, narration: '' },
      { ledgerId: '', type: 'CREDIT', amount: 0, narration: '' }
    ]
  });
  const [voucherTypeForm, setVoucherTypeForm] = useState({
    name: '',
    code: '',
    category: 'accounting',
    prefix: '',
    nextNumber: 1,
    padding: 5,
    suffix: '',
    isActive: true
  });
  const [budgetForm, setBudgetForm] = useState({
    name: '',
    code: '',
    category: 'ANNUAL',
    totalAmount: 0,
    isAnnual: false,
    isActive: true,
    createGrant: false,
    grantName: '',
    grantCode: '',
    grantAmount: 0,
    grantIsDefault: true,
    grantIsActive: true
  });
  const [grantForm, setGrantForm] = useState({
    budgetTypeId: '',
    name: '',
    code: '',
    amount: 0,
    isDefault: false,
    isActive: true
  });
  const [voucherBudgetForm, setVoucherBudgetForm] = useState({
    budgetTypeId: '',
    budgetGrantId: ''
  });
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const totals = useMemo(
    () => ({
      debit: voucherForm.lines.filter((line) => line.type === 'DEBIT').reduce((sum, line) => sum + Number(line.amount || 0), 0),
      credit: voucherForm.lines.filter((line) => line.type === 'CREDIT').reduce((sum, line) => sum + Number(line.amount || 0), 0)
    }),
    [voucherForm.lines]
  );
  const ledgerTypeRows = useMemo(
    () =>
      (ledgerTypes.length ? ledgerTypes : defaultLedgerTypeCodes.map((code) => ({ code, name: code, isActive: true, isSystem: true }))).map((type) => ({
        ...type,
        statusText: type.isActive ? 'Active' : 'Inactive',
        notesText: type.notes || '-'
      })),
    [ledgerTypes]
  );
  const ledgerTypeLabelMap = useMemo(
    () => Object.fromEntries(ledgerTypeRows.map((type) => [type.code, type.name])),
    [ledgerTypeRows]
  );
  function applyBudgets(budgetData) {
    setBudgets(budgetData);
    const annualBudget = budgetData.find((budget) => budget.isAnnual) || budgetData[0] || null;
    setVoucherForm((current) => ({
      ...current,
      budgetTypeId: current.budgetTypeId && budgetData.some((budget) => budget.id === current.budgetTypeId) ? current.budgetTypeId : annualBudget?.id || '',
      budgetGrantId: current.budgetGrantId && budgetData.some((budget) => budget.grants?.some((grant) => grant.id === current.budgetGrantId)) ? current.budgetGrantId : ''
    }));
  }

  const budgetVoucherEnabled = Boolean(modules.budget && modules.grant);

  function getBudgetById(budgetTypeId) {
    return budgets.find((budget) => budget.id === budgetTypeId) || budgets.find((budget) => budget.isAnnual) || budgets[0] || null;
  }

  function getBudgetByGrantId(grantId) {
    return budgets.find((budget) => budget.grants?.some((grant) => grant.id === grantId)) || budgets.find((budget) => budget.isAnnual) || budgets[0] || null;
  }

  function getGrantById(grantId) {
    const budget = getBudgetByGrantId(grantId);
    return budget?.grants?.find((grant) => grant.id === grantId) || budget?.grants?.find((grant) => grant.isDefault) || budget?.grants?.[0] || null;
  }

  function syncBudgetFromGrant(grantId) {
    const budget = getBudgetByGrantId(grantId);
    const grant = getGrantById(grantId);
    return {
      budgetTypeId: budget?.id || '',
      budgetGrantId: grant?.id || ''
    };
  }

  async function ensureGroups(force = false) {
    if (!force && groupsLoaded && groups.length) return groups;
    const groupData = await api('/accounting/groups');
    setGroups(groupData);
    setGroupsLoaded(true);
    return groupData;
  }

  async function ensureLedgers(force = false) {
    if (!force && ledgersLoaded && ledgers.length) return ledgers;
    const ledgerData = await api('/accounting/ledgers');
    setLedgers(ledgerData);
    setLedgersLoaded(true);
    setSelectedLedgerId((current) => current || ledgerData[0]?.id || '');
    return ledgerData;
  }

  async function ensureLedgerTypes(force = false) {
    if (!force && ledgerTypesLoaded && ledgerTypes.length) return ledgerTypes;
    const ledgerTypeData = await api('/accounting/ledger-types');
    setLedgerTypes(ledgerTypeData);
    setLedgerTypesLoaded(true);
    return ledgerTypeData;
  }

  async function ensureVoucherTypes(force = false) {
    if (!force && voucherTypesLoaded && voucherTypes.length) return voucherTypes;
    const voucherTypeData = await api('/accounting/voucher-types');
    setVoucherTypes(voucherTypeData);
    setVoucherTypesLoaded(true);
    return voucherTypeData;
  }

  async function ensureBudgets(force = false) {
    if (!force && budgetsLoaded && budgets.length) return budgets;
    const budgetData = await api('/accounting/budgets');
    applyBudgets(budgetData);
    setBudgetsLoaded(true);
    return budgetData;
  }

  async function ensureModules(force = false) {
    if (!force && modulesLoaded) return modules;
    const response = await api('/system-setting/modules');
    setModules({ ...defaultModules, ...(response.modules || {}) });
    setModulesLoaded(true);
    return response.modules;
  }

  async function ensureVouchers(force = false) {
    if (!force && vouchersLoaded && vouchers.length) return vouchers;
    const voucherData = await api('/accounting/vouchers');
    setVouchers(voucherData);
    setVouchersLoaded(true);
    if (selectedVoucher) {
      setSelectedVoucher(voucherData.find((voucher) => voucher.id === selectedVoucher.id) || selectedVoucher);
    }
    return voucherData;
  }

  async function ensureTrialBalance(force = false) {
    if (!force && trialBalanceLoaded && trialBalance.length) return trialBalance;
    const trialData = await api('/accounting/reports/trial-balance');
    setTrialBalance(trialData);
    setTrialBalanceLoaded(true);
    return trialData;
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    setError('');
    if (tabIndex === 0) await ensureGroups(force);
    if (tabIndex === 1) await ensureLedgerTypes(force);
    if (tabIndex === 2) await Promise.all([ensureLedgers(force), ensureGroups(force), ensureLedgerTypes(force)]);
    if (tabIndex === 3) await ensureVoucherTypes(force);
    if (tabIndex === 4 || tabIndex === 6) await Promise.all([ensureVouchers(force), ensureVoucherTypes(force), ensureBudgets(force), ensureModules(force)]);
    if (tabIndex === 5) await ensureTrialBalance(force);
    if (tabIndex === 7) {
      const ledgerData = await ensureLedgers(force);
      await ensureVouchers(force);
      const ledgerId = selectedLedgerId || ledgerData[0]?.id || '';
      if (ledgerId && (force || !ledgerReport || ledgerReport.ledger?.id !== ledgerId)) await loadLedgerReport(ledgerId);
    }
    if (tabIndex === 8) await ensureBudgets(force);
    setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
  }

  async function refreshAccountingTab(tabIndex = tab) {
    await loadTabData(tabIndex, true);
    if (tabIndex === 7 && selectedLedgerId) await loadLedgerReport(selectedLedgerId);
  }

  async function handleSearchParams() {
    const ledgerId = searchParams.get('ledger');
    const voucherType = searchParams.get('voucherType');
    const voucherId = searchParams.get('voucher');
    if (ledgerId) {
      const ledgerData = await ensureLedgers();
      if (ledgerData.some((ledger) => ledger.id === ledgerId)) {
        setSelectedLedgerId(ledgerId);
        setVoucherTypeFilter('');
        setSelectedVoucher(null);
        setTab(7);
        await Promise.all([ensureVouchers(), loadLedgerReport(ledgerId)]);
      }
      return;
    }
    if (voucherType) {
      setVoucherTypeFilter(voucherType);
      setSelectedVoucher(null);
      setTab(4);
      await loadTabData(4);
      return;
    }
    if (voucherId) {
      const voucherData = await ensureVouchers();
      setSelectedVoucher(voucherData.find((voucher) => voucher.id === voucherId) || null);
      return;
    }
    setSelectedVoucher(null);
  }

  useEffect(() => {
    loadTabData(tab).catch((loadError) => setError(loadError.message));
  }, [tab]);

  useEffect(() => {
    handleSearchParams().catch((loadError) => setError(loadError.message));
  }, [searchParams]);

  async function save(action, success, close) {
    try {
      setError('');
      setMessage('');
      await action();
      close();
      setMessage(success);
      await refreshAccountingTab();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function updateLine(index, key, value) {
    setVoucherForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line))
    }));
  }

  function addLine() {
    setVoucherForm((current) => ({ ...current, lines: [...current.lines, { ledgerId: '', type: 'DEBIT', amount: 0, narration: '' }] }));
  }

  function updateVoucherBudgetField(key, value) {
    setVoucherForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'budgetGrantId') {
        const synced = syncBudgetFromGrant(value);
        next.budgetTypeId = synced.budgetTypeId;
        next.budgetGrantId = synced.budgetGrantId;
      }
      return next;
    });
  }

  function openBudgetDialog() {
    setBudgetForm({
      name: '',
      code: '',
      category: 'ANNUAL',
      totalAmount: 0,
      isAnnual: false,
      isActive: true,
      createGrant: false,
      grantName: '',
      grantCode: '',
      grantAmount: 0,
      grantIsDefault: true,
      grantIsActive: true
    });
    setBudgetOpen(true);
  }

  function openLedgerTypeDialog(ledgerType) {
    setSelectedLedgerType(ledgerType);
    setLedgerTypeForm({
      name: ledgerType?.name || '',
      code: ledgerType?.code || '',
      notes: ledgerType?.notes || '',
      isActive: ledgerType ? Boolean(ledgerType.isActive) : true
    });
    setLedgerTypeOpen(true);
  }

  async function saveLedgerType() {
    const payload = {
      name: ledgerTypeForm.name.trim(),
      notes: ledgerTypeForm.notes.trim() || undefined,
      isActive: ledgerTypeForm.isActive
    };
    if (!selectedLedgerType) return;
    await save(
      () => api(`/accounting/ledger-types/${selectedLedgerType.id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
      'Ledger type updated',
      () => setLedgerTypeOpen(false)
    );
  }

  function openGrantDialog(budgetTypeId) {
    const budget = getBudgetById(budgetTypeId || voucherForm.budgetTypeId || '');
    setGrantForm({
      budgetTypeId: budget?.id || '',
      name: '',
      code: '',
      amount: 0,
      isDefault: false,
      isActive: true
    });
    setGrantOpen(true);
  }

  function openVoucherBudgetEditor(voucher) {
    const budget = voucher?.budgetGrant ? getBudgetByGrantId(voucher.budgetGrant.id) : getBudgetById(voucher?.budgetTypeId || '');
    const grant = voucher?.budgetGrant || budget?.grants?.find((item) => item.isDefault) || budget?.grants?.[0] || null;
    setVoucherBudgetForm({
      budgetTypeId: budget?.id || '',
      budgetGrantId: grant?.id || ''
    });
    setVoucherBudgetOpen(true);
  }

  async function loadLedgerReport(ledgerId = selectedLedgerId) {
    if (!ledgerId) return;
    setLedgerReport(await api(`/accounting/reports/ledger/${ledgerId}`));
  }

  function openLedger(ledgerId) {
    setSelectedLedgerId(ledgerId);
    setTab(7);
    setSearchParams({ ledger: ledgerId });
    loadLedgerReport(ledgerId).catch((reportError) => setError(reportError.message));
  }

  function openVoucherRegister(voucherType) {
    setVoucherTypeFilter(voucherType);
    setTab(4);
    setSearchParams({ voucherType });
  }

  async function openVoucher(voucher) {
    setSelectedVoucher(voucher);
    const budget = voucher?.budgetGrant ? getBudgetByGrantId(voucher.budgetGrant.id) : getBudgetById(voucher?.budgetTypeId || '');
    const grant = voucher?.budgetGrant || budget?.grants?.find((item) => item.isDefault) || budget?.grants?.[0] || null;
    setVoucherBudgetForm({
      budgetTypeId: budget?.id || '',
      budgetGrantId: grant?.id || ''
    });
    setSearchParams({ voucher: voucher.id });

    try {
      const detail = await api(`/accounting/vouchers/${voucher.id}`);
      setSelectedVoucher(detail);
    } catch (detailError) {
      setError(detailError.message);
    }
  }

  function closeVoucher() {
    setSelectedVoucher(null);
    setVoucherBudgetOpen(false);
    setSearchParams(voucherTypeFilter ? { voucherType: voucherTypeFilter } : {});
  }

  function clearDrillDown(nextTab = tab) {
    setVoucherTypeFilter('');
    setSelectedVoucher(null);
    setSearchParams({});
    setTab(nextTab);
  }

  function ledgerModule(ledger) {
    if (ledger.ledgerType === 'CUSTOMER') return { label: 'Sales', path: '/sales' };
    if (ledger.ledgerType === 'VENDOR') return { label: 'Purchase', path: '/purchase' };
    if (['BANK', 'CASH'].includes(ledger.ledgerType)) return { label: 'Banking', path: '/banking' };
    if (ledger.ledgerType === 'TAX') return { label: 'GST', path: '/gst' };
    if (['RAW_MATERIAL_INVENTORY', 'FINISHED_GOODS_INVENTORY', 'PURCHASE_INVENTORY'].includes(ledger.code)) {
      return { label: 'Inventory', path: '/inventory' };
    }
    if (ledger.code === 'SALARY_EXPENSE' || ledger.code.endsWith('_PAYABLE')) return { label: 'Payroll', path: '/payroll' };
    return null;
  }

  const groupRows = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        ledgerNames: group.ledgers?.map((ledger) => ledger.name).join(', ') || '-'
      })),
    [groups]
  );

  const ledgerRows = useMemo(
    () =>
      ledgers.map((ledger) => {
        const module = ledgerModule(ledger);
        return {
          ...ledger,
          groupName: ledger.group?.name || '-',
          ledgerTypeLabel: ledgerTypeLabelMap[ledger.ledgerType] || ledger.ledgerType,
          openingAmount: Number(ledger.openingBalance || 0),
          openingText: `${ledger.openingType} ${Number(ledger.openingBalance || 0).toFixed(2)}`,
          moduleLabel: module?.label || 'Ledger',
          modulePath: module?.path || ''
        };
      }),
    [ledgerTypeLabelMap, ledgers]
  );

  const voucherTypeRows = useMemo(
    () =>
      voucherTypes.map((type) => ({
        ...type,
        pattern: `${type.prefix}${String(type.nextNumber).padStart(type.padding, '0')}${type.suffix || ''}`,
        statusText: type.isActive ? 'Active' : 'Inactive'
      })),
    [voucherTypes]
  );

  const voucherRows = useMemo(
    () =>
      vouchers.map((voucher) => ({
        ...voucher,
        type: voucher.voucherType,
        date: voucher.voucherDate,
        voucherNoText: voucher.voucherNo,
        budgetName: voucher.budgetType?.name || 'Annual Budget',
        budgetCostCenter: voucher.budgetType?.costCenter?.name || voucher.budgetType?.costCenterId || '-',
        grantName: voucher.budgetGrant?.name || 'Nil',
        lineText: voucher.lines?.map((line) => `${line.ledger?.name || '-'} ${line.type} ${Number(line.amount).toFixed(2)}`).join(' | ') || '-'
      })),
    [vouchers]
  );

  const filteredVoucherRows = useMemo(
    () => (voucherTypeFilter ? voucherRows.filter((voucher) => voucher.voucherType === voucherTypeFilter) : voucherRows),
    [voucherRows, voucherTypeFilter]
  );

  const trialBalanceRows = useMemo(
    () => trialBalance.map((row) => ({ ...row, id: row.ledgerId, debitAmount: Number(row.debit || 0), creditAmount: Number(row.credit || 0) })),
    [trialBalance]
  );

  const ledgerEntryRows = useMemo(
    () =>
      (ledgerReport?.entries || []).map((entry, index) => {
        const voucher = vouchers.find((item) => item.voucherNo === entry.voucherNo && item.voucherType === entry.voucherType);
        return {
          ...entry,
          id: `${entry.voucherNo}-${index}`,
          date: entry.date,
          voucherLabel: `${entry.voucherType} ${entry.voucherNo}`,
          debitAmount: Number(entry.debit || 0),
          creditAmount: Number(entry.credit || 0),
          balanceAmount: Number(entry.balance || 0),
          voucher
        };
      }),
    [ledgerReport, vouchers]
  );

  const budgetRows = useMemo(
    () =>
      budgets.map((budget) => ({
        ...budget,
        typeText: `${budget.category}${budget.isAnnual ? ' (Annual)' : ''}`,
        total: Number(budget.totalAmount || 0),
        received: Number(budget.receivedAmount || 0),
        utilized: Number(budget.utilizedAmount || 0),
        available: Number(budget.availableAmount || 0),
        annualText: budget.isAnnual ? 'Yes' : 'No',
        grantsText: budget.grants?.length
          ? budget.grants
              .map(
                (grant) =>
                  `${grant.name} - received ${Number(grant.receivedAmount || 0).toFixed(2)} | used ${Number(grant.utilizedAmount || 0).toFixed(2)} / ${Number(grant.amount || 0).toFixed(2)}`
              )
              .join('\n')
          : 'No grants'
      })),
    [budgets]
  );

  const voucherTypeOptions = useMemo(() => voucherTypeRows.map((type) => ({ value: type.code, label: type.name })), [voucherTypeRows]);
  const budgetOptions = useMemo(() => budgetRows.map((budget) => ({ value: budget.name, label: budget.name })), [budgetRows]);
  const grantOptions = useMemo(
    () => Array.from(new Set(voucherRows.map((voucher) => voucher.grantName).filter(Boolean))).map((grant) => ({ value: grant, label: grant })),
    [voucherRows]
  );

  const groupColumns = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
      { field: 'code', headerName: 'Code', flex: 0.8, minWidth: 140 },
      { field: 'nature', headerName: 'Nature', flex: 0.8, minWidth: 140 },
      { field: 'ledgerNames', headerName: 'Ledger Names', flex: 1.8, minWidth: 260 }
    ],
    []
  );

  const ledgerColumns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 190,
        renderCell: (params) => <Link component="button" underline="always" onClick={() => openLedger(params.row.id)}>{params.value}</Link>
      },
      { field: 'ledgerTypeLabel', headerName: 'Type', flex: 0.8, minWidth: 150 },
      { field: 'code', headerName: 'Code', flex: 0.8, minWidth: 140 },
      { field: 'groupName', headerName: 'Group', flex: 1, minWidth: 180 },
      { field: 'openingText', headerName: 'Opening', flex: 0.8, minWidth: 150 },
      {
        field: 'actions',
        headerName: 'Go To',
        flex: 0.8,
        minWidth: 150,
        sortable: false,
        filterable: false,
        exportable: false,
        renderCell: (params) =>
          params.row.modulePath ? (
            <Button size="small" endIcon={<ArrowRightOutlined />} onClick={() => navigate(params.row.modulePath)}>
              {params.row.moduleLabel}
            </Button>
          ) : (
            <Button size="small" onClick={() => openLedger(params.row.id)}>Ledger</Button>
          )
      }
    ],
    [navigate]
  );

  const voucherTypeColumns = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 190,
        renderCell: (params) => <Link component="button" underline="always" onClick={() => openVoucherRegister(params.row.code)}>{params.value}</Link>
      },
      { field: 'code', headerName: 'Code', flex: 0.8, minWidth: 140 },
      { field: 'category', headerName: 'Category', flex: 0.8, minWidth: 150 },
      { field: 'pattern', headerName: 'Pattern', flex: 1, minWidth: 160 },
      { field: 'nextNumber', headerName: 'Next', type: 'number', flex: 0.5, minWidth: 110 },
      { field: 'statusText', headerName: 'Status', flex: 0.7, minWidth: 130 }
    ],
    []
  );

  const voucherColumns = useMemo(
    () => [
      { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
      {
        field: 'type',
        headerName: 'Type',
        flex: 0.65,
        minWidth: 130,
        renderCell: (params) => <Link component="button" underline="always" onClick={() => openVoucherRegister(params.row.voucherType)}>{params.value}</Link>
      },
      {
        field: 'voucherNoText',
        headerName: 'Voucher No',
        flex: 0.8,
        minWidth: 150,
        renderCell: (params) => <Link component="button" underline="always" onClick={() => openVoucher(params.row)}>{params.value}</Link>
      },
      ...(budgetVoucherEnabled ? [
        { field: 'budgetName', headerName: 'Budget', flex: 0.9, minWidth: 170 },
        { field: 'budgetCostCenter', headerName: 'Cost Centre', flex: 0.8, minWidth: 150 },
        { field: 'grantName', headerName: 'Grant', flex: 0.8, minWidth: 150 }
      ] : []),
      { field: 'narration', headerName: 'Narration', flex: 1.1, minWidth: 220 },
      { field: 'lineText', headerName: 'Lines', flex: 1.8, minWidth: 320 }
    ],
    [budgetVoucherEnabled]
  );

  const trialBalanceColumns = useMemo(
    () => [
      {
        field: 'ledgerName',
        headerName: 'Ledger',
        flex: 1,
        minWidth: 220,
        renderCell: (params) => <Link component="button" underline="always" onClick={() => openLedger(params.row.ledgerId)}>{params.value}</Link>
      },
      { field: 'groupName', headerName: 'Group', flex: 1, minWidth: 180 },
      { field: 'debitAmount', headerName: 'Debit', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'creditAmount', headerName: 'Credit', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

  const ledgerEntryColumns = useMemo(
    () => [
      { field: 'date', headerName: 'Date', flex: 0.7, minWidth: 130, valueFormatter: (value) => formatDate(value) },
      {
        field: 'voucherLabel',
        headerName: 'Voucher',
        flex: 0.9,
        minWidth: 170,
        renderCell: (params) => (
          <Link component="button" underline="always" disabled={!params.row.voucher} onClick={() => params.row.voucher && openVoucher(params.row.voucher)}>
            {params.value}
          </Link>
        )
      },
      { field: 'narration', headerName: 'Narration', flex: 1.3, minWidth: 240 },
      { field: 'debitAmount', headerName: 'Debit', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'creditAmount', headerName: 'Credit', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'balanceAmount', headerName: 'Balance', type: 'number', flex: 0.8, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(2) }
    ],
    []
  );

  const budgetColumns = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 190 },
      { field: 'code', headerName: 'Code', flex: 0.7, minWidth: 130 },
      { field: 'typeText', headerName: 'Type', flex: 0.8, minWidth: 160 },
      { field: 'annualText', headerName: 'Annual', flex: 0.55, minWidth: 110 },
      { field: 'total', headerName: 'Total', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'received', headerName: 'Received', type: 'number', flex: 0.75, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'utilized', headerName: 'Utilized', type: 'number', flex: 0.75, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      { field: 'available', headerName: 'Available', type: 'number', flex: 0.75, minWidth: 140, valueFormatter: (value) => Number(value || 0).toFixed(2) },
      {
        field: 'grantsText',
        headerName: 'Grants',
        flex: 1.4,
        minWidth: 300,
        renderCell: (params) => (
          <Stack spacing={0.5} sx={{ py: 0.5 }}>
            <Typography variant="caption" sx={{ whiteSpace: 'pre-line' }}>{params.value}</Typography>
            <Button size="small" onClick={() => openGrantDialog(params.row.id)}>Add Grant</Button>
          </Stack>
        )
      }
    ],
    []
  );

  const selectedVoucherLineRows = useMemo(
    () =>
      (selectedVoucher?.lines || []).map((line) => ({
        ...line,
        ledgerName: line.ledger?.name || '-',
        debitAmount: line.type === 'DEBIT' ? Number(line.amount || 0) : null,
        creditAmount: line.type === 'CREDIT' ? Number(line.amount || 0) : null
      })),
    [selectedVoucher]
  );

  const selectedVoucherLineColumns = useMemo(
    () => [
      {
        field: 'ledgerName',
        headerName: 'Ledger',
        flex: 1,
        minWidth: 220,
        renderCell: (params) => <Link component="button" underline="always" onClick={() => { closeVoucher(); openLedger(params.row.ledgerId); }}>{params.value}</Link>
      },
      { field: 'narration', headerName: 'Narration', flex: 1.2, minWidth: 240, valueGetter: (value) => value || '-' },
      { field: 'debitAmount', headerName: 'Debit', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => value === null || value === undefined ? '-' : Number(value).toFixed(2) },
      { field: 'creditAmount', headerName: 'Credit', type: 'number', flex: 0.7, minWidth: 130, valueFormatter: (value) => value === null || value === undefined ? '-' : Number(value).toFixed(2) }
    ],
    [selectedVoucher]
  );

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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between', alignItems: { md: 'center' }, bgcolor: 'grey.50' }}>
            <Breadcrumbs>
              <Link component="button" underline="hover" color="inherit" onClick={() => clearDrillDown(0)}>Accounting Gateway</Link>
              {tab === 7 && ledgerReport && <Typography color="text.primary">{ledgerReport.ledger.name} Ledger</Typography>}
              {tab === 4 && voucherTypeFilter && <Typography color="text.primary">{voucherTypes.find((type) => type.code === voucherTypeFilter)?.name || voucherTypeFilter} Register</Typography>}
              {selectedVoucher && <Typography color="text.primary">{selectedVoucher.voucherNo}</Typography>}
            </Breadcrumbs>
            <Typography variant="caption" color="text.secondary">Select any underlined master or voucher to drill down. Browser Back preserves the path.</Typography>
          </Stack>
          <Tabs value={tab} onChange={(_, value) => clearDrillDown(value)} variant="scrollable" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Groups" />
            <Tab label="Ledger Types" />
            <Tab label="Ledgers" />
            <Tab label="Voucher Types" />
            <Tab label="Vouchers" />
            <Tab label="Trial Balance" />
            <Tab label="Day Book" />
            <Tab label="Ledger Report" />
            <Tab label="Budgets" />
          </Tabs>

          {tab === 0 && (
            <GridPanel label="Create Group" onCreate={() => setGroupOpen(true)}>
              <CommonDataGrid
                title="Account Groups"
                rows={groupRows}
                columns={groupColumns}
                fileName="account-groups"
                searchPlaceholder="Search groups"
                selectFilters={[{ field: 'nature', label: 'Nature', options: natures.map((nature) => ({ value: nature, label: nature })) }]}
              />
            </GridPanel>
          )}

          {tab === 1 && (
            <Stack spacing={2.5} sx={{ p: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h5">Ledger Type Master</Typography>
                  <Typography color="text.secondary">Use this list to control how ledger types are shown in the ledger form.</Typography>
                </Box>
                <Button variant="outlined" startIcon={<ReloadOutlined />} onClick={() => loadTabData(1, true).catch((loadError) => setError(loadError.message))}>
                  Refresh
                </Button>
              </Stack>
              <CommonDataGrid
                title="Ledger Type Master"
                rows={ledgerTypeRows}
                columns={[
                  {
                    field: 'name',
                    headerName: 'Name',
                    flex: 1,
                    minWidth: 220,
                    renderCell: (params) => <Button variant="text" onClick={() => openLedgerTypeDialog(params.row)} sx={{ justifyContent: 'flex-start', px: 0 }}>{params.value}</Button>
                  },
                  { field: 'code', headerName: 'Code', flex: 0.7, minWidth: 140 },
                  { field: 'notesText', headerName: 'Notes', flex: 1.4, minWidth: 250 },
                  { field: 'statusText', headerName: 'Status', flex: 0.6, minWidth: 120 }
                ]}
                fileName="ledger-types"
                searchPlaceholder="Search ledger types"
                selectFilters={[{ field: 'statusText', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }]}
                onRowClick={(params) => openLedgerTypeDialog(params.row)}
              />
            </Stack>
          )}

          {tab === 2 && (
            <GridPanel label="Create Ledger" onCreate={() => { setLedgerForm({ name: '', code: '', groupId: groups[0]?.id || '', ledgerType: ledgerTypeRows[0]?.code || 'GENERAL', openingBalance: 0, openingType: 'DEBIT', bankName: '', bankAccountNo: '', bankIfsc: '', bankBranch: '' }); setLedgerOpen(true); }}>
              <CommonDataGrid
                title="Ledgers"
                rows={ledgerRows}
                columns={ledgerColumns}
                fileName="ledgers"
                searchPlaceholder="Search ledgers"
                selectFilters={[
                  { field: 'ledgerTypeLabel', label: 'Ledger Type', options: ledgerTypeRows.map((type) => ({ value: type.name, label: type.name })) },
                  { field: 'groupName', label: 'Group', options: groupRows.map((group) => ({ value: group.name, label: group.name })) },
                  { field: 'openingType', label: 'Opening Type', options: dc.map((type) => ({ value: type, label: type })) }
                ]}
              />
            </GridPanel>
          )}

          {tab === 3 && (
            <GridPanel label="Create Voucher Type" onCreate={() => { setVoucherTypeForm({ name: '', code: '', category: 'accounting', prefix: '', nextNumber: 1, padding: 5, suffix: '', isActive: true }); setVoucherTypeOpen(true); }}>
              <CommonDataGrid
                title="Voucher Types"
                rows={voucherTypeRows}
                columns={voucherTypeColumns}
                fileName="voucher-types"
                searchPlaceholder="Search voucher types"
                selectFilters={[
                  { field: 'category', label: 'Category', options: Array.from(new Set(voucherTypeRows.map((type) => type.category))).map((category) => ({ value: category, label: category })) },
                  { field: 'statusText', label: 'Status', options: [{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }] }
                ]}
              />
            </GridPanel>
          )}

          {tab === 4 && (
            <GridPanel label="Create Voucher" onCreate={() => {
              const annualBudget = budgets.find((budget) => budget.isAnnual) || budgets[0] || null;
              const defaultGrant = annualBudget?.grants?.find((grant) => grant.isDefault) || annualBudget?.grants?.[0] || null;
              setVoucherForm((current) => ({
                ...current,
                budgetTypeId: annualBudget?.id || '',
                budgetGrantId: defaultGrant?.id || ''
              }));
              setVoucherOpen(true);
            }}>
              <Stack spacing={1.5}>
                {voucherTypeFilter && <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><Chip color="primary" label={`${voucherTypes.find((type) => type.code === voucherTypeFilter)?.name || voucherTypeFilter} Register`} /><Button size="small" onClick={() => clearDrillDown(4)}>Show All Vouchers</Button></Stack>}
                <VoucherGrid rows={filteredVoucherRows} columns={voucherColumns} voucherTypeOptions={voucherTypeOptions} budgetOptions={budgetOptions} grantOptions={grantOptions} fileName="vouchers" onRowClick={(params) => openVoucher(params.row)} />
              </Stack>
            </GridPanel>
          )}

          {tab === 5 && (
            <Box sx={{ p: 2.5 }}>
              <CommonDataGrid
                title="Trial Balance"
                rows={trialBalanceRows}
                columns={trialBalanceColumns}
                fileName="trial-balance"
                searchPlaceholder="Search trial balance"
                selectFilters={[{ field: 'groupName', label: 'Group', options: Array.from(new Set(trialBalanceRows.map((row) => row.groupName))).map((group) => ({ value: group, label: group })) }]}
              />
            </Box>
          )}

          {tab === 6 && (
            <Box sx={{ p: 2.5 }}>
              <VoucherGrid rows={voucherRows} columns={voucherColumns} voucherTypeOptions={voucherTypeOptions} budgetOptions={budgetOptions} grantOptions={grantOptions} fileName="day-book" onRowClick={(params) => openVoucher(params.row)} />
            </Box>
          )}

          {tab === 7 && (
            <Stack spacing={2.5} sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={2}>
                <TextField select label="Ledger" value={selectedLedgerId} onChange={(event) => setSelectedLedgerId(event.target.value)} sx={{ minWidth: 280 }}>
                  {ledgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}
                </TextField>
                <Button variant="contained" onClick={() => loadLedgerReport().catch((reportError) => setError(reportError.message))}>View</Button>
              </Stack>
              {ledgerReport && (
                <CommonDataGrid
                  title={`${ledgerReport.ledger.name} Ledger`}
                  rows={ledgerEntryRows}
                  columns={ledgerEntryColumns}
                  fileName={`${ledgerReport.ledger.code || ledgerReport.ledger.name}-ledger`}
                  searchPlaceholder="Search ledger entries"
                  dateField="date"
                  selectFilters={[{ field: 'voucherType', label: 'Voucher Type', options: voucherTypeOptions }]}
                />
              )}
            </Stack>
          )}

          {tab === 8 && (
            <GridPanel label="Create Budget" onCreate={openBudgetDialog}>
              <CommonDataGrid
                title="Budgets"
                rows={budgetRows}
                columns={budgetColumns}
                fileName="budgets"
                searchPlaceholder="Search budgets"
                height={520}
                selectFilters={[
                  { field: 'category', label: 'Category', options: Array.from(new Set(budgetRows.map((budget) => budget.category))).map((category) => ({ value: category, label: category })) },
                  { field: 'annualText', label: 'Annual', options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] }
                ]}
              />
            </GridPanel>
          )}
        </Box>
      </Grid>

      <Dialog open={ledgerTypeOpen} onClose={() => setLedgerTypeOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); saveLedgerType().catch((saveError) => setError(saveError.message)); }}>
          <DialogTitle>Ledger Type Master</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={ledgerTypeForm.name} onChange={(event) => setLedgerTypeForm({ ...ledgerTypeForm, name: event.target.value })} required />
              <TextField label="Code" value={ledgerTypeForm.code} disabled helperText="Code stays fixed because ledger records use this value." />
              <TextField label="Notes" value={ledgerTypeForm.notes} onChange={(event) => setLedgerTypeForm({ ...ledgerTypeForm, notes: event.target.value })} multiline minRows={3} />
              <TextField select label="Status" value={ledgerTypeForm.isActive ? 'true' : 'false'} onChange={(event) => setLedgerTypeForm({ ...ledgerTypeForm, isActive: event.target.value === 'true' })}>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLedgerTypeOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={groupOpen} onClose={() => setGroupOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/groups', { method: 'POST', body: JSON.stringify(groupForm) }), 'Group created', () => setGroupOpen(false)); }}>
          <DialogTitle>Create Group</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Name" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /><TextField label="Code" value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} required /><TextField select label="Nature" value={groupForm.nature} onChange={(event) => setGroupForm({ ...groupForm, nature: event.target.value })}>{natures.map((nature) => <MenuItem key={nature} value={nature}>{nature}</MenuItem>)}</TextField></Stack></DialogContent>
          <DialogActions><Button onClick={() => setGroupOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={ledgerOpen} onClose={() => setLedgerOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/ledgers', { method: 'POST', body: JSON.stringify({ ...ledgerForm, openingBalance: Number(ledgerForm.openingBalance) }) }), 'Ledger created', () => setLedgerOpen(false)); }}>
          <DialogTitle>Create Ledger</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Name" value={ledgerForm.name} onChange={(event) => setLedgerForm({ ...ledgerForm, name: event.target.value })} required /><TextField label="Code" value={ledgerForm.code} onChange={(event) => setLedgerForm({ ...ledgerForm, code: event.target.value })} required /><TextField select label="Ledger type" value={ledgerForm.ledgerType} onChange={(event) => setLedgerForm({ ...ledgerForm, ledgerType: event.target.value })}>{ledgerTypeRows.map((type) => <MenuItem key={type.code} value={type.code}>{type.name}</MenuItem>)}</TextField><TextField select label="Group" value={ledgerForm.groupId} onChange={(event) => setLedgerForm({ ...ledgerForm, groupId: event.target.value })}>{groups.map((group) => <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>)}</TextField>{ledgerForm.ledgerType === 'BANK' && <><TextField label="Bank name" value={ledgerForm.bankName} onChange={(event) => setLedgerForm({ ...ledgerForm, bankName: event.target.value })} /><TextField label="Account number" value={ledgerForm.bankAccountNo} onChange={(event) => setLedgerForm({ ...ledgerForm, bankAccountNo: event.target.value })} /><TextField label="IFSC" value={ledgerForm.bankIfsc} onChange={(event) => setLedgerForm({ ...ledgerForm, bankIfsc: event.target.value })} /><TextField label="Bank branch" value={ledgerForm.bankBranch} onChange={(event) => setLedgerForm({ ...ledgerForm, bankBranch: event.target.value })} /></>}<TextField type="number" label="Opening balance" value={ledgerForm.openingBalance} onChange={(event) => setLedgerForm({ ...ledgerForm, openingBalance: event.target.value })} /><TextField select label="Opening type" value={ledgerForm.openingType} onChange={(event) => setLedgerForm({ ...ledgerForm, openingType: event.target.value })}>{dc.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField></Stack></DialogContent>
          <DialogActions><Button onClick={() => setLedgerOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={voucherOpen} onClose={() => setVoucherOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/vouchers', { method: 'POST', body: JSON.stringify({ ...voucherForm, lines: voucherForm.lines.map((line) => ({ ...line, amount: Number(line.amount) })) }) }), 'Voucher posted', () => setVoucherOpen(false)); }}>
          <DialogTitle>Create Voucher</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><Grid container spacing={2}><Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Voucher Type" value={voucherForm.voucherTypeId} onChange={(event) => setVoucherForm({ ...voucherForm, voucherTypeId: event.target.value })}>{voucherTypes.map((type) => <MenuItem key={type.id} value={type.id}>{type.name} ({type.prefix}{String(type.nextNumber).padStart(type.padding, '0')}{type.suffix || ''})</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Voucher No (optional)" value={voucherForm.voucherNo} onChange={(event) => setVoucherForm({ ...voucherForm, voucherNo: event.target.value })} helperText="Leave blank for auto number" /></Grid><Grid size={{ xs: 12, md: 4 }}><DateField fullWidth label="Date" value={voucherForm.voucherDate} onChange={(event) => setVoucherForm({ ...voucherForm, voucherDate: event.target.value })} /></Grid></Grid>
            {budgetVoucherEnabled && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    select
                    fullWidth
                    label="Grant"
                    value={voucherForm.budgetGrantId}
                    onChange={(event) => updateVoucherBudgetField('budgetGrantId', event.target.value)}
                    helperText="Budget is picked from the selected grant"
                  >
                    <MenuItem value="">Nil</MenuItem>
                    {budgets.flatMap((budget) => (budget.grants || []).map((grant) => (
                      <MenuItem key={grant.id} value={grant.id}>
                        {budget.name} - {grant.name} ({grant.code})
                      </MenuItem>
                    )))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Budget" value={getBudgetById(voucherForm.budgetTypeId)?.name || 'Annual Budget'} InputProps={{ readOnly: true }} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Cost Centre" value={getBudgetById(voucherForm.budgetTypeId)?.costCenter?.name || '-'} InputProps={{ readOnly: true }} />
                </Grid>
              </Grid>
            )}
            <TextField label="Narration" value={voucherForm.narration} onChange={(event) => setVoucherForm({ ...voucherForm, narration: event.target.value })} />
            {voucherForm.lines.map((line, index) => <Grid container spacing={2} key={index}><Grid size={{ xs: 12, md: 5 }}><TextField select fullWidth label="Ledger" value={line.ledgerId} onChange={(event) => updateLine(index, 'ledgerId', event.target.value)}>{ledgers.map((ledger) => <MenuItem key={ledger.id} value={ledger.id}>{ledger.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="Type" value={line.type} onChange={(event) => updateLine(index, 'type', event.target.value)}>{dc.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Amount" value={line.amount} onChange={(event) => updateLine(index, 'amount', event.target.value)} /></Grid></Grid>)}
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}><Button onClick={addLine}>Add Line</Button><Typography>Debit {totals.debit.toFixed(2)} | Credit {totals.credit.toFixed(2)}</Typography></Stack>
          </Stack></DialogContent>
          <DialogActions><Button onClick={() => setVoucherOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Post Voucher</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={voucherTypeOpen} onClose={() => setVoucherTypeOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api('/accounting/voucher-types', { method: 'POST', body: JSON.stringify({ ...voucherTypeForm, nextNumber: Number(voucherTypeForm.nextNumber), padding: Number(voucherTypeForm.padding) }) }), 'Voucher type created', () => setVoucherTypeOpen(false)); }}>
          <DialogTitle>Create Voucher Type</DialogTitle>
          <DialogContent><Stack spacing={2} sx={{ mt: 1 }}><TextField label="Name" value={voucherTypeForm.name} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, name: event.target.value })} required /><TextField label="Code" value={voucherTypeForm.code} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, code: event.target.value })} required /><TextField label="Category" value={voucherTypeForm.category} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, category: event.target.value })} required /><TextField label="Prefix" value={voucherTypeForm.prefix} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, prefix: event.target.value })} required /><TextField type="number" label="Next Number" value={voucherTypeForm.nextNumber} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, nextNumber: event.target.value })} /><TextField type="number" label="Padding" value={voucherTypeForm.padding} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, padding: event.target.value })} /><TextField label="Suffix" value={voucherTypeForm.suffix} onChange={(event) => setVoucherTypeForm({ ...voucherTypeForm, suffix: event.target.value })} /></Stack></DialogContent>
          <DialogActions><Button onClick={() => setVoucherTypeOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={budgetOpen} onClose={() => setBudgetOpen(false)} fullWidth maxWidth="sm">
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = {
              name: budgetForm.name,
              code: budgetForm.code,
              category: budgetForm.category,
              totalAmount: Number(budgetForm.totalAmount),
              isAnnual: budgetForm.isAnnual,
              isActive: budgetForm.isActive,
              initialGrant: budgetForm.createGrant ? {
                name: budgetForm.grantName,
                code: budgetForm.grantCode,
                amount: Number(budgetForm.grantAmount),
                isDefault: budgetForm.grantIsDefault,
                isActive: budgetForm.grantIsActive
              } : undefined
            };
            save(() => api('/accounting/budgets', { method: 'POST', body: JSON.stringify(payload) }), 'Budget created', () => setBudgetOpen(false));
          }}
        >
          <DialogTitle>Create Budget</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Name" value={budgetForm.name} onChange={(event) => setBudgetForm({ ...budgetForm, name: event.target.value })} required />
              <TextField label="Code" value={budgetForm.code} onChange={(event) => setBudgetForm({ ...budgetForm, code: event.target.value })} required />
              <TextField label="Category" value={budgetForm.category} onChange={(event) => setBudgetForm({ ...budgetForm, category: event.target.value })} />
              <TextField type="number" label="Total Amount" value={budgetForm.totalAmount} onChange={(event) => setBudgetForm({ ...budgetForm, totalAmount: event.target.value })} />
              <TextField select label="Annual Budget" value={budgetForm.isAnnual ? 'yes' : 'no'} onChange={(event) => setBudgetForm({ ...budgetForm, isAnnual: event.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
              <TextField select label="Create Grant Also" value={budgetForm.createGrant ? 'yes' : 'no'} onChange={(event) => setBudgetForm({ ...budgetForm, createGrant: event.target.value === 'yes' })}>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
              {budgetForm.createGrant && (
                <>
                  <TextField label="Grant Name" value={budgetForm.grantName} onChange={(event) => setBudgetForm({ ...budgetForm, grantName: event.target.value })} required />
                  <TextField label="Grant Code" value={budgetForm.grantCode} onChange={(event) => setBudgetForm({ ...budgetForm, grantCode: event.target.value })} required />
                  <TextField type="number" label="Grant Amount" value={budgetForm.grantAmount} onChange={(event) => setBudgetForm({ ...budgetForm, grantAmount: event.target.value })} />
                  <TextField select label="Default Grant" value={budgetForm.grantIsDefault ? 'yes' : 'no'} onChange={(event) => setBudgetForm({ ...budgetForm, grantIsDefault: event.target.value === 'yes' })}>
                    <MenuItem value="yes">Yes</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </TextField>
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setBudgetOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api(`/accounting/budgets/${grantForm.budgetTypeId}/grants`, { method: 'POST', body: JSON.stringify({ ...grantForm, amount: Number(grantForm.amount) }) }), 'Grant created', () => setGrantOpen(false)); }}>
          <DialogTitle>Create Grant</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Budget" value={grantForm.budgetTypeId} onChange={(event) => setGrantForm({ ...grantForm, budgetTypeId: event.target.value })} required>
                {budgets.map((budget) => <MenuItem key={budget.id} value={budget.id}>{budget.name}</MenuItem>)}
              </TextField>
              <TextField label="Name" value={grantForm.name} onChange={(event) => setGrantForm({ ...grantForm, name: event.target.value })} required />
              <TextField label="Code" value={grantForm.code} onChange={(event) => setGrantForm({ ...grantForm, code: event.target.value })} required />
              <TextField type="number" label="Amount" value={grantForm.amount} onChange={(event) => setGrantForm({ ...grantForm, amount: event.target.value })} />
              <TextField select label="Default Grant" value={grantForm.isDefault ? 'yes' : 'no'} onChange={(event) => setGrantForm({ ...grantForm, isDefault: event.target.value === 'yes' })}>
                <MenuItem value="yes">Yes</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setGrantOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Dialog open={voucherBudgetOpen} onClose={() => setVoucherBudgetOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); save(() => api(`/accounting/vouchers/${selectedVoucher.id}/budget`, { method: 'PATCH', body: JSON.stringify({ budgetTypeId: voucherBudgetForm.budgetTypeId || null, budgetGrantId: voucherBudgetForm.budgetGrantId || null }) }), 'Voucher budget updated', () => setVoucherBudgetOpen(false)); }}>
          <DialogTitle>Edit Voucher Budget</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                label="Grant"
                value={voucherBudgetForm.budgetGrantId}
                onChange={(event) => {
                  const synced = syncBudgetFromGrant(event.target.value);
                  setVoucherBudgetForm({
                    budgetTypeId: synced.budgetTypeId,
                    budgetGrantId: synced.budgetGrantId
                  });
                }}
                helperText="Budget and cost centre come from the selected grant"
              >
                <MenuItem value="">Nil</MenuItem>
                {budgets.flatMap((budget) => (budget.grants || []).map((grant) => (
                  <MenuItem key={grant.id} value={grant.id}>
                    {budget.name} - {grant.name}
                  </MenuItem>
                )))}
              </TextField>
              <TextField fullWidth label="Budget" value={getBudgetById(voucherBudgetForm.budgetTypeId)?.name || 'Annual Budget'} InputProps={{ readOnly: true }} />
              <TextField fullWidth label="Cost Centre" value={getBudgetById(voucherBudgetForm.budgetTypeId)?.costCenter?.name || '-'} InputProps={{ readOnly: true }} />
            </Stack>
          </DialogContent>
          <DialogActions><Button onClick={() => setVoucherBudgetOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </Box>
      </Dialog>

      <Drawer anchor="right" open={Boolean(selectedVoucher)} onClose={closeVoucher} ModalProps={{ keepMounted: true }}>
        <Box sx={{ width: { xs: '100vw', sm: 560 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', px: 2.5, py: 2 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">Voucher Detail</Typography>
              <Typography variant="h5">{selectedVoucher?.voucherType?.toUpperCase()} {selectedVoucher?.voucherNo}</Typography>
              <Typography variant="caption" color="text.secondary">Select any voucher row to open its detail here.</Typography>
            </Box>
            <IconButton onClick={closeVoucher} aria-label="Close voucher details">
              <CloseOutlined />
            </IconButton>
          </Stack>
          <Divider />
          {selectedVoucher && (
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              <Stack spacing={2}>
                <Grid container spacing={2}>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Date</Typography><Typography>{formatDate(selectedVoucher.voucherDate)}</Typography></Grid>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Status</Typography><Chip size="small" color="success" label={selectedVoucher.status} sx={{ mt: 0.5 }} /></Grid>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Branch</Typography><Typography>{selectedVoucher.branch?.name || '-'}</Typography></Grid>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Voucher Type</Typography><Typography>{selectedVoucher.voucherType}</Typography></Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Budget</Typography><Typography>{selectedVoucher.budgetType?.name || 'Annual Budget'}</Typography></Grid>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Grant</Typography><Typography>{selectedVoucher.budgetGrant?.name || 'Nil'}</Typography></Grid>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Cost Centre</Typography><Typography>{selectedVoucher.budgetType?.costCenter?.name || '-'}</Typography></Grid>
                  <Grid size={6}><Typography color="text.secondary" variant="caption">Lines</Typography><Typography>{selectedVoucher.lines?.length || 0}</Typography></Grid>
                </Grid>
                <Box>
                  <Typography color="text.secondary" variant="caption">Narration</Typography>
                  <Typography sx={{ mt: 0.5 }}>{selectedVoucher.narration || 'No narration'}</Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                  <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2">Debit: {Number(selectedVoucherLineRows.filter((line) => line.debitAmount !== null).reduce((sum, line) => sum + Number(line.debitAmount || 0), 0)).toFixed(2)}</Typography>
                    <Typography variant="body2">Credit: {Number(selectedVoucherLineRows.filter((line) => line.creditAmount !== null).reduce((sum, line) => sum + Number(line.creditAmount || 0), 0)).toFixed(2)}</Typography>
                  </Stack>
                </Box>
                <CommonDataGrid
                  title={`${selectedVoucher.voucherNo} Lines`}
                  rows={selectedVoucherLineRows}
                  columns={selectedVoucherLineColumns}
                  fileName={`${selectedVoucher.voucherNo}-lines`}
                  searchPlaceholder="Search voucher lines"
                  height={320}
                  pageSize={25}
                  selectFilters={[{ field: 'type', label: 'Debit/Credit', options: dc.map((type) => ({ value: type, label: type })) }]}
                />
                {!selectedVoucherLineRows.length && (
                  <Alert severity="info">No voucher entries were stored for this voucher.</Alert>
                )}
              </Stack>
            </Box>
          )}
          <Divider />
          <Stack direction="row" spacing={1} sx={{ p: 2.5, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Button onClick={() => { const type = selectedVoucher?.voucherType; closeVoucher(); if (type) openVoucherRegister(type); }}>Open {selectedVoucher?.voucherType} Register</Button>
            {budgetVoucherEnabled && <Button onClick={() => openVoucherBudgetEditor(selectedVoucher)}>Edit Budget / Grant</Button>}
            <Button variant="contained" onClick={closeVoucher}>Close</Button>
          </Stack>
        </Box>
      </Drawer>
    </Grid>
  );
}

function GridPanel({ label, onCreate, children }) {
  return <Stack spacing={2.5} sx={{ p: 2.5 }}><Stack direction="row" sx={{ justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<PlusOutlined />} onClick={onCreate}>{label}</Button></Stack>{children}</Stack>;
}

function VoucherGrid({ rows, columns, voucherTypeOptions, budgetOptions, grantOptions, fileName, onRowClick }) {
  return (
    <CommonDataGrid
      title="Vouchers"
      rows={rows}
      columns={columns}
      fileName={fileName}
      searchPlaceholder="Search vouchers"
      dateField="date"
      height={520}
      onRowClick={onRowClick}
        selectFilters={[
          { field: 'type', label: 'Voucher Type', options: voucherTypeOptions },
        { field: 'budgetName', label: 'Budget', options: budgetOptions },
        { field: 'grantName', label: 'Grant', options: grantOptions }
        ]}
    />
  );
}




