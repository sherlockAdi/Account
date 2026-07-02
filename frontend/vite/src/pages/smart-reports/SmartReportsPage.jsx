import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

const NLP_API_URL = String(import.meta.env.VITE_NLP_API_URL || 'http://localhost:8003')
  .trim()
  .replace(/\/+$/, '');
const API_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1')
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

function renderTable(rows) {
  if (!rows?.length) {
    return <Alert severity="info">No rows matched this report.</Alert>;
  }

  const columns = Object.keys(rows[0] || {}).filter((column) => !['lines'].includes(column));

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={row.id || row.itemId || row.ledgerId || rowIndex} hover>
              {columns.map((column) => (
                <TableCell key={column}>{formatCell(row[column], column)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function StatementGrid({ rows }) {
  if (!rows?.length) {
    return <Alert severity="info">No rows matched this report.</Alert>;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: 'divider'
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1.3fr 0.8fr', md: '1.6fr 1.1fr 0.8fr 0.9fr' },
          bgcolor: 'grey.100',
          borderBottom: 1,
          borderColor: 'divider',
          px: 2,
          py: 1.25,
          gap: 1
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          Ledger
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700} textAlign="right">
          Amount
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: { xs: 'none', md: 'block' } }}>
          Group
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: { xs: 'none', md: 'block' } }}>
          Nature
        </Typography>
      </Box>

      <Stack spacing={0}>
        {rows.map((row, index) => (
          <Box
            key={row.id || row.ledgerId || row.itemId || index}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1.3fr 0.8fr', md: '1.6fr 1.1fr 0.8fr 0.9fr' },
              gap: 1,
              px: 2,
              py: 1.5,
              borderBottom: index === rows.length - 1 ? 0 : 1,
              borderColor: 'divider',
              alignItems: 'center',
              bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50'
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight={700}>
                {row.ledgerName || row.itemName || row.name || '-'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' } }}>
                {row.groupName || '-'} {row.nature ? `- ${row.nature}` : ''}
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' } }}>
              {row.groupName || '-'}
            </Typography>
            <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' } }}>
              {row.nature || '-'}
            </Typography>
            <Typography variant="body2" textAlign="right" fontWeight={700}>
              {formatValue(row.amount)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
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
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Ledger</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Narration</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(voucher.lines || []).map((line, lineIndex) => (
                        <TableRow key={`${voucher.id}-${lineIndex}`}>
                          <TableCell>{line.ledgerName || '-'}</TableCell>
                          <TableCell>{line.type || '-'}</TableCell>
                          <TableCell align="right">{formatValue(line.amount)}</TableCell>
                          <TableCell>{line.narration || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
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
    const query = normalize(prompt || companyName);
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
    const value = suggestion.kind === 'company' ? suggestion.name : suggestion.name;
    setPrompt(value);
    if (suggestion.companyName) {
      setCompanyName(suggestion.companyName);
    } else if (suggestion.kind === 'company') {
      setCompanyName(suggestion.name);
    }
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

        const query = new URLSearchParams({
          companyId: resolvedCompany.id,
          ...(from ? { from } : {}),
          ...(to ? { to } : {})
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
            kind: 'json',
            data: await getJson(`${API_URL}/accounting/reports/trial-balance?${query.toString()}`)
          }),
          'profit-loss': async () => ({ kind: 'json', data: await getJson(`${API_URL}/reports/profit-loss?${query.toString()}`) }),
          'balance-sheet': async () => ({ kind: 'json', data: await getJson(`${API_URL}/reports/balance-sheet?${query.toString()}`) }),
          'stock-summary': async () => ({ kind: 'json', data: await getJson(`${API_URL}/inventory/reports/stock-summary`) }),
          'customer-outstanding': async () => ({ kind: 'json', data: await getJson(`${API_URL}/sales/reports/customer-outstanding`) }),
          'vendor-outstanding': async () => ({ kind: 'json', data: await getJson(`${API_URL}/purchase/reports/vendor-outstanding`) }),
          'gstr-1': async () => ({ kind: 'json', data: await getJson(`${API_URL}/gst/reports/gstr-1?${query.toString()}`) }),
          'gstr-3b': async () => ({ kind: 'json', data: await getJson(`${API_URL}/gst/reports/gstr-3b?${query.toString()}`) }),
          itc: async () => ({ kind: 'json', data: await getJson(`${API_URL}/gst/reports/itc?${query.toString()}`) }),
          'hsn-summary': async () => ({ kind: 'json', data: await getJson(`${API_URL}/gst/reports/hsn-summary?${query.toString()}`) })
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
          period: { from: from || null, to: to || null },
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
                      label={suggestion.label}
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
                {result.kind === 'table' && renderTable(result.rows || [])}
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
