import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import CommonDataGrid from 'components/CommonDataGrid';
import MainCard from 'components/MainCard';

const NLP_API_URL = String(import.meta.env.VITE_NLP_API_URL || 'http://localhost:8003')
  .trim()
  .replace(/\/+$/, '');
const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1')
  .trim()
  .replace(/\/+$/, '');

function normalize(value = '') {
  return String(value).trim().toLowerCase();
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parsePromptDate(value) {
  if (!value) return null;
  const cleaned = String(value).trim().replace(/,/g, '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const formats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'DD MMM YYYY', 'DD MMMM YYYY', 'DD/MM/YY', 'DD-MM-YY'];
  for (const format of formats) {
    let match = null;
    if (format === 'YYYY-MM-DD') match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    else if (format === 'DD/MM/YYYY') match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    else if (format === 'DD-MM-YYYY') match = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    else if (format === 'DD/MM/YY') match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    else if (format === 'DD-MM-YY') match = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    else if (format === 'DD MMM YYYY') match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    else if (format === 'DD MMMM YYYY') match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{4,})\s+(\d{4})$/);

    if (!match) continue;

    const monthLookup = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };

    let year;
    let month;
    let day;
    if (format === 'YYYY-MM-DD') {
      [, year, month, day] = match;
    } else if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY') {
      [, day, month, year] = match;
    } else if (format === 'DD/MM/YY' || format === 'DD-MM-YY') {
      [, day, month, year] = match;
      year = Number(year) < 50 ? `20${year}` : `19${year}`;
    } else {
      [, day, month, year] = match;
      month = String(monthLookup[String(month).toLowerCase()]) || month;
    }

    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

function extractPromptDateRange(prompt = '') {
  const text = String(prompt || '');
  const datePattern = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4})';
  const rangePatterns = [
    new RegExp(`\\bfrom\\s+(${datePattern})\\s+(?:to|till|until|upto|up to|-)\\s+(${datePattern})\\b`, 'i'),
    new RegExp(`\\bbetween\\s+(${datePattern})\\s+(?:and|to|-)\\s+(${datePattern})\\b`, 'i'),
    new RegExp(`\\bfor\\s+(?:the\\s+)?period\\s+(${datePattern})\\s+(?:to|till|until|-)\\s+(${datePattern})\\b`, 'i')
  ];
  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        from: parsePromptDate(match[1]),
        to: parsePromptDate(match[2])
      };
    }
  }

  const untilPatterns = [new RegExp(`\\b(?:as of|till|until|upto|up to)\\s+(${datePattern})\\b`, 'i')];
  for (const pattern of untilPatterns) {
    const match = text.match(pattern);
    if (match) {
      return { from: null, to: parsePromptDate(match[1]) };
    }
  }

  return { from: null, to: null };
}

function buildSuggestionSeed(prompt = '', companyName = '') {
  const text = String(prompt || '').trim();
  const fallback = String(companyName || '').trim();
  if (!text) return fallback;

  return text
    .replace(/\bfrom\s+(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+(?:to|till|until|upto|up to|-)\s+(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/gi, ' ')
    .replace(/\b(?:as of|till|until|upto|up to)\s+(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/gi, ' ')
    .replace(/\b(voucher detail|voucher details|voucher list|voucher report|day book|trial balance|profit and loss|profit loss|balance sheet|stock summary|stock report|inventory report|customer outstanding|vendor outstanding|receivables|payables|gstr-1|gstr 1|gstr-3b|gstr 3b|input tax credit|itc|hsn summary|hsn report|hsn|show|report|reports|detail|details|summary|company|of|for|from|about|between|and|to|till|until|upto|up to)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function extractRows(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.result)) return value.result;
  return [];
}

function extractSections(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.sections && typeof value.sections === 'object') return value.sections;
    const sectionKeys = ['income', 'expenses', 'assets', 'liabilities', 'equity'];
    if (sectionKeys.some((key) => Array.isArray(value[key]))) {
      return {
        ...('period' in value ? { period: value.period } : {}),
        ...('asOf' in value ? { asOf: value.asOf } : {}),
        ...('currentPeriodProfit' in value ? { currentPeriodProfit: value.currentPeriodProfit } : {}),
        ...('totalIncome' in value ? { totalIncome: value.totalIncome } : {}),
        ...('totalExpenses' in value ? { totalExpenses: value.totalExpenses } : {}),
        ...('netProfit' in value ? { netProfit: value.netProfit } : {}),
        ...('totalAssets' in value ? { totalAssets: value.totalAssets } : {}),
        ...('totalLiabilities' in value ? { totalLiabilities: value.totalLiabilities } : {}),
        ...('totalEquity' in value ? { totalEquity: value.totalEquity } : {}),
        ...('totalLiabilitiesAndEquity' in value ? { totalLiabilitiesAndEquity: value.totalLiabilitiesAndEquity } : {}),
        ...('difference' in value ? { difference: value.difference } : {}),
        income: value.income || [],
        expenses: value.expenses || [],
        assets: value.assets || [],
        liabilities: value.liabilities || [],
        equity: value.equity || []
      };
    }
  }
  return value || {};
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || response.statusText || 'Request failed');
  }
  return data;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || response.statusText || 'Request failed');
  }
  return data;
}

function renderTable(title, rows) {
  if (!rows?.length) {
    return <Alert severity="info">No rows matched this report.</Alert>;
  }

  const columns = Object.keys(rows[0] || {})
    .filter((column) => !['lines'].includes(column))
    .map((column) => ({
      field: column,
      headerName: column,
      flex: column.toLowerCase().includes('narration') ? 1.4 : 1,
      minWidth: column.toLowerCase().includes('narration') ? 220 : 140,
      renderCell: ({ value }) => formatCell(value, column)
    }));

  return <CommonDataGrid title={title} rows={rows} columns={columns} getRowId={(row, index) => row.id || row.itemId || row.ledgerId || index} fileName="smart-report-result" searchPlaceholder="Search result rows" height={420} />;
}

function StatementGrid({ title, rows }) {
  if (!rows?.length) {
    return <Alert severity="info">No rows matched this report.</Alert>;
  }

  const columns = [
    {
      field: 'ledgerName',
      headerName: 'Ledger',
      flex: 1.3,
      minWidth: 220,
      renderCell: ({ row }) => row.ledgerName || row.itemName || row.name || '-'
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 160,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({ value }) => formatValue(value)
    },
    {
      field: 'groupName',
      headerName: 'Group',
      flex: 1,
      minWidth: 180,
      renderCell: ({ value }) => value || '-'
    },
    {
      field: 'nature',
      headerName: 'Nature',
      width: 140,
      renderCell: ({ value }) => value || '-'
    }
  ];

  return <CommonDataGrid title={title} rows={rows} columns={columns} getRowId={(row, index) => row.id || row.ledgerId || row.itemId || index} fileName="statement-grid" searchPlaceholder="Search ledger or group" height={360} />;
}

function formatCell(value, column) {
  if (value === null || value === undefined || value === '') return '-';
  if (column.toLowerCase().includes('date')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? formatValue(value) : date.toLocaleDateString('en-IN');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return formatValue(value);
}

function StatementSection({ title, value }) {
  if (Array.isArray(value)) {
    return (
      <MainCard title={title} contentSX={{ p: 0 }}>
        <Box sx={{ p: 2 }}>
          <StatementGrid rows={value} />
        </Box>
      </MainCard>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <MainCard title={title}>
        <Stack spacing={1}>
          {Object.entries(value).map(([key, entry]) => (
            <Box key={key}>
              <Typography variant="caption" color="text.secondary">
                {key}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatValue(entry)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </MainCard>
    );
  }

  return (
    <MainCard title={title}>
      <Typography variant="body2">{formatValue(value)}</Typography>
    </MainCard>
  );
}

function VoucherList({ rows }) {
  if (!rows?.length) {
    return <Alert severity="info">No vouchers were found for this prompt.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {rows.map((voucher) => (
        <Card key={voucher.id} variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {voucher.voucherType} - {voucher.voucherNo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatCell(voucher.voucherDate, 'voucherDate')}
                    {voucher.narration ? ` - ${voucher.narration}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={`Debit ${formatValue(voucher.totalDebit)}`} color="primary" variant="outlined" />
                  <Chip label={`Credit ${formatValue(voucher.totalCredit)}`} color="secondary" variant="outlined" />
                  <Chip label={`${voucher.lines?.length || 0} lines`} />
                </Stack>
              </Stack>

              <Box component="details" sx={{ '& summary': { cursor: 'pointer', fontWeight: 600, mb: 1 } }}>
                <summary>Show voucher lines</summary>
                <CommonDataGrid
                  title={`Voucher Lines - ${voucher.voucherNo}`}
                  rows={voucher.lines || []}
                  columns={[
                    { field: 'ledgerName', headerName: 'Ledger', flex: 1.2, minWidth: 220, renderCell: ({ value }) => value || '-' },
                    { field: 'type', headerName: 'Type', width: 120, renderCell: ({ value }) => value || '-' },
                    { field: 'amount', headerName: 'Amount', width: 150, align: 'right', headerAlign: 'right', renderCell: ({ value }) => formatValue(value) },
                    { field: 'narration', headerName: 'Narration', flex: 1.2, minWidth: 220, renderCell: ({ value }) => value || '-' }
                  ]}
                  getRowId={(line, lineIndex) => `${voucher.id}-${lineIndex}`}
                  fileName={`voucher-lines-${voucher.voucherNo}`}
                  searchPlaceholder="Search voucher lines"
                  height={260}
                  pageSize={5}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

function jsonPreview(value) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        overflow: 'auto',
        bgcolor: 'grey.50',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        fontSize: 13
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Box>
  );
}

export default function SmartReportsPage() {
  const [prompt, setPrompt] = useState('Show voucher detail of ABC company');
  const [companyName, setCompanyName] = useState('ABC');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = normalize(buildSuggestionSeed(prompt, companyName));
    if (query.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      try {
        const data = await getJson(`${NLP_API_URL}/suggestions?q=${encodeURIComponent(query)}`);
        if (active) {
          setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
        }
      } catch {
        if (active) setSuggestions([]);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [companyName, prompt]);

  function applySuggestion(suggestion) {
    const name = suggestion.name || suggestion.displayLabel || '';
    if (suggestion.companyName) {
      setCompanyName(suggestion.companyName);
    } else if (suggestion.kind === 'company' && name) {
      setCompanyName(name);
    }

    setPrompt((current) => {
      const existing = String(current || '').trim();
      const normalizedExisting = normalize(existing);
      const normalizedName = normalize(name);

      if (!existing) {
        return suggestion.kind === 'company' ? `Show voucher detail of ${name}` : name;
      }

      if (normalizedName && normalizedExisting.includes(normalizedName)) {
        return existing;
      }

      if (suggestion.kind === 'company') {
        if (/\bcompany\b/i.test(existing)) {
          return existing.replace(/(?:of|for|from|about)\s+(.+?)\s+company\b/i, `of ${name} company`);
        }
        return `${existing} ${name}`.trim();
      }

      return `${existing} ${name}`.trim();
    });
  }

  async function runReport() {
    if (!normalize(prompt)) {
      setError('Please type a report prompt first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await postJson(`${NLP_API_URL}/report`, {
        prompt,
        companyName,
        from: from || null,
        to: to || null
      });
      setResult(data);
      return;
    } catch (pythonError) {
      try {
        const parse = await postJson(`${NLP_API_URL}/parse`, { prompt, companyName });
        const report = parse.parse || {};
        const companies = await getJson(`${NLP_API_URL}/companies`);
        const companyHint = parse.parse?.company_name || companyName;
        const list = companies?.companies || [];
        const resolvedCompany =
          list.find((company) => normalize(company.name) === normalize(companyHint)) ||
          list.find((company) => normalize(company.name).includes(normalize(companyHint))) ||
          list[0];

        if (!resolvedCompany) {
          throw new Error(
            companyHint ? `I could not find a company named "${companyHint}".` : 'Please include a company name in your prompt.'
          );
        }

        const promptRange = extractPromptDateRange(prompt);
        const resolvedFrom = from || promptRange.from;
        const resolvedTo = to || promptRange.to;
        const query = new URLSearchParams({
          companyId: resolvedCompany.id,
          ...(resolvedFrom ? { from: resolvedFrom } : {}),
          ...(resolvedTo ? { to: resolvedTo } : {})
        });

        const fallbackRoutes = {
          'voucher-detail': async () => {
            const raw = await getJson(`${API_URL}/accounting/vouchers?${query.toString()}`);
            return {
              kind: 'voucher-list',
              rows: Array.isArray(raw)
                ? raw.map((voucher) => ({
                    ...voucher,
                    totalDebit: Number(
                      (voucher.lines || [])
                        .filter((line) => line.type === 'DEBIT')
                        .reduce((sum, line) => sum + Number(line.amount), 0)
                        .toFixed(2)
                    ),
                    totalCredit: Number(
                      (voucher.lines || [])
                        .filter((line) => line.type === 'CREDIT')
                        .reduce((sum, line) => sum + Number(line.amount), 0)
                        .toFixed(2)
                    ),
                    lines: (voucher.lines || []).map((line) => ({
                      ledgerName: line.ledger?.name || '',
                      type: line.type,
                      amount: Number(line.amount),
                      narration: line.narration || ''
                    }))
                  }))
                : []
            };
          },
          'trial-balance': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/accounting/reports/trial-balance?${query.toString()}`))
          }),
          'profit-loss': async () => ({
            kind: 'statement',
            sections: extractSections(await getJson(`${API_URL}/reports/profit-loss?${query.toString()}`))
          }),
          'balance-sheet': async () => ({
            kind: 'statement',
            sections: extractSections(await getJson(`${API_URL}/reports/balance-sheet?${query.toString()}`))
          }),
          'stock-summary': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/inventory/reports/stock-summary`))
          }),
          'customer-outstanding': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/sales/reports/customer-outstanding`))
          }),
          'vendor-outstanding': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/purchase/reports/vendor-outstanding`))
          }),
          'gstr-1': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/gst/reports/gstr-1?${query.toString()}`))
          }),
          'gstr-3b': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/gst/reports/gstr-3b?${query.toString()}`))
          }),
          itc: async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/gst/reports/itc?${query.toString()}`))
          }),
          'hsn-summary': async () => ({
            kind: 'table',
            rows: extractRows(await getJson(`${API_URL}/gst/reports/hsn-summary?${query.toString()}`))
          })
        };

        const fallback = fallbackRoutes[report.report_key] || fallbackRoutes['voucher-detail'];
        const payload = await fallback();

        setResult({
          ok: true,
          source: 'backend-fallback',
          parse: parse.parse,
          report: {
            key: report.report_key,
            title: report.report_title,
            kind: report.report_kind,
            endpoint: report.report_endpoint
          },
          company: resolvedCompany,
          period: { from: resolvedFrom || null, to: resolvedTo || null },
          ...payload
        });
      } catch (fallbackError) {
        setResult(null);
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : pythonError instanceof Error
              ? pythonError.message
              : 'Unable to run report'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <MainCard
          title="Smart Reports"
          sx={{
            background: 'linear-gradient(135deg, rgba(18, 33, 78, 0.96) 0%, rgba(34, 60, 136, 0.92) 55%, rgba(72, 105, 196, 0.88) 100%)',
            color: 'common.white'
          }}
          contentSX={{ color: 'common.white' }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            Type a name and the app will suggest real records from your database.
          </Typography>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="Prompt">
          <Stack spacing={2}>
            <TextField
              label="What do you want to see?"
              multiline
              minRows={5}
              fullWidth
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Type something like: voucher detail of abc"
            />

            {suggestions.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  Live suggestions
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {suggestions.map((suggestion) => (
                    <Chip
                      key={`${suggestion.kind}-${suggestion.id}`}
                      label={suggestion.displayLabel || suggestion.label}
                      variant="outlined"
                      onClick={() => applySuggestion(suggestion)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Stack>
            )}

            <TextField
              label="Company name (optional)"
              fullWidth
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Default Company"
              helperText="Suggestions come from real database records."
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="From"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <TextField
                label="To"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Stack>

            <Button variant="contained" size="large" onClick={runReport} disabled={loading}>
              {loading ? 'Running report...' : 'Run report'}
            </Button>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="Result">
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}

            {!result && !error && <Alert severity="info">Run a prompt to see the report.</Alert>}

            {result && (
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={result.report?.title || 'Report'} color="primary" />
                  {result.company && <Chip label={result.company.name} color="secondary" />}
                  {result.period?.from && <Chip label={`From ${result.period.from}`} variant="outlined" />}
                  {result.period?.to && <Chip label={`To ${result.period.to}`} variant="outlined" />}
                  {result.source && <Chip label={result.source} variant="outlined" />}
                  {result.parse?.confidence !== undefined && (
                    <Chip label={`NLP ${(Number(result.parse.confidence) * 100).toFixed(0)}%`} variant="outlined" />
                  )}
                </Stack>

                {result.kind === 'voucher-list' && <VoucherList rows={result.rows} />}
                {result.kind === 'table' && renderTable(result.report?.title || 'Smart Report Result', result.rows || [])}
                {result.kind === 'statement' && (
                  <Stack spacing={2}>
                    {Object.entries(result.sections || {}).map(([key, value]) => (
                      <StatementSection key={key} title={key} value={value} />
                    ))}
                  </Stack>
                )}
                {result.kind === 'json' && jsonPreview(result.data)}
              </Stack>
            )}
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
