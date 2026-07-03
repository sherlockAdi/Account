import json
import os
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse, urlunparse

import psycopg2
import psycopg2.extras
import requests
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT.parent / 'backend'
BACKEND_ENV = BACKEND_DIR / '.env'
LOCAL_ENV = ROOT / '.env'


def load_env_file(path: Path) -> dict[str, str]:
  values: dict[str, str] = {}
  if not path.exists():
    return values
  for raw_line in path.read_text(encoding='utf-8').splitlines():
    line = raw_line.strip()
    if not line or line.startswith('#') or '=' not in line:
      continue
    key, value = line.split('=', 1)
    value = value.strip().strip('"').strip("'")
    values[key.strip()] = value
  return values


for source in (BACKEND_ENV, LOCAL_ENV):
  for key, value in load_env_file(source).items():
    os.environ.setdefault(key, value)


DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '').strip()
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini').strip()
BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:8001/api/v1').strip().rstrip('/')
PORT = int(os.getenv('NLP_PORT', '8003'))


REPORTS = [
  {
    'key': 'voucher-detail',
    'title': 'Voucher Detail',
    'kind': 'voucher-list',
    'endpoint': 'accounting/vouchers',
    'matches': ['voucher detail', 'voucher details', 'voucher list', 'day book', 'voucher report', 'voucher'],
  },
  {
    'key': 'trial-balance',
    'title': 'Trial Balance',
    'kind': 'table',
    'endpoint': 'accounting/reports/trial-balance',
    'matches': ['trial balance'],
  },
  {
    'key': 'profit-loss',
    'title': 'Profit & Loss',
    'kind': 'statement',
    'endpoint': 'reports/profit-loss',
    'matches': ['profit loss', 'profit and loss', 'p&l', 'pl statement', 'profit'],
  },
  {
    'key': 'balance-sheet',
    'title': 'Balance Sheet',
    'kind': 'statement',
    'endpoint': 'reports/balance-sheet',
    'matches': ['balance sheet', 'balancesheet'],
  },
  {
    'key': 'stock-summary',
    'title': 'Stock Summary',
    'kind': 'table',
    'endpoint': 'inventory/reports/stock-summary',
    'matches': ['stock summary', 'stock report', 'inventory report', 'inventory'],
  },
  {
    'key': 'customer-outstanding',
    'title': 'Customer Outstanding',
    'kind': 'table',
    'endpoint': 'sales/reports/customer-outstanding',
    'matches': ['customer outstanding', 'receivables', 'customer balance'],
  },
  {
    'key': 'vendor-outstanding',
    'title': 'Vendor Outstanding',
    'kind': 'table',
    'endpoint': 'purchase/reports/vendor-outstanding',
    'matches': ['vendor outstanding', 'supplier outstanding', 'payables', 'vendor balance'],
  },
  {
    'key': 'gstr-1',
    'title': 'GSTR-1',
    'kind': 'table',
    'endpoint': 'gst/reports/gstr-1',
    'matches': ['gstr 1', 'gstr-1', 'gst return 1'],
  },
  {
    'key': 'gstr-3b',
    'title': 'GSTR-3B',
    'kind': 'table',
    'endpoint': 'gst/reports/gstr-3b',
    'matches': ['gstr 3b', 'gstr-3b', 'gst return 3b'],
  },
  {
    'key': 'itc',
    'title': 'ITC Summary',
    'kind': 'table',
    'endpoint': 'gst/reports/itc',
    'matches': ['itc', 'input tax credit'],
  },
  {
    'key': 'hsn-summary',
    'title': 'HSN Summary',
    'kind': 'table',
    'endpoint': 'gst/reports/hsn-summary',
    'matches': ['hsn summary', 'hsn report', 'hsn'],
  },
]


def normalize(text: str = '') -> str:
  return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9\s&-]+', ' ', str(text).lower())).strip()


def json_ok(handler: BaseHTTPRequestHandler, payload: dict, status: int = 200):
  body = json.dumps(payload, default=str).encode('utf-8')
  handler.send_response(status)
  handler.send_header('Content-Type', 'application/json; charset=utf-8')
  handler.send_header('Content-Length', str(len(body)))
  handler.send_header('Access-Control-Allow-Origin', '*')
  handler.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  handler.end_headers()
  handler.wfile.write(body)


def load_json_body(handler: BaseHTTPRequestHandler) -> dict:
  length = int(handler.headers.get('Content-Length', '0') or 0)
  if not length:
    return {}
  raw = handler.rfile.read(length)
  if not raw:
    return {}
  try:
    return json.loads(raw.decode('utf-8'))
  except json.JSONDecodeError:
    return {}


def money(value) -> float:
  try:
    return round(float(value or 0), 2)
  except (TypeError, ValueError):
    return 0.0


def dt_from_iso(value: str | None):
  if not value:
    return None
  try:
    return datetime.fromisoformat(value.replace('Z', '+00:00'))
  except ValueError:
    return None


def parse_date_filter(value: str | None, end_of_day: bool = False):
  dt = dt_from_iso(value)
  if not dt:
    return None
  if end_of_day:
    return dt.replace(hour=23, minute=59, second=59, microsecond=999000)
  return dt


def extract_company_name(prompt: str = '') -> str:
  text = str(prompt).strip()
  patterns = [
    r'(?:of|for|from|about)\s+(.+?)\s+company\b',
    r'(?:of|for|from|about)\s+(.+?)\s+(?:detail|details|report|summary)\b',
    r'(.+?)\s+company\b',
  ]
  for pattern in patterns:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if match:
      company = normalize(match.group(1))
      company = re.sub(r'\b(detail|details|report|reports|show|all|the|voucher|day|book)\b', ' ', company)
      company = re.sub(r'\b(limited|ltd|co|company)\b', ' ', company)
      company = normalize(company)
      if company:
        return company
  return ''


def pick_report(prompt: str = '') -> dict:
  normalized = normalize(prompt)
  for report in REPORTS:
    if any(match in normalized for match in report['matches']):
      return report
  return REPORTS[0]


def local_parse(prompt: str = '', company_name: str = '') -> dict:
  report = pick_report(prompt)
  return {
    'report_key': report['key'],
    'report_title': report['title'],
    'report_endpoint': report['endpoint'],
    'report_kind': report['kind'],
    'company_name': company_name or extract_company_name(prompt),
    'confidence': 0.6,
    'matched_keywords': [match for match in report['matches'] if match in normalize(prompt)],
  }


def openai_parse(prompt: str = '', company_name: str = '') -> dict | None:
  if not OPENAI_API_KEY:
    return None

  system_prompt = (
    'You are a compact report router for an accounting app. '
    'Return only JSON with keys: report_key, report_title, report_endpoint, report_kind, company_name, confidence, matched_keywords. '
    'Pick the best match from these report keys: '
    + ', '.join(report['key'] for report in REPORTS)
    + '. If the prompt mentions a company, extract it exactly. '
    'Set confidence between 0 and 1.'
  )
  payload = {
    'model': OPENAI_MODEL,
    'response_format': {'type': 'json_object'},
    'messages': [
      {'role': 'system', 'content': system_prompt},
      {'role': 'user', 'content': json.dumps({'prompt': prompt, 'company_name': company_name}, ensure_ascii=True)},
    ],
    'temperature': 0,
  }

  try:
    response = requests.post(
      'https://api.openai.com/v1/chat/completions',
      headers={
        'Authorization': f'Bearer {OPENAI_API_KEY}',
        'Content-Type': 'application/json',
      },
      json=payload,
      timeout=20,
    )
    response.raise_for_status()
    content = response.json()['choices'][0]['message']['content']
    data = json.loads(content)
    if 'company_name' not in data or not data['company_name']:
      data['company_name'] = company_name or extract_company_name(prompt)
    if 'confidence' not in data:
      data['confidence'] = 0.85
    return data
  except Exception:
    return None


def parse_prompt(prompt: str = '', company_name: str = '') -> dict:
  parsed = openai_parse(prompt, company_name) or local_parse(prompt, company_name)
  parsed['company_name'] = parsed.get('company_name') or company_name or extract_company_name(prompt)
  report = next((item for item in REPORTS if item['key'] == parsed.get('report_key')), pick_report(prompt))
  parsed['report_key'] = report['key']
  parsed['report_title'] = report['title']
  parsed['report_endpoint'] = report['endpoint']
  parsed['report_kind'] = report['kind']
  parsed['matched_keywords'] = parsed.get('matched_keywords') or [match for match in report['matches'] if match in normalize(prompt)]
  parsed['confidence'] = float(parsed.get('confidence') or 0.5)
  return parsed


def get_connection():
  if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL is missing. Add it to backend/.env or python-nlp-api/.env')
  parsed = urlparse(DATABASE_URL)
  schema = parse_qs(parsed.query).get('schema', [None])[0]
  clean_dsn = urlunparse(parsed._replace(query=''))
  conn = psycopg2.connect(clean_dsn, cursor_factory=psycopg2.extras.RealDictCursor)
  if schema:
    with conn.cursor() as cursor:
      cursor.execute(f'SET search_path TO "{schema}", public')
  return conn


def fetch_all(query: str, params: tuple = ()):
  with get_connection() as conn:
    with conn.cursor() as cursor:
      cursor.execute(query, params)
      return list(cursor.fetchall())


def fetch_one(query: str, params: tuple = ()):
  rows = fetch_all(query, params)
  return rows[0] if rows else None


def list_companies():
  return fetch_all(
    '''
      SELECT
        c."id",
        c."name",
        c."code",
        c."gstin",
        c."legalName"
      FROM companies c
      WHERE c."deletedAt" IS NULL
      ORDER BY c."name" ASC
    '''
  )


def search_suggestions(term: str = '', limit: int = 8):
  query = normalize(term)
  if len(query) < 2:
    return []

  like = f'%{query}%'
  sources = [
    (
      'company',
      fetch_all(
        '''
          SELECT
            c."id",
            c."name",
            c."code",
            c."legalName"
          FROM companies c
          WHERE c."deletedAt" IS NULL
            AND (
              LOWER(c."name") LIKE %s
              OR LOWER(COALESCE(c."legalName", '')) LIKE %s
              OR LOWER(c."code") LIKE %s
            )
          ORDER BY c."name" ASC
          LIMIT %s
        ''',
        (like, like, like, limit),
      ),
    ),
    (
      'customer',
      fetch_all(
        '''
          SELECT
            cu."id",
            cu."name",
            cu."code",
            cu."companyId",
            c."name" AS "companyName"
          FROM customers cu
          JOIN companies c ON c."id" = cu."companyId"
          WHERE cu."deletedAt" IS NULL
            AND (
              LOWER(cu."name") LIKE %s
              OR LOWER(cu."code") LIKE %s
            )
          ORDER BY cu."name" ASC
          LIMIT %s
        ''',
        (like, like, limit),
      ),
    ),
    (
      'vendor',
      fetch_all(
        '''
          SELECT
            v."id",
            v."name",
            v."code",
            v."companyId",
            c."name" AS "companyName"
          FROM vendors v
          JOIN companies c ON c."id" = v."companyId"
          WHERE v."deletedAt" IS NULL
            AND (
              LOWER(v."name") LIKE %s
              OR LOWER(v."code") LIKE %s
            )
          ORDER BY v."name" ASC
          LIMIT %s
        ''',
        (like, like, limit),
      ),
    ),
    (
      'ledger',
      fetch_all(
        '''
          SELECT
            l."id",
            l."name",
            l."code",
            l."ledgerType",
            l."companyId",
            c."name" AS "companyName"
          FROM ledgers l
          JOIN companies c ON c."id" = l."companyId"
          WHERE l."deletedAt" IS NULL
            AND (
              LOWER(l."name") LIKE %s
              OR LOWER(l."code") LIKE %s
            )
          ORDER BY l."name" ASC
          LIMIT %s
        ''',
        (like, like, limit),
      ),
    ),
    (
      'item',
      fetch_all(
        '''
          SELECT
            i."id",
            i."name",
            i."code",
            i."companyId",
            c."name" AS "companyName"
          FROM items i
          JOIN companies c ON c."id" = i."companyId"
          WHERE i."deletedAt" IS NULL
            AND (
              LOWER(i."name") LIKE %s
              OR LOWER(i."code") LIKE %s
            )
          ORDER BY i."name" ASC
          LIMIT %s
        ''',
        (like, like, limit),
      ),
    ),
  ]

  items = []
  for kind, rows in sources:
    for row in rows:
      label = row['name']
      if kind != 'company' and row.get('companyName'):
        label = f"{label} ({row['companyName']})"
      items.append(
        {
          'kind': kind,
          'id': row['id'],
          'label': row['name'],
          'name': row['name'],
          'code': row.get('code'),
          'companyName': row.get('companyName'),
          'displayLabel': label,
          'score': 2 if normalize(row['name']).startswith(query) else 1,
        }
      )

  deduped = []
  seen = set()
  for item in sorted(items, key=lambda entry: (-entry['score'], entry['label'].lower())):
    key = (item['kind'], item['id'])
    if key in seen:
      continue
    seen.add(key)
    deduped.append(item)
    if len(deduped) >= limit:
      break
  return deduped


def resolve_company(prompt: str = '', company_name: str = ''):
  hint = normalize(company_name or extract_company_name(prompt))
  companies = list_companies()
  if not companies:
    raise RuntimeError('No companies found in the database.')
  if hint:
    exact = next(
      (
        company
        for company in companies
        if normalize(company['name']) == hint
        or normalize(company.get('legalName') or '') == hint
        or normalize(company['code']) == hint
        or normalize(company.get('gstin') or '') == hint
      ),
      None,
    )
    if exact:
      return exact
    partial = next(
      (
        company
        for company in companies
        if hint in normalize(company['name'])
        or hint in normalize(company.get('legalName') or '')
        or hint in normalize(company['code'])
        or hint in normalize(company.get('gstin') or '')
      ),
      None,
    )
    if partial:
      return partial
    if len(companies) == 1:
      return companies[0]
    raise RuntimeError(f'Could not find a company matching "{company_name or extract_company_name(prompt)}".')
  if len(companies) == 1:
    return companies[0]
  raise RuntimeError('Please include a company name in the prompt.')


def date_clause(column: str, from_value: str | None, to_value: str | None, params: list):
  clauses = []
  if from_value:
    clauses.append(f'{column} >= %s')
    params.append(parse_date_filter(from_value))
  if to_value:
    clauses.append(f'{column} <= %s')
    params.append(parse_date_filter(to_value, end_of_day=True))
  return (' AND ' + ' AND '.join(clauses)) if clauses else ''


def voucher_detail(company_id: str, from_value: str | None, to_value: str | None):
  params: list = [company_id]
  where = ['v."companyId" = %s', 'v."deletedAt" IS NULL', 'v."status" = \'POSTED\'']
  if from_value:
    where.append('v."voucherDate" >= %s')
    params.append(parse_date_filter(from_value))
  if to_value:
    where.append('v."voucherDate" <= %s')
    params.append(parse_date_filter(to_value, end_of_day=True))
  rows = fetch_all(
    f'''
      SELECT
        v."id" AS "voucherId",
        v."voucherType",
        v."voucherNo",
        v."voucherDate",
        v."narration" AS "voucherNarration",
        v."status",
        vl."id" AS "lineId",
        vl."ledgerId",
        l."name" AS "ledgerName",
        l."code" AS "ledgerCode",
        vl."type",
        vl."amount",
        vl."narration" AS "lineNarration"
      FROM vouchers v
      JOIN voucher_lines vl ON vl."voucherId" = v."id"
      JOIN ledgers l ON l."id" = vl."ledgerId"
      WHERE {' AND '.join(where)}
      ORDER BY v."voucherDate" DESC, v."voucherNo" DESC, vl."createdAt" ASC
    ''',
    tuple(params),
  )
  grouped: dict[str, dict] = {}
  for row in rows:
    voucher = grouped.setdefault(
      row['voucherId'],
      {
        'id': row['voucherId'],
        'voucherType': row['voucherType'],
        'voucherNo': row['voucherNo'],
        'voucherDate': row['voucherDate'],
        'narration': row['voucherNarration'],
        'status': row['status'],
        'lines': [],
        'totalDebit': 0.0,
        'totalCredit': 0.0,
      },
    )
    amount = money(row['amount'])
    line = {
      'id': row['lineId'],
      'ledgerId': row['ledgerId'],
      'ledgerName': row['ledgerName'],
      'ledgerCode': row['ledgerCode'],
      'type': row['type'],
      'amount': amount,
      'narration': row['lineNarration'],
    }
    voucher['lines'].append(line)
    if row['type'] == 'DEBIT':
      voucher['totalDebit'] = money(voucher['totalDebit'] + amount)
    else:
      voucher['totalCredit'] = money(voucher['totalCredit'] + amount)
  return list(grouped.values())


def ledger_movements(company_id: str, from_value: str | None = None, to_value: str | None = None):
  params = [company_id]
  filters = ['v."companyId" = %s', 'v."deletedAt" IS NULL', 'v."status" = \'POSTED\'']
  if from_value:
    filters.append('v."voucherDate" >= %s')
    params.append(parse_date_filter(from_value))
  if to_value:
    filters.append('v."voucherDate" <= %s')
    params.append(parse_date_filter(to_value, end_of_day=True))
  return fetch_all(
    f'''
      WITH movements AS (
        SELECT
          vl."ledgerId" AS "ledgerId",
          SUM(CASE WHEN vl."type" = 'DEBIT' THEN vl."amount" ELSE -vl."amount" END) AS "movement"
        FROM voucher_lines vl
        JOIN vouchers v ON v."id" = vl."voucherId"
        WHERE {' AND '.join(filters)}
        GROUP BY vl."ledgerId"
      )
      SELECT
        l."id",
        l."name",
        l."code",
        l."ledgerType",
        l."openingBalance",
        l."openingType",
        g."name" AS "groupName",
        g."nature",
        COALESCE(m."movement", 0) AS "movement"
      FROM ledgers l
      JOIN account_groups g ON g."id" = l."groupId"
      LEFT JOIN movements m ON m."ledgerId" = l."id"
      WHERE l."companyId" = %s AND l."deletedAt" IS NULL
      ORDER BY g."nature" ASC, l."name" ASC
    ''',
    tuple(params + [company_id]),
  )


def trial_balance(company_id: str, from_value: str | None, to_value: str | None):
  rows = ledger_movements(company_id, from_value, to_value)
  output = []
  for row in rows:
    opening = money(row['openingBalance']) * (1 if row['openingType'] == 'DEBIT' else -1)
    balance = money(opening + money(row['movement']))
    debit = balance if balance > 0 else 0.0
    credit = abs(balance) if balance < 0 else 0.0
    output.append(
      {
        'ledgerId': row['id'],
        'ledgerName': row['name'],
        'groupName': row['groupName'],
        'nature': row['nature'],
        'debit': money(debit),
        'credit': money(credit),
      }
    )
  return output


def profit_loss(company_id: str, from_value: str | None, to_value: str | None):
  rows = ledger_movements(company_id, from_value, to_value)
  income = []
  expenses = []
  total_income = 0.0
  total_expenses = 0.0
  for row in rows:
    opening = money(row['openingBalance']) * (1 if row['openingType'] == 'DEBIT' else -1)
    balance = money(opening + money(row['movement']))
    if row['nature'] == 'INCOME':
      amount = abs(balance)
      total_income = money(total_income + amount)
      income.append(
        {
          'ledgerId': row['id'],
          'ledgerName': row['name'],
          'groupName': row['groupName'],
          'nature': row['nature'],
          'amount': amount,
        }
      )
    elif row['nature'] == 'EXPENSE':
      amount = abs(balance)
      total_expenses = money(total_expenses + amount)
      expenses.append(
        {
          'ledgerId': row['id'],
          'ledgerName': row['name'],
          'groupName': row['groupName'],
          'nature': row['nature'],
          'amount': amount,
        }
      )
  return {
    'period': {'from': from_value, 'to': to_value},
    'income': income,
    'expenses': expenses,
    'totalIncome': money(total_income),
    'totalExpenses': money(total_expenses),
    'netProfit': money(total_income - total_expenses),
  }


def balance_sheet(company_id: str, to_value: str | None):
  rows = ledger_movements(company_id, None, to_value)
  pl = profit_loss(company_id, None, to_value)
  assets = []
  liabilities = []
  equity = []
  total_assets = 0.0
  total_liabilities = 0.0
  total_equity = 0.0
  for row in rows:
    opening = money(row['openingBalance']) * (1 if row['openingType'] == 'DEBIT' else -1)
    balance = money(opening + money(row['movement']))
    amount = abs(balance)
    entry = {
      'ledgerId': row['id'],
      'ledgerName': row['name'],
      'groupName': row['groupName'],
      'nature': row['nature'],
      'amount': amount,
    }
    if row['nature'] == 'ASSET' and amount:
      assets.append(entry)
      total_assets = money(total_assets + amount)
    elif row['nature'] == 'LIABILITY' and amount:
      liabilities.append(entry)
      total_liabilities = money(total_liabilities + amount)
    elif row['nature'] == 'EQUITY' and amount:
      equity.append(entry)
      total_equity = money(total_equity + amount)
  total_liabilities_and_equity = money(total_liabilities + total_equity + abs(pl['netProfit']))
  return {
    'asOf': to_value,
    'assets': assets,
    'liabilities': liabilities,
    'equity': equity,
    'currentPeriodProfit': pl['netProfit'],
    'totalAssets': money(total_assets),
    'totalLiabilities': money(total_liabilities),
    'totalEquity': money(total_equity),
    'totalLiabilitiesAndEquity': total_liabilities_and_equity,
    'difference': money(total_assets - total_liabilities_and_equity),
  }


def stock_summary(company_id: str):
  rows = fetch_all(
    '''
      SELECT
        i."id",
        i."name",
        i."code",
        i."reorderLevel",
        u."name" AS "unitName",
        g."name" AS "groupName",
        COALESCE(SUM(CASE
          WHEN sm."type" IN ('OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'PRODUCTION_IN') THEN sm."quantity"
          WHEN sm."type" IN ('PURCHASE_RETURN', 'SALE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'CONSUMPTION') THEN -sm."quantity"
          ELSE 0
        END), 0) AS "quantity",
        COALESCE(SUM(CASE
          WHEN sm."type" IN ('OPENING', 'PURCHASE', 'SALES_RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'PRODUCTION_IN') THEN sm."amount"
          WHEN sm."type" IN ('PURCHASE_RETURN', 'SALE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'CONSUMPTION') THEN -sm."amount"
          ELSE 0
        END), 0) AS "value"
      FROM items i
      JOIN units u ON u."id" = i."unitId"
      LEFT JOIN item_groups g ON g."id" = i."groupId"
      LEFT JOIN stock_movements sm ON sm."itemId" = i."id"
      WHERE i."companyId" = %s AND i."deletedAt" IS NULL
      GROUP BY i."id", u."name", g."name"
      ORDER BY i."name" ASC
    ''',
    (company_id,),
  )
  return [
    {
      'itemId': row['id'],
      'itemName': row['name'],
      'itemCode': row['code'],
      'groupName': row['groupName'],
      'unit': row['unitName'],
      'quantity': money(row['quantity']),
      'value': money(row['value']),
      'belowReorder': money(row['quantity']) < money(row['reorderLevel']),
    }
    for row in rows
  ]


def outstanding(company_id: str, party_kind: str):
  ledger_type = 'CUSTOMER' if party_kind == 'customer' else 'VENDOR'
  rows = fetch_all(
    '''
      SELECT
        l."id",
        l."name",
        l."openingBalance",
        l."openingType",
        COALESCE(SUM(CASE WHEN vl."type" = 'DEBIT' THEN vl."amount" ELSE -vl."amount" END), 0) AS "movement"
      FROM ledgers l
      LEFT JOIN voucher_lines vl ON vl."ledgerId" = l."id"
      LEFT JOIN vouchers v ON v."id" = vl."voucherId" AND v."deletedAt" IS NULL AND v."status" = 'POSTED'
      WHERE l."companyId" = %s AND l."deletedAt" IS NULL AND l."ledgerType" = %s
      GROUP BY l."id"
      ORDER BY l."name" ASC
    ''',
    (company_id, ledger_type),
  )
  output = []
  for row in rows:
    opening = money(row['openingBalance']) * (1 if row['openingType'] == 'DEBIT' else -1)
    balance = money(opening + money(row['movement']))
    amount = balance if party_kind == 'customer' else abs(balance) if balance < 0 else 0.0
    if party_kind == 'customer' and amount <= 0:
      continue
    if party_kind == 'vendor' and amount <= 0:
      continue
    output.append(
      {
        ('customerId' if party_kind == 'customer' else 'vendorId'): row['id'],
        ('customerName' if party_kind == 'customer' else 'vendorName'): row['name'],
        ('totalReceivable' if party_kind == 'customer' else 'totalPayable'): money(amount),
      }
    )
  return output


def proxy_backend(report: dict, company_id: str, from_value: str | None, to_value: str | None):
  url = f"{BACKEND_API_URL}/{report['endpoint']}"
  params = {'companyId': company_id}
  if from_value:
    params['from'] = from_value
  if to_value:
    params['to'] = to_value
  response = requests.get(url, params=params, timeout=30)
  response.raise_for_status()
  return response.json()


def run_report(prompt: str, company_name: str = '', from_value: str | None = None, to_value: str | None = None):
  parsed = parse_prompt(prompt, company_name)
  company = resolve_company(prompt, parsed['company_name'] or company_name)
  report = next((item for item in REPORTS if item['key'] == parsed['report_key']), pick_report(prompt))
  if report['key'] == 'voucher-detail':
    payload = {
      'kind': 'voucher-list',
      'rows': voucher_detail(company['id'], from_value, to_value),
    }
    source = 'python-db'
  elif report['key'] == 'trial-balance':
    payload = {
      'kind': 'table',
      'rows': trial_balance(company['id'], from_value, to_value),
    }
    source = 'python-db'
  elif report['key'] == 'profit-loss':
    payload = {
      'kind': 'statement',
      'sections': profit_loss(company['id'], from_value, to_value),
    }
    source = 'python-db'
  elif report['key'] == 'balance-sheet':
    payload = {
      'kind': 'statement',
      'sections': balance_sheet(company['id'], to_value),
    }
    source = 'python-db'
  elif report['key'] == 'stock-summary':
    payload = {
      'kind': 'table',
      'rows': stock_summary(company['id']),
    }
    source = 'python-db'
  elif report['key'] == 'customer-outstanding':
    payload = {
      'kind': 'table',
      'rows': outstanding(company['id'], 'customer'),
    }
    source = 'python-db'
  elif report['key'] == 'vendor-outstanding':
    payload = {
      'kind': 'table',
      'rows': outstanding(company['id'], 'vendor'),
    }
    source = 'python-db'
  else:
    backend_data = proxy_backend(report, company['id'], from_value, to_value)
    payload = {
      'kind': 'json',
      'data': backend_data,
    }
    source = 'backend-api'

  return {
    'ok': True,
    'source': source,
    'parse': parsed,
    'report': {
      'key': report['key'],
      'title': report['title'],
      'kind': report['kind'],
      'endpoint': report['endpoint'],
    },
    'company': {
      'id': company['id'],
      'name': company['name'],
      'code': company['code'],
      'gstin': company.get('gstin'),
    },
    'period': {'from': from_value, 'to': to_value},
    **payload,
  }


class Handler(BaseHTTPRequestHandler):
  def log_message(self, format, *args):
    return

  def do_OPTIONS(self):
    json_ok(self, {'ok': True})

  def do_GET(self):
    path = urlparse(self.path).path.rstrip('/')
    query = parse_qs(urlparse(self.path).query)
    if path == '/health':
      json_ok(
        self,
        {
          'ok': True,
          'service': 'python-nlp-api',
          'database': bool(DATABASE_URL),
          'ai': bool(OPENAI_API_KEY),
          'model': OPENAI_MODEL if OPENAI_API_KEY else None,
        },
      )
      return
    if path == '/companies':
      companies = list_companies()
      json_ok(self, {'ok': True, 'companies': companies, 'count': len(companies)})
      return
    if path == '/suggestions':
      term = (query.get('q', ['']) or [''])[0]
      suggestions = search_suggestions(term)
      json_ok(self, {'ok': True, 'term': term, 'suggestions': suggestions, 'count': len(suggestions)})
      return
    json_ok(self, {'ok': False, 'message': 'Not found'}, status=404)

  def do_POST(self):
    path = urlparse(self.path).path.rstrip('/')
    body = load_json_body(self)
    if path == '/parse':
      parsed = parse_prompt(body.get('prompt', ''), body.get('companyName', ''))
      json_ok(self, {'ok': True, 'parse': parsed})
      return
    if path == '/report':
      try:
        payload = run_report(
          prompt=body.get('prompt', ''),
          company_name=body.get('companyName', ''),
          from_value=body.get('from') or None,
          to_value=body.get('to') or None,
        )
        json_ok(self, payload)
      except Exception as exc:
        json_ok(self, {'ok': False, 'message': str(exc)}, status=400)
      return
    json_ok(self, {'ok': False, 'message': 'Not found'}, status=404)


def main():
  server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
  print(f'python-nlp-api listening on http://localhost:{PORT}')
  if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    print(f'Database host: {parsed.hostname}:{parsed.port or 5432}')
  if OPENAI_API_KEY:
    print(f'AI parser enabled with model: {OPENAI_MODEL}')
  server.serve_forever()


if __name__ == '__main__':
  main()
