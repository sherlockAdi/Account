'use client';

import { useState } from 'react';

// material-ui
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
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

// project imports
import MainCard from 'components/MainCard';
import { REPORT_CATALOG } from 'utils/report-router';

const examplePrompts = [
  'Show voucher detail of ABC company',
  'Give me trial balance of ABC company',
  'Show profit and loss report for ABC company',
  'Show balance sheet of ABC company'
];

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return moneyFormatter.format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return Object.keys(rows[0]).filter((key) => key !== 'lines');
}

function renderTableRows(rows) {
  if (!rows?.length) {
    return <Alert severity="info">No rows matched this report.</Alert>;
  }

  const columns = getColumns(rows);
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
            <TableRow key={row.id || rowIndex} hover>
              {columns.map((column) => (
                <TableCell key={column}>
                  {column.toLowerCase().includes('date') ? formatDate(row[column]) : formatValue(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function VoucherListSection({ rows }) {
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
                    {formatDate(voucher.voucherDate)} {voucher.narration ? `- ${voucher.narration}` : ''}
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

function StatementSection({ title, value }) {
  if (Array.isArray(value)) {
    return (
      <MainCard title={title} contentSX={{ p: 0 }}>
        {renderTableRows(value)}
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

export default function SmartReports() {
  const [prompt, setPrompt] = useState('Show voucher detail of ABC company');
  const [companyName, setCompanyName] = useState('ABC');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runReport = async () => {
    if (!prompt.trim()) {
      setError('Please type a report prompt first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/reports/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          companyName,
          from: from || undefined,
          to: to || undefined
        })
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || 'Unable to run report');
      }

      setResult(data);
    } catch (fetchError) {
      setResult(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to run report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <MainCard
        title="Smart Reports"
        subheader="Type what you want in plain English and the system will route it to the right report."
        sx={{
          mb: 3,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(18, 33, 78, 0.96) 0%, rgba(34, 60, 136, 0.92) 55%, rgba(72, 105, 196, 0.88) 100%)',
          color: 'common.white'
        }}
        contentSX={{ color: 'common.white' }}
      >
        <Stack spacing={2}>
          <Typography variant="body1" sx={{ maxWidth: 760, color: 'rgba(255,255,255,0.9)' }}>
            Try phrases like "voucher detail of ABC company", "trial balance for ABC company", or "balance sheet of ABC company".
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {examplePrompts.map((item) => (
              <Chip
                key={item}
                label={item}
                onClick={() => {
                  setPrompt(item);
                  const companyHint = item.match(/(.+?)\s+company/i)?.[1]?.replace(/^(show|give me|display|get|find|all|the)\s+/i, '').trim();
                  if (companyHint) {
                    setCompanyName(companyHint.replace(/\s+(detail|details|report|reports)$/i, ''));
                  }
                }}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'common.white',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' }
                }}
              />
            ))}
          </Stack>
        </Stack>
      </MainCard>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <MainCard title="Prompt" subheader="This is the only input the user needs most of the time.">
            <Stack spacing={2}>
              <TextField
                label="What do you want to see?"
                multiline
                minRows={5}
                fullWidth
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: show voucher detail of ABC company"
              />

              <TextField
                label="Company name (optional)"
                fullWidth
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="ABC Company"
                helperText="Leave this blank if your prompt already includes the company name."
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

              <Button variant="contained" size="large" onClick={runReport} disabled={loading} startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}>
                {loading ? 'Running report' : 'Run report'}
              </Button>

              <Divider />

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {REPORT_CATALOG.map((report) => (
                  <Chip
                    key={report.key}
                    label={report.title}
                    size="small"
                    variant="outlined"
                    onClick={() => setPrompt(`Show ${report.title.toLowerCase()} of ${companyName || 'ABC'} company`)}
                  />
                ))}
              </Stack>
            </Stack>
          </MainCard>
        </Grid>

        <Grid item xs={12} lg={8}>
          <MainCard title="Result" subheader="The matching report appears here after the prompt is resolved.">
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}

              {!result && !error && (
                <Alert severity="info">Run a prompt to see the report. The backend will resolve the report type and company automatically.</Alert>
              )}

              {result && (
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={result.report?.title || 'Report'} color="primary" />
                    {result.company && <Chip label={result.company.name} color="secondary" />}
                    {result.period?.from && <Chip label={`From ${result.period.from}`} variant="outlined" />}
                    {result.period?.to && <Chip label={`To ${result.period.to}`} variant="outlined" />}
                    {result.summary?.totalRecords !== undefined && <Chip label={`${result.summary.totalRecords} records`} variant="outlined" />}
                  </Stack>

                  {result.kind === 'voucher-list' && <VoucherListSection rows={result.rows} />}

                  {result.kind === 'table' && renderTableRows(result.rows || [])}

                  {result.kind === 'summary' && (
                    <Grid container spacing={2}>
                      {Object.entries(result.summary || {}).map(([key, value]) => (
                        <Grid key={key} item xs={12} sm={6}>
                          <MainCard title={key}>
                            <Typography variant="body2">{formatValue(value)}</Typography>
                          </MainCard>
                        </Grid>
                      ))}
                    </Grid>
                  )}

                  {result.kind === 'statement' && (
                    <Stack spacing={2}>
                      {Object.entries(result.sections || {}).map(([key, value]) => (
                        <StatementSection key={key} title={key} value={value} />
                      ))}
                    </Stack>
                  )}

                  {!['voucher-list', 'table', 'summary', 'statement'].includes(result.kind) && (
                    <MainCard title="Raw response">
                      <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>
                        {JSON.stringify(result.raw || result, null, 2)}
                      </Box>
                    </MainCard>
                  )}
                </Stack>
              )}
            </Stack>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
