import { NextResponse } from 'next/server';
import { extractCompanyName, extractReportIntent, prettyJson } from 'utils/report-router';

export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND = process.env.BACKEND_API_URL || 'http://localhost:3000/api/v1';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${DEFAULT_BACKEND}/${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || text || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function listReportTitles() {
  return [
    'Voucher Detail',
    'Trial Balance',
    'Profit & Loss',
    'Balance Sheet',
    'Stock Summary',
    'Customer Outstanding',
    'Vendor Outstanding',
    'GSTR-1',
    'GSTR-3B',
    'ITC Summary',
    'HSN Summary',
    'Dashboard Overview'
  ];
}

function toQueryString(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  });
  const result = params.toString();
  return result ? `?${result}` : '';
}

function summarizeVoucher(voucher) {
  const debit = (voucher.lines || []).reduce((sum, line) => sum + (line.type === 'DEBIT' ? Number(line.amount) : 0), 0);
  const credit = (voucher.lines || []).reduce((sum, line) => sum + (line.type === 'CREDIT' ? Number(line.amount) : 0), 0);

  return {
    id: voucher.id,
    voucherDate: voucher.voucherDate,
    voucherType: voucher.voucherType,
    voucherNo: voucher.voucherNo,
    narration: voucher.narration || '',
    totalDebit: Number(debit.toFixed(2)),
    totalCredit: Number(credit.toFixed(2)),
    lines: (voucher.lines || []).map((line) => ({
      ledgerName: line.ledger?.name || '',
      type: line.type,
      amount: Number(line.amount),
      narration: line.narration || ''
    }))
  };
}

function buildReportPayload(report, raw) {
  if (report.key === 'voucher-detail') {
    const rows = Array.isArray(raw) ? raw.map(summarizeVoucher) : [];
    return {
      kind: 'voucher-list',
      rows,
      summary: {
        totalRecords: rows.length,
        totalDebit: Number(rows.reduce((sum, row) => sum + row.totalDebit, 0).toFixed(2)),
        totalCredit: Number(rows.reduce((sum, row) => sum + row.totalCredit, 0).toFixed(2))
      }
    };
  }

  if (report.kind === 'statement') {
    return {
      kind: 'statement',
      rows: [],
      sections: raw,
      summary: {
        keys: Object.keys(raw || {})
      }
    };
  }

  if (report.kind === 'summary') {
    return {
      kind: 'summary',
      rows: [],
      summary: raw
    };
  }

  const rows = Array.isArray(raw) ? raw : raw?.rows || [];
  return {
    kind: 'table',
    rows,
    summary: {
      totalRecords: rows.length
    },
    raw
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const prompt = String(body?.prompt || '').trim();
    const report = extractReportIntent(prompt);
    const companyName = String(body?.companyName || extractCompanyName(prompt) || '').trim();
    const companyId = String(body?.companyId || '').trim();
    const from = String(body?.from || '').trim();
    const to = String(body?.to || '').trim();

    const companies = await fetchJson('companies');
    const selectedCompany =
      companies.find((company) => company.id === companyId) ||
      (companyName
        ? companies.find((company) => company.name.toLowerCase() === companyName.toLowerCase()) ||
          companies.find((company) => company.name.toLowerCase().includes(companyName.toLowerCase()))
        : null) ||
      null;

    if (!selectedCompany && report.key !== 'dashboard') {
      return NextResponse.json(
        {
          ok: false,
          message: companyName
            ? `I could not find a company named "${companyName}".`
            : 'Please include a company name, for example "voucher detail of ABC company".',
          suggestions: companies.slice(0, 5).map((company) => company.name),
          reports: listReportTitles()
        },
        { status: 400 }
      );
    }

    const query = toQueryString({
      companyId: selectedCompany?.id,
      from: from || undefined,
      to: to || undefined
    });

    const raw = await fetchJson(`${report.endpoint}${query}`);
    const payload = buildReportPayload(report, raw);

    return NextResponse.json({
      ok: true,
      prompt,
      report: {
        key: report.key,
        title: report.title,
        endpoint: report.endpoint,
        kind: payload.kind
      },
      company: selectedCompany ? { id: selectedCompany.id, name: selectedCompany.name } : null,
      period: {
        from: from || null,
        to: to || null
      },
      ...payload,
      raw: payload.raw ?? raw,
      debug: process.env.NODE_ENV === 'development' ? prettyJson({ report: report.key, company: selectedCompany?.name, query }) : undefined
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to run report'
      },
      { status: 500 }
    );
  }
}
