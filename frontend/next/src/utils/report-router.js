const REPORT_CATALOG = [
  {
    key: 'voucher-detail',
    title: 'Voucher Detail',
    keywords: ['voucher detail', 'voucher details', 'voucher list', 'day book', 'voucher report'],
    endpoint: 'accounting/vouchers',
    kind: 'voucher-list'
  },
  {
    key: 'trial-balance',
    title: 'Trial Balance',
    keywords: ['trial balance'],
    endpoint: 'accounting/reports/trial-balance',
    kind: 'table'
  },
  {
    key: 'profit-loss',
    title: 'Profit & Loss',
    keywords: ['profit loss', 'profit and loss', 'p&l', 'pl statement'],
    endpoint: 'reports/profit-loss',
    kind: 'statement'
  },
  {
    key: 'balance-sheet',
    title: 'Balance Sheet',
    keywords: ['balance sheet'],
    endpoint: 'reports/balance-sheet',
    kind: 'statement'
  },
  {
    key: 'stock-summary',
    title: 'Stock Summary',
    keywords: ['stock summary', 'stock report', 'inventory report'],
    endpoint: 'inventory/reports/stock-summary',
    kind: 'table'
  },
  {
    key: 'customer-outstanding',
    title: 'Customer Outstanding',
    keywords: ['customer outstanding', 'receivables'],
    endpoint: 'sales/reports/customer-outstanding',
    kind: 'table'
  },
  {
    key: 'vendor-outstanding',
    title: 'Vendor Outstanding',
    keywords: ['vendor outstanding', 'payables', 'supplier outstanding'],
    endpoint: 'purchase/reports/vendor-outstanding',
    kind: 'table'
  },
  {
    key: 'gstr-1',
    title: 'GSTR-1',
    keywords: ['gstr 1', 'gstr-1', 'gst return 1'],
    endpoint: 'gst/reports/gstr-1',
    kind: 'table'
  },
  {
    key: 'gstr-3b',
    title: 'GSTR-3B',
    keywords: ['gstr 3b', 'gstr-3b', 'gst return 3b'],
    endpoint: 'gst/reports/gstr-3b',
    kind: 'table'
  },
  {
    key: 'itc',
    title: 'ITC Summary',
    keywords: ['itc', 'input tax credit'],
    endpoint: 'gst/reports/itc',
    kind: 'table'
  },
  {
    key: 'hsn-summary',
    title: 'HSN Summary',
    keywords: ['hsn summary', 'hsn report', 'hsn'],
    endpoint: 'gst/reports/hsn-summary',
    kind: 'table'
  },
  {
    key: 'dashboard',
    title: 'Dashboard Overview',
    keywords: ['dashboard', 'overview', 'summary'],
    endpoint: 'reports/dashboard',
    kind: 'summary'
  }
];

const COMPANY_STOP_WORDS = new Set(['detail', 'details', 'report', 'reports', 'show', 'all', 'the', 'voucher', 'day', 'book']);

function normalizeText(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9\s&-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanCompanyName(value = '') {
  return normalizeText(value)
    .split(' ')
    .filter((word) => word && !COMPANY_STOP_WORDS.has(word))
    .join(' ')
    .replace(/\b(limited|ltd|co|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCompanyName(prompt = '') {
  const normalized = prompt.trim();
  const explicitPatterns = [
    /(?:of|for|from|about)\s+(.+?)\s+company\b/i,
    /(?:of|for|from|about)\s+(.+?)\b(?:report|detail|details|summary)\b/i,
    /(.+?)\s+company\b/i
  ];

  for (const pattern of explicitPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const company = cleanCompanyName(match[1]);
      if (company) return company;
    }
  }

  return '';
}

function extractReportIntent(prompt = '') {
  const normalized = normalizeText(prompt);
  const report = REPORT_CATALOG.find((candidate) =>
    candidate.key === 'dashboard'
      ? false
      : candidate.key === 'itc'
        ? normalized.includes('itc') || normalized.includes('input tax credit')
        : candidate.key === 'hsn-summary'
          ? normalized.includes('hsn')
          : candidate.key === 'gstr-1'
            ? normalized.includes('gstr 1') || normalized.includes('gstr-1') || normalized.includes('gst return 1')
            : candidate.key === 'gstr-3b'
              ? normalized.includes('gstr 3b') || normalized.includes('gstr-3b') || normalized.includes('gst return 3b')
              : candidate.key === 'vendor-outstanding'
                ? normalized.includes('vendor outstanding') || normalized.includes('payables') || normalized.includes('supplier outstanding')
                : candidate.key === 'customer-outstanding'
                  ? normalized.includes('customer outstanding') || normalized.includes('receivables')
                  : candidate.key === 'stock-summary'
                    ? normalized.includes('stock summary') || normalized.includes('inventory report') || normalized.includes('stock report')
                    : candidate.key === 'profit-loss'
                      ? normalized.includes('profit loss') || normalized.includes('profit and loss') || normalized.includes('p&l') || normalized.includes('pl statement')
                      : candidate.key === 'balance-sheet'
                        ? normalized.includes('balance sheet')
                        : candidate.key === 'trial-balance'
                          ? normalized.includes('trial balance')
                          : candidate.key === 'voucher-detail'
                            ? normalized.includes('voucher') || normalized.includes('day book') || normalized.includes('voucher detail') || normalized.includes('voucher details') || normalized.includes('voucher report')
                            : normalized.includes(candidate.key)
  );

  return report ?? REPORT_CATALOG[REPORT_CATALOG.length - 1];
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

export { REPORT_CATALOG, cleanCompanyName, extractCompanyName, extractReportIntent, prettyJson };
