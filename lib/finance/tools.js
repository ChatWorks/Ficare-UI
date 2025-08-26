// Financial analysis tools operating on AFAS records using the existing v2 financial API and client aggregator
// Deterministic calculations; returns source_refs and query_hash for audit.
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

let toolsBaseUrl = '';
export function setToolsBaseUrl(url) {
  toolsBaseUrl = url || '';
}

// Helper: compute stable hash over function name + params
function computeQueryHash(functionName, params) {
  const payload = JSON.stringify({ functionName, params });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Helper: fetch financial view from existing API (server-to-server call)
async function loadFinancialView(range) {
  // Validate and sanitize range parameters to prevent absurd API calls
  const currentYear = new Date().getFullYear();
  const MIN_YEAR = 2020;
  const MAX_YEAR = currentYear + 1;
  
  let { startYear, startMonth, endYear, endMonth } = range;
  
  // Validate years
  if (!startYear || isNaN(startYear) || startYear < MIN_YEAR || startYear > MAX_YEAR) {
    console.warn(`[TOOLS] Invalid startYear ${startYear}, using ${currentYear}`);
    startYear = currentYear;
  }
  if (!endYear || isNaN(endYear) || endYear < MIN_YEAR || endYear > MAX_YEAR) {
    console.warn(`[TOOLS] Invalid endYear ${endYear}, using ${currentYear}`);
    endYear = currentYear;
  }
  
  // Validate months
  if (!startMonth || isNaN(startMonth) || startMonth < 1 || startMonth > 12) {
    console.warn(`[TOOLS] Invalid startMonth ${startMonth}, using 1`);
    startMonth = 1;
  }
  if (!endMonth || isNaN(endMonth) || endMonth < 1 || endMonth > 12) {
    console.warn(`[TOOLS] Invalid endMonth ${endMonth}, using 12`);
    endMonth = 12;
  }
  
  // Prevent reverse ranges
  if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
    console.warn(`[TOOLS] Invalid date range ${startYear}-${startMonth} to ${endYear}-${endMonth}, swapping`);
    [startYear, endYear] = [endYear, startYear];
    [startMonth, endMonth] = [endMonth, startMonth];
  }
  
  // Limit range to prevent server overload (max 3 years)
  const maxYearRange = 3;
  if (endYear - startYear > maxYearRange) {
    console.warn(`[TOOLS] Year range too large (${endYear - startYear} years), limiting to ${maxYearRange} years`);
    endYear = startYear + maxYearRange;
  }
  
  const base = toolsBaseUrl || process.env.NEXT_PUBLIC_BASE_URL || '';
  const url = `${base}/api/v2/financial?startYear=${startYear}&startMonth=${startMonth}&endYear=${endYear}&endMonth=${endMonth}`;
  
  console.log(`[TOOLS] Making API call: ${url}`);
  
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load financial view: ${res.status}`);
  }
  return res.json();
}

// Helper: quick check for AI-ready data (TEMPORARILY DISABLED)
async function loadAiReadyData() {
  console.log('Cache temporarily disabled - skipping AI-ready data check');
  return null; // Always return null to force standard fetch
}

// Helper: fetch ALL raw records within range using the same server API result
async function loadRecords(range) {
  const view = await loadFinancialView(range);
  return { view, records: view.allRecords || [], monthlyData: view.monthlyData || [], accountTypeTotals: view.accountTypeTotals || {}, categoryTotals: view.categoryTotals || {} };
}

// Helper: smart loading - try AI-ready first, fallback to full load
async function loadRecordsSmart(range) {
  // First try to get immediate AI-ready data
  const aiReadyRecords = await loadAiReadyData();
  if (aiReadyRecords && aiReadyRecords.length > 0) {
    console.log(`Using AI-ready data with ${aiReadyRecords.length} records`);
    
    // Filter records to the requested range if needed
    const filteredRecords = aiReadyRecords.filter(r => {
      if (range.startYear && (r.Jaar < range.startYear || (r.Jaar === range.startYear && r.Periode < range.startMonth))) return false;
      if (range.endYear && (r.Jaar > range.endYear || (r.Jaar === range.endYear && r.Periode > range.endMonth))) return false;
      return true;
    });
    
    // Create minimal view structure for compatibility
    return {
      view: { 
        allRecords: filteredRecords,
        source: 'AI-ready cache',
        isPartial: true
      },
      records: filteredRecords,
      monthlyData: [], // Will be computed from records if needed
      accountTypeTotals: {},
      categoryTotals: {}
    };
  }
  
  // Fallback to normal loading
  console.log('AI-ready data not available, using full financial view');
  return loadRecords(range);
}

// Utility: filter records by predicates
function filterRecords(records, filters) {
  if (!filters) return records;
  return records.filter((r) => {
    if (filters.period_from) {
      const [yf, mf] = filters.period_from.split('-').map((x) => parseInt(x, 10));
      if (r.Jaar < yf || (r.Jaar === yf && r.Periode < mf)) return false;
    }
    if (filters.period_to) {
      const [yt, mt] = filters.period_to.split('-').map((x) => parseInt(x, 10));
      if (r.Jaar > yt || (r.Jaar === yt && r.Periode > mt)) return false;
    }
    if (filters.rekening && String(r.Rekeningnummer) !== String(filters.rekening)) return false;
    if (filters.dagboek && String(r.Code_dagboek || r.Dagboek) !== String(filters.dagboek)) return false;
    if (filters.bedrag_min && ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)) < filters.bedrag_min) return false;
    if (filters.bedrag_max && ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)) > filters.bedrag_max) return false;
    if (filters.tekst) {
      const t = `${r.Omschrijving || ''} ${r.Omschrijving_2 || ''} ${r.Omschrijving_3 || ''}`.toLowerCase();
      if (!t.includes(String(filters.tekst).toLowerCase())) return false;
    }
    if (filters.boekstuknummer && String(r.Boekstuknummer) !== String(filters.boekstuknummer)) return false;
    if (filters.kostenplaats && String(r.Kostenplaats || r.KostenplaatsCode) !== String(filters.kostenplaats)) return false;
    if (filters.project && String(r.Project || r.ProjectCode) !== String(filters.project)) return false;
    return true;
  });
}

function toPeriodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Helper: collect source refs from records
function collectSourceRefs(records) {
  return Array.from(new Set((records || []).map((r) => r.Boekstuknummer).filter(Boolean)));
}

// P&L
export async function get_profit_loss_statement(period_from, period_to, granularity = 'month', filters) {
  const [startYear, startMonth] = period_from.split('-').map((x) => parseInt(x, 10));
  const [endYear, endMonth] = period_to.split('-').map((x) => parseInt(x, 10));
  const { records, monthlyData } = await loadRecordsSmart({ startYear, startMonth, endYear, endMonth });

  const byMonth = new Map();
  for (const m of monthlyData) {
    byMonth.set(toPeriodKey(m.year, m.month), m);
  }

  const rows = [];
  const totals = { Opbrengsten: 0, Kosten: 0, Resultaat: 0 };
  const includedRecords = [];

  for (const m of monthlyData) {
    const key = toPeriodKey(m.year, m.month);
    const opbrengsten = m.accountTypeBreakdown?.Opbrengsten?.netAmount || 0;
    const kosten = Math.abs(m.accountTypeBreakdown?.Kosten?.netAmount || 0);
    const resultaat = opbrengsten - kosten;
    rows.push({ post: 'Opbrengsten', periode: key, bedrag: opbrengsten });
    rows.push({ post: 'Kosten', periode: key, bedrag: kosten });
    rows.push({ post: 'Resultaat', periode: key, bedrag: resultaat });
    totals.Opbrengsten += opbrengsten;
    totals.Kosten += kosten;
    totals.Resultaat += resultaat;
    includedRecords.push(...(m.records || []));
  }

  // Optionally aggregate by quarter or YTD
  if (granularity !== 'month') {
    // naive regroup
    const groupFn = (p) => {
      if (granularity === 'quarter') {
        const [y, m] = p.split('-').map((x) => parseInt(x, 10));
        const q = Math.floor((m - 1) / 3) + 1;
        return `${y}-Q${q}`;
      }
      if (granularity === 'YTD') {
        return p.split('-')[0];
      }
      return p;
    };
    const agg = {};
    for (const r of rows) {
      const g = groupFn(r.periode);
      const k = `${r.post}::${g}`;
      agg[k] = (agg[k] || 0) + r.bedrag;
    }
    const newRows = Object.entries(agg).map(([k, amount]) => {
      const [post, periode] = k.split('::');
      return { post, periode, bedrag: amount };
    });
    rows.length = 0;
    rows.push(...newRows);
  }

  const source_refs = collectSourceRefs(includedRecords);
  const query_hash = computeQueryHash('get_profit_loss_statement', { period_from, period_to, granularity, filters });
  return { rows, totals, source_refs, query_hash };
}

// Balance Sheet with Opening Balance
export async function get_balance_sheet(as_of_period, side = 'both', include_opening_balance = true) {
  const [year, month] = as_of_period.split('-').map((x) => parseInt(x, 10));
  const { monthlyData, allRecords } = await loadRecords({ startYear: year - 50, startMonth: 1, endYear: year, endMonth: month });
  const m = monthlyData.find((x) => x.year === year && x.month === month) || monthlyData[0] || {};
  const assets = [];
  const liabilities = [];
  const equity = [];
  const atb = m.accountTypeBreakdown || {};
  const cat = m.categorieBreakdown || {};

  // Calculate opening balance if requested
  let openingBalance = null;
  if (include_opening_balance) {
    openingBalance = calculateOpeningBalance(allRecords, year, month);
  }

  // Assets and liabilities totals from account types
  const activa = atb.Activa?.netAmount || 0;
  const passiva = Math.abs(atb.Passiva?.netAmount || 0);
  const eigenVermogen = (activa - passiva);

  // Best effort split into buckets using categories
  for (const [k, v] of Object.entries(cat)) {
    const name = String(k);
    const amount = v.netAmount || 0;
    if (/debiteur|voorraad|bank|kas|liquide|materieel|immaterieel|activa|onderhanden|overlopende activa|overige vorderingen/i.test(name)) {
      assets.push({ post: name, amount });
    } else if (/crediteur|lening|schuld|passiva|btw|belast|nog te betalen|overige reserves|overige schulden|overige voorzieningen|pensioenen|loonheffing|vennootschapsbelasting/i.test(name)) {
      liabilities.push({ post: name, amount: Math.abs(amount) });
    } else if (/eigen vermogen/i.test(name)) {
      equity.push({ post: name, amount });
    }
  }

  // Sort arrays alphabetically
  assets.sort((a, b) => a.post.localeCompare(b.post, 'nl', { sensitivity: 'base' }));
  liabilities.sort((a, b) => a.post.localeCompare(b.post, 'nl', { sensitivity: 'base' }));
  equity.sort((a, b) => a.post.localeCompare(b.post, 'nl', { sensitivity: 'base' }));

  const totals = { activa, vreemdVermogen: passiva, eigenVermogen, totaalPassiva: passiva + eigenVermogen };
  const source_refs = collectSourceRefs(m.records || []);
  const query_hash = computeQueryHash('get_balance_sheet', { as_of_period, side, include_opening_balance });
  const result = { assets, liabilities, equity, totals, openingBalance, source_refs, query_hash };
  if (side === 'assets') return { assets, totals, openingBalance, source_refs, query_hash };
  if (side === 'liabilities') return { liabilities, totals, openingBalance, source_refs, query_hash };
  if (side === 'equity') return { equity, totals, openingBalance, source_refs, query_hash };
  return result;
}

// Get Opening Balance (0-balans)
export async function get_opening_balance(period_start) {
  const [year, month] = period_start.split('-').map((x) => parseInt(x, 10));
  console.log(`[AI-TOOL] Getting opening balance for period starting ${period_start}`);
  
  // Load all records up to the period start - FORCE use of loadRecords (not smart loading)
  const { allRecords } = await loadRecords({ startYear: year - 50, startMonth: 1, endYear: year, endMonth: month });
  
  // Calculate opening balance
  const openingBalance = calculateOpeningBalance(allRecords, year, month);
  
  const source_refs = collectSourceRefs(allRecords.filter(row => {
    const rowYear = row.Jaar;
    const rowMonth = row.Periode;
    return rowYear < year || (rowYear === year && rowMonth < month);
  }));
  
  const query_hash = computeQueryHash('get_opening_balance', { period_start });
  
  return {
    ...openingBalance,
    source_refs,
    query_hash
  };
}

// Cash Flow (indirect)
export async function get_cash_flow_statement(period_from, period_to, method = 'indirect') {
  const [startYear, startMonth] = period_from.split('-').map((x) => parseInt(x, 10));
  const [endYear, endMonth] = period_to.split('-').map((x) => parseInt(x, 10));
  const { monthlyData } = await loadRecords({ startYear, startMonth, endYear, endMonth });
  if (monthlyData.length === 0) {
    const query_hash = computeQueryHash('get_cash_flow_statement', { period_from, period_to, method });
    return { operating: {}, investing: {}, financing: {}, total: 0, source_refs: [], query_hash };
  }

  // Sum net result across months
  let resultSum = 0;
  let source = [];
  for (const m of monthlyData) {
    const rev = m.accountTypeBreakdown?.Opbrengsten?.netAmount || 0;
    const costs = Math.abs(m.accountTypeBreakdown?.Kosten?.netAmount || 0);
    resultSum += (rev - costs);
    source = source.concat(m.records || []);
  }

  // Working capital deltas using categories across first/last period
  const first = monthlyData[0];
  const last = monthlyData[monthlyData.length - 1];
  const getCatAmount = (m, name) => m?.categorieBreakdown?.[name]?.netAmount || 0;
  const deltaDeb = (getCatAmount(last, 'Debiteuren') - getCatAmount(first, 'Debiteuren'));
  const deltaVoorraad = (getCatAmount(last, 'Voorraad') - getCatAmount(first, 'Voorraad'));
  const deltaCred = (getCatAmount(last, 'Crediteuren') - getCatAmount(first, 'Crediteuren'));

  const operating = {
    result: resultSum,
    working_capital: {
      delta_debiteuren: deltaDeb,
      delta_voorraad: deltaVoorraad,
      delta_crediteuren: deltaCred
    },
    net: resultSum - deltaDeb - deltaVoorraad + Math.abs(deltaCred)
  };

  // Heuristic investing/financing buckets from categories
  const invCats = ['Vaste activa', 'Investeringen'];
  const finCats = ['Leningen', 'Lease', 'Dividend'];
  const investAmt = (last?.records || []).reduce((s, r) => s + (invCats.some((c) => String(r.Categorie || '').toLowerCase().includes(c.toLowerCase())) ? ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)) : 0), 0);
  const financeAmt = (last?.records || []).reduce((s, r) => s + (finCats.some((c) => String(r.Categorie || '').toLowerCase().includes(c.toLowerCase())) ? ((r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)) : 0), 0);

  const investing = { total: investAmt };
  const financing = { total: financeAmt };
  const total = operating.net + investAmt + financeAmt;
  const source_refs = collectSourceRefs(source);
  const query_hash = computeQueryHash('get_cash_flow_statement', { period_from, period_to, method });
  return { operating, investing, financing, total, source_refs, query_hash };
}

// Drill-down
export async function list_journal_entries(filters = {}, limit = 200, offset = 0) {
  const pf = filters.period_from || '1900-01';
  const pt = filters.period_to || '2999-12';
  const [startYear, startMonth] = pf.split('-').map((x) => parseInt(x, 10));
  const [endYear, endMonth] = pt.split('-').map((x) => parseInt(x, 10));
  const { records } = await loadRecords({ startYear, startMonth, endYear, endMonth });
  const filtered = filterRecords(records, filters);
  const entries = filtered.slice(offset, offset + limit).map((r) => ({
    Boekstuknummer: r.Boekstuknummer,
    Boekstukdatum: r.Boekstukdatum,
    Jaar: r.Jaar,
    Periode: r.Periode,
    Rekeningnummer: r.Rekeningnummer,
    Omschrijving: r.Omschrijving,
    Categorie: r.Categorie || r.Omschrijving_3 || r.Kenmerk_rekening,
    Bedrag_debet: r.Bedrag_debet || 0,
    Bedrag_credit: r.Bedrag_credit || 0,
    Dagboek: r.Code_dagboek || r.Dagboek
  }));
  const source_refs = collectSourceRefs(filtered);
  const query_hash = computeQueryHash('list_journal_entries', { filters, limit, offset });
  return { entries, count: filtered.length, source_refs, query_hash };
}

// Aggregate by dimension
export async function aggregate_by(dimension, period_from, period_to, top_n, filters) {
  const [startYear, startMonth] = period_from.split('-').map((x) => parseInt(x, 10));
  const [endYear, endMonth] = period_to.split('-').map((x) => parseInt(x, 10));
  const { records } = await loadRecords({ startYear, startMonth, endYear, endMonth });
  const filtered = filterRecords(records, { ...filters, period_from, period_to });
  const keyFn = (r) => {
    switch (dimension) {
      case 'rekening': return String(r.Rekeningnummer || '');
      case 'post': return String(r.Categorie || r.Omschrijving_3 || 'Overige');
      case 'kostenplaats': return String(r.Kostenplaats || r.KostenplaatsCode || '');
      case 'project': return String(r.Project || r.ProjectCode || '');
      case 'debiteur': return String(r.Debiteur || r.Relatie || '');
      case 'crediteur': return String(r.Crediteur || r.Relatie || '');
      default: return 'Onbekend';
    }
  };
  const map = new Map();
  for (const r of filtered) {
    const k = keyFn(r);
    const amount = (r.Bedrag_debet || 0) - (r.Bedrag_credit || 0);
    map.set(k, (map.get(k) || 0) + amount);
  }
  let rows = Array.from(map.entries()).map(([key, amount]) => ({ key, amount }));
  rows.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const top_n_applied = !!top_n && rows.length > top_n;
  if (top_n_applied) rows = rows.slice(0, top_n);
  const source_refs = collectSourceRefs(filtered);
  const query_hash = computeQueryHash('aggregate_by', { dimension, period_from, period_to, top_n, filters });
  return { rows, top_n_applied, source_refs, query_hash };
}

// Variance report
export async function variance_report(scope, a_from, a_to, b_from, b_to, basis = 'abs', dimension = 'post') {
  const aAgg = await aggregate_by(dimension, a_from, a_to);
  const bAgg = await aggregate_by(dimension, b_from, b_to);
  const bMap = new Map(bAgg.rows.map((r) => [r.key, r.amount]));
  const rows = aAgg.rows.map((r) => {
    const amount_a = r.amount;
    const amount_b = bMap.get(r.key) || 0;
    const delta_abs = amount_a - amount_b;
    const delta_pct = amount_b !== 0 ? (delta_abs / Math.abs(amount_b)) * 100 : null;
    return { dimension_key: r.key, amount_a, amount_b, delta_abs, delta_pct };
  });
  const source_refs = Array.from(new Set([...(aAgg.source_refs || []), ...(bAgg.source_refs || [])]));
  const query_hash = computeQueryHash('variance_report', { scope, a_from, a_to, b_from, b_to, basis, dimension });
  return { rows, source_refs, query_hash };
}

// Top deviations
export async function top_deviations(scope, period_from, period_to, compare_to = 'prev_period', n = 5, direction = 'both', dimension = 'post') {
  let a_from = period_from;
  let a_to = period_to;
  let b_from = period_from;
  let b_to = period_to;
  const [y, m] = period_to.split('-').map((x) => parseInt(x, 10));
  if (compare_to === 'prev_period') {
    const prev = new Date(y, m - 2, 1);
    const py = prev.getFullYear();
    const pm = prev.getMonth() + 1;
    b_from = `${py}-${String(pm).padStart(2, '0')}`;
    b_to = b_from;
  } else if (compare_to === 'same_period_last_year') {
    b_from = `${y - 1}-${String(m).padStart(2, '0')}`;
    b_to = b_from;
  }
  const vr = await variance_report(scope, a_from, a_to, b_from, b_to, 'abs', dimension);
  let diffs = vr.rows.map((r) => ({ key: r.dimension_key, delta: r.delta_abs }));
  diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const increases = diffs.filter((d) => d.delta > 0).slice(0, n);
  const decreases = diffs.filter((d) => d.delta < 0).slice(0, n);
  const source_refs = vr.source_refs;
  const query_hash = computeQueryHash('top_deviations', { scope, period_from, period_to, compare_to, n, direction, dimension });
  return { increases, decreases, source_refs, query_hash };
}

// Explain change
export async function explain_account_change(account_or_post, a_period, b_period, breakdown = 'rekening') {
  const [ay, am] = a_period.split('-').map((x) => parseInt(x, 10));
  const [by, bm] = b_period.split('-').map((x) => parseInt(x, 10));
  const { records } = await loadRecords({ startYear: Math.min(ay, by), startMonth: 1, endYear: Math.max(ay, by), endMonth: 12 });
  const inA = filterRecords(records, { period_from: a_period, period_to: a_period, tekst: account_or_post });
  const inB = filterRecords(records, { period_from: b_period, period_to: b_period, tekst: account_or_post });
  const sum = (arr) => arr.reduce((s, r) => s + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)), 0);
  const amountA = sum(inA);
  const amountB = sum(inB);
  const delta = amountB - amountA;
  const keyFn = (r) => {
    switch (breakdown) {
      case 'rekening': return String(r.Rekeningnummer || '');
      case 'kostenplaats': return String(r.Kostenplaats || r.KostenplaatsCode || '');
      case 'project': return String(r.Project || r.ProjectCode || '');
      case 'boekstuk': return String(r.Boekstuknummer || '');
      default: return 'overig';
    }
  };
  const mapA = new Map();
  for (const r of inA) mapA.set(keyFn(r), (mapA.get(keyFn(r)) || 0) + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)));
  const mapB = new Map();
  for (const r of inB) mapB.set(keyFn(r), (mapB.get(keyFn(r)) || 0) + ((r.Bedrag_debet || 0) - (r.Bedrag_credit || 0)));
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const drivers = Array.from(allKeys).map((k) => {
    const a = mapA.get(k) || 0;
    const b = mapB.get(k) || 0;
    const d = b - a;
    const share_pct = delta !== 0 ? (d / delta) * 100 : 0;
    return { key: k, delta: d, share_pct };
  }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const source_refs = Array.from(new Set([...collectSourceRefs(inA), ...collectSourceRefs(inB)]));
  const query_hash = computeQueryHash('explain_account_change', { account_or_post, a_period, b_period, breakdown });
  return { delta, drivers, source_refs, query_hash };
}

// Anomaly scan (simple z-score over monthly sums by post or rekening)
export async function anomaly_scan(period_from, period_to, zscore = 3, min_amount = 1000, by = 'post') {
  const agg = await aggregate_by(by === 'post' ? 'post' : 'rekening', period_from, period_to);
  // For a simple version, we cannot compute rolling stats without a longer window; use overall stats
  const amounts = agg.rows.map((r) => Math.abs(r.amount));
  const avg = amounts.reduce((s, a) => s + a, 0) / (amounts.length || 1);
  const stdev = Math.sqrt((amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / (amounts.length || 1)) || 0);
  const anomalies = agg.rows
    .map((r) => ({ key: r.key, amount: r.amount, zscore: stdev ? Math.abs((Math.abs(r.amount) - avg) / stdev) : 0 }))
    .filter((x) => Math.abs(x.amount) >= min_amount && x.zscore >= zscore)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const source_refs = agg.source_refs;
  const query_hash = computeQueryHash('anomaly_scan', { period_from, period_to, zscore, min_amount, by });
  return { anomalies, notes: [], source_refs, query_hash };
}

// Reconcile P&L to Balance (EV delta vs result)
export async function reconcile_pl_to_balance(period_from, period_to) {
  const [startYear, startMonth] = period_from.split('-').map((x) => parseInt(x, 10));
  const [endYear, endMonth] = period_to.split('-').map((x) => parseInt(x, 10));
  const { monthlyData } = await loadRecords({ startYear, startMonth, endYear, endMonth });
  if (monthlyData.length < 2) {
    const query_hash = computeQueryHash('reconcile_pl_to_balance', { period_from, period_to });
    return { ok: false, diffs: [{ type: 'InsufficientData', amount: 0, hint: 'Minimaal 2 maanden nodig' }], source_refs: [], query_hash };
  }
  const first = monthlyData[0];
  const last = monthlyData[monthlyData.length - 1];
  const result = monthlyData.reduce((s, m) => s + ((m.accountTypeBreakdown?.Opbrengsten?.netAmount || 0) - Math.abs(m.accountTypeBreakdown?.Kosten?.netAmount || 0)), 0);
  const evFirst = (first.accountTypeBreakdown?.Activa?.netAmount || 0) - Math.abs(first.accountTypeBreakdown?.Passiva?.netAmount || 0);
  const evLast = (last.accountTypeBreakdown?.Activa?.netAmount || 0) - Math.abs(last.accountTypeBreakdown?.Passiva?.netAmount || 0);
  const deltaEV = evLast - evFirst;
  const diff = deltaEV - result;
  const ok = Math.abs(diff) < 1e-6 || Math.abs(diff) < 100; // tolerance
  const source_refs = collectSourceRefs([...(first.records || []), ...(last.records || [])]);
  const query_hash = computeQueryHash('reconcile_pl_to_balance', { period_from, period_to });
  const diffs = ok ? [] : [{ type: 'EV_vs_Resultaat', amount: diff, hint: 'Controleer begin/eindboekingen en mutaties eigen vermogen' }];
  return { ok, diffs, source_refs, query_hash };
}

// Ratios
export async function ratio_current(as_of_period) {
  const bs = await get_balance_sheet(as_of_period, 'both');
  // Approximate: Vlottende Activa ~ 60% van Activa; Kortlopende schulden ~ 70% van VV (heuristiek)
  const vlottendeActiva = bs.totals.activa * 0.6;
  const kortlopendeSchulden = bs.totals.vreemdVermogen * 0.7;
  const value = kortlopendeSchulden > 0 ? vlottendeActiva / kortlopendeSchulden : 0;
  return { value, numerator: vlottendeActiva, denominator: kortlopendeSchulden, definition: 'Vlottende Activa / Kortlopende Schulden (benadering)', source_refs: bs.source_refs, query_hash: computeQueryHash('ratio_current', { as_of_period }) };
}

export async function ratio_quick(as_of_period) {
  const bs = await get_balance_sheet(as_of_period, 'both');
  const vlottendeActiva = bs.totals.activa * 0.6;
  const voorraad = bs.totals.activa * 0.1;
  const kortlopendeSchulden = bs.totals.vreemdVermogen * 0.7;
  const value = kortlopendeSchulden > 0 ? (vlottendeActiva - voorraad) / kortlopendeSchulden : 0;
  return { value, numerator: vlottendeActiva - voorraad, denominator: kortlopendeSchulden, definition: '(Vlottende Activa − Voorraad) / Kortlopende Schulden (benadering)', source_refs: bs.source_refs, query_hash: computeQueryHash('ratio_quick', { as_of_period }) };
}

export async function ratio_debt_to_equity(as_of_period) {
  const bs = await get_balance_sheet(as_of_period, 'both');
  const debt = bs.totals.vreemdVermogen;
  const equity = bs.totals.eigenVermogen;
  const value = equity !== 0 ? debt / equity : null;
  return { value, numerator: debt, denominator: equity, definition: 'Rentedragende schuld / Eigen Vermogen (benadering VV/EV)', source_refs: bs.source_refs, query_hash: computeQueryHash('ratio_debt_to_equity', { as_of_period }) };
}

export async function ratio_gross_margin(period_from, period_to) {
  const pnl = await get_profit_loss_statement(period_from, period_to, 'YTD');
  const omzet = pnl.totals.Opbrengsten || 0;
  const cogs = pnl.totals.Kosten || 0;
  const value = omzet !== 0 ? (omzet - cogs) / omzet : null;
  return { value, numerator: omzet - cogs, denominator: omzet, definition: '(Omzet − COGS) / Omzet', source_refs: pnl.source_refs, query_hash: computeQueryHash('ratio_gross_margin', { period_from, period_to }) };
}

// Trend
export async function trend(series, kpi, period_from, period_to, window = 12) {
  const points = [];
  // Build per-month series
  const [startYear, startMonth] = period_from.split('-').map((x) => parseInt(x, 10));
  const [endYear, endMonth] = period_to.split('-').map((x) => parseInt(x, 10));
  const { monthlyData } = await loadRecords({ startYear, startMonth, endYear, endMonth });
  for (const m of monthlyData) {
    const periode = toPeriodKey(m.year, m.month);
    let value = null;
    if (kpi === 'current_ratio') {
      const vlottendeActiva = (m.accountTypeBreakdown?.Activa?.netAmount || 0) * 0.6;
      const kortlopendeSchulden = Math.abs(m.accountTypeBreakdown?.Passiva?.netAmount || 0) * 0.7;
      value = kortlopendeSchulden > 0 ? vlottendeActiva / kortlopendeSchulden : 0;
    } else if (kpi === 'quick_ratio') {
      const vlottendeActiva = (m.accountTypeBreakdown?.Activa?.netAmount || 0) * 0.6;
      const voorraad = (m.accountTypeBreakdown?.Activa?.netAmount || 0) * 0.1;
      const kortlopendeSchulden = Math.abs(m.accountTypeBreakdown?.Passiva?.netAmount || 0) * 0.7;
      value = kortlopendeSchulden > 0 ? (vlottendeActiva - voorraad) / kortlopendeSchulden : 0;
    } else if (kpi === 'debt_to_equity') {
      const debt = Math.abs(m.accountTypeBreakdown?.Passiva?.netAmount || 0);
      const equity = (m.accountTypeBreakdown?.Activa?.netAmount || 0) - debt;
      value = equity !== 0 ? debt / equity : null;
    } else if (kpi === 'gross_margin') {
      const rev = m.accountTypeBreakdown?.Opbrengsten?.netAmount || 0;
      const cost = Math.abs(m.accountTypeBreakdown?.Kosten?.netAmount || 0);
      value = rev !== 0 ? (rev - cost) / rev : null;
    } else if (kpi.startsWith('post:')) {
      const post = kpi.slice('post:'.length);
      value = m.categorieBreakdown?.[post]?.netAmount || 0;
    } else if (kpi.startsWith('rekening:')) {
      // Not available in monthly breakdown directly; skip
      value = null;
    }
    points.push({ periode, value });
  }
  // Moving average and std dev
  const seriesVals = points.map((p) => (p.value == null ? 0 : p.value));
  const avg = seriesVals.reduce((s, v) => s + v, 0) / (seriesVals.length || 1);
  const stdev = Math.sqrt((seriesVals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (seriesVals.length || 1)) || 0);
  const source_refs = collectSourceRefs(monthlyData.flatMap((m) => m.records || []));
  const query_hash = computeQueryHash('trend', { series, kpi, period_from, period_to, window });
  return { points, avg, stdev, source_refs, query_hash };
}

// Aging report
export async function aging_report(entity, as_of_period, buckets = ['0-30', '31-60', '61-90', '>90'], detail = false) {
  const [year, month] = as_of_period.split('-').map((x) => parseInt(x, 10));
  const { monthlyData } = await loadRecords({ startYear: year - 1, startMonth: 1, endYear: year, endMonth: month });
  const m = monthlyData.find((x) => x.year === year && x.month === month) || monthlyData[0] || {};
  const cat = m.categorieBreakdown || {};
  const isDeb = entity === 'debiteuren';
  const key = isDeb ? 'Debiteuren' : 'Crediteuren';
  const total = Math.abs(cat[key]?.netAmount || 0);
  // Without invoice-level data, distribute heuristically
  const ranges = buckets.map((b) => ({ range: b, amount: 0, count: 0 }));
  if (total > 0) {
    const split = [0.5, 0.25, 0.15, 0.10];
    for (let i = 0; i < ranges.length; i++) {
      ranges[i].amount = total * (split[i] || 0);
      ranges[i].count = Math.max(1, Math.round(ranges[i].amount / Math.max(1, total / 10)));
    }
  }
  const source_refs = collectSourceRefs(m.records || []);
  const query_hash = computeQueryHash('aging_report', { entity, as_of_period, buckets, detail });
  const result = { buckets: ranges, source_refs, query_hash };
  if (detail) result.detail_rows = (m.records || []).slice(0, 50);
  return result;
}

// Journal template
export async function journal_template(template, params) {
  const entries = [];
  const notes = [];
  if (template === 'depreciation') {
    const { asset_cost, useful_life_months, start_date, method = 'linear', contra_account } = params || {};
    const monthly = useful_life_months ? (asset_cost / useful_life_months) : 0;
    entries.push({ rekening: 'Afschrijvingskosten', debit: monthly, credit: 0, omschrijving: 'Maandelijkse afschrijving' });
    entries.push({ rekening: contra_account || 'Cumulatieve afschrijving', debit: 0, credit: monthly, omschrijving: 'Tegenrekening afschrijving' });
    notes.push(`Lineaire afschrijving vanaf ${start_date}`);
  } else if (template === 'ifrs16_initial') {
    const { pv_lease_payments, right_of_use_account, lease_liability_account, start_date } = params || {};
    entries.push({ rekening: right_of_use_account || 'ROU-asset', debit: pv_lease_payments, credit: 0, omschrijving: 'IFRS16 initiële verwerking' });
    entries.push({ rekening: lease_liability_account || 'Lease verplichting', debit: 0, credit: pv_lease_payments, omschrijving: 'IFRS16 initiële verplichting' });
    notes.push(`Startdatum ${start_date}`);
  } else if (template === 'ifrs16_monthly') {
    const { interest_rate, opening_liability, payment, months_elapsed } = params || {};
    const interest = opening_liability * (interest_rate || 0);
    const principal = payment - interest;
    entries.push({ rekening: 'Rentekosten', debit: interest, credit: 0, omschrijving: 'IFRS16 rente' });
    entries.push({ rekening: 'Lease verplichting', debit: principal, credit: 0, omschrijving: 'Aflossing' });
    entries.push({ rekening: 'Bank', debit: 0, credit: payment, omschrijving: 'Betaling lease' });
    notes.push(`Maand ${months_elapsed}`);
  }
  const query_hash = computeQueryHash('journal_template', { template, params });
  return { entries, notes, query_hash };
}

// Transaction Details - Gedetailleerde mutatie-analyse van bestaande AFAS data
export async function get_transaction_details(filters) {
  // Gebruik de al geladen records uit de cache of recente calls
  let records;
  
  if (filters.period_from && filters.period_to) {
    // Load only the specific period requested
    const [startYear, startMonth] = filters.period_from.split('-').map(x => parseInt(x, 10));
    const [endYear, endMonth] = filters.period_to.split('-').map(x => parseInt(x, 10));
    const result = await loadRecordsSmart({ startYear, startMonth, endYear, endMonth });
    records = result.records;
  } else {
    // Load broader range if no specific period given
    const result = await loadRecordsSmart({ 
      startYear: 2024, 
      startMonth: 1, 
      endYear: 2024, 
      endMonth: 12 
    });
    records = result.records;
  }
  
  // Apply filters to find specific transactions
  const filteredRecords = applyFilters(records, filters);
  
  // Group by boekstuknummer for transaction analysis
  const transactionGroups = new Map();
  
  filteredRecords.forEach(record => {
    const key = record.Boekstuknummer || 'onbekend';
    if (!transactionGroups.has(key)) {
      transactionGroups.set(key, []);
    }
    transactionGroups.get(key).push(record);
  });
  
  // Analyze each transaction group
  const detailedTransactions = Array.from(transactionGroups.entries()).map(([boekstuknummer, records]) => {
    const totalDebet = records.reduce((sum, r) => sum + (r.Bedrag_debet || 0), 0);
    const totalCredit = records.reduce((sum, r) => sum + (r.Bedrag_credit || 0), 0);
    const netAmount = totalCredit - totalDebet;
    
    // Get main transaction details
    const mainRecord = records[0];
    const allAccounts = records.map(r => ({
      rekening: r.Rekeningnummer,
      omschrijving: r.Omschrijving_2 || r.Omschrijving || '',
      categorie: r.Omschrijving_3 || r.Categorie || '',
      debet: r.Bedrag_debet || 0,
      credit: r.Bedrag_credit || 0,
      netAmount: (r.Bedrag_credit || 0) - (r.Bedrag_debet || 0)
    }));
    
    return {
      boekstuknummer,
      datum: mainRecord.Datum_boeking,
      boekstukdatum: mainRecord.Boekstukdatum,
      periode: `${mainRecord.Jaar}-${String(mainRecord.Periode).padStart(2, '0')}`,
      omschrijving: mainRecord.Omschrijving_boeking || mainRecord.Omschrijving || '',
      dagboek: mainRecord.Code_dagboek || '',
      dagboek_omschrijving: mainRecord.Omschrijving || '',
      factuurnummer: mainRecord.Factuurnummer || '',
      totalDebet,
      totalCredit,
      netAmount,
      recordCount: records.length,
      transactie_type: mainRecord.Code_dagboek === '70' ? 'Inkoop' :
                      mainRecord.Code_dagboek === '90' ? 'Verkoop' :
                      mainRecord.Code_dagboek === '95' ? 'Voorraad' :
                      mainRecord.Code_dagboek === '40' ? 'Bank/Kas' :
                      mainRecord.Code_dagboek === '20' ? 'Memoriaal' :
                      `Dagboek ${mainRecord.Code_dagboek}`,
      accounts: allAccounts,
      detail_regels: records.map(r => ({
        rekening: r.Rekeningnummer,
        rekening_naam: r.Omschrijving_2 || '',
        categorie: r.Omschrijving_3 || '',
        account_type: r.AccountTypeName || r.Type_rekening || '',
        debet: r.Bedrag_debet || 0,
        credit: r.Bedrag_credit || 0,
        netto: (r.Bedrag_credit || 0) - (r.Bedrag_debet || 0),
        omschrijving_regel: r.Omschrijving_boeking || '',
        kostenplaats: r.Kostenplaats || '',
        project: r.Project || ''
      }))
    };
  });
  
  // Sort by absolute net amount (largest first)
  detailedTransactions.sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount));
  
  const query_hash = computeQueryHash('transaction_details', filters);
  
  return {
    transactions: detailedTransactions.slice(0, 20), // Limit to top 20 transactions
    total_found: detailedTransactions.length,
    filters_applied: filters,
    analysis_summary: {
      total_transactions: detailedTransactions.length,
      total_net_amount: detailedTransactions.reduce((sum, t) => sum + t.netAmount, 0),
      periods_covered: [...new Set(detailedTransactions.map(t => t.periode))].sort(),
      dagboeken_involved: [...new Set(detailedTransactions.map(t => t.dagboek))].filter(Boolean)
    },
    query_hash
  };
}

// Post Details - Haal gedetailleerde omschrijvingen op voor specifieke post nummers (Boekstuknummer)
export async function get_post_descriptions(post_numbers, period_from = null, period_to = null) {
  console.log(`[TOOLS] Getting descriptions for posts: ${post_numbers.join(', ')}`);
  
  // Load records for the specified period or broader range
  let records;
  if (period_from && period_to) {
    const [startYear, startMonth] = period_from.split('-').map(x => parseInt(x, 10));
    const [endYear, endMonth] = period_to.split('-').map(x => parseInt(x, 10));
    const result = await loadRecordsSmart({ startYear, startMonth, endYear, endMonth });
    records = result.records;
  } else {
    // Load current year if no period specified
    const currentYear = new Date().getFullYear();
    const result = await loadRecordsSmart({ 
      startYear: currentYear - 1, 
      startMonth: 1, 
      endYear: currentYear, 
      endMonth: 12 
    });
    records = result.records;
  }
  
  // Find records matching the post numbers
  const postDetails = [];
  
  for (const postNumber of post_numbers) {
    const matchingRecords = records.filter(r => 
      String(r.Boekstuknummer) === String(postNumber)
    );
    
    if (matchingRecords.length === 0) {
      postDetails.push({
        post_number: postNumber,
        found: false,
        message: `Post ${postNumber} niet gevonden in de data`
      });
      continue;
    }
    
    // Get the main record (first occurrence)
    const mainRecord = matchingRecords[0];
    
    // Calculate totals for this post
    const totalDebet = matchingRecords.reduce((sum, r) => sum + (r.Bedrag_debet || 0), 0);
    const totalCredit = matchingRecords.reduce((sum, r) => sum + (r.Bedrag_credit || 0), 0);
    const netAmount = totalCredit - totalDebet;
    
    // Get all unique descriptions from this post
    const descriptions = [
      ...new Set([
        mainRecord.Omschrijving_boeking,
        mainRecord.Omschrijving,
        mainRecord.Omschrijving_2,
        mainRecord.Omschrijving_3
      ].filter(Boolean))
    ];
    
    // Get all unique account names involved
    const accounts = [...new Set(matchingRecords.map(r => ({
      rekening: r.Rekeningnummer,
      naam: r.Omschrijving_2 || r.Omschrijving || '',
      categorie: r.Omschrijving_3 || ''
    })).filter(acc => acc.rekening))];
    
    postDetails.push({
      post_number: postNumber,
      found: true,
      datum: mainRecord.Datum_boeking || mainRecord.Boekstukdatum,
      periode: `${mainRecord.Jaar}-${String(mainRecord.Periode).padStart(2, '0')}`,
      
      // Descriptions
      omschrijving_boeking: mainRecord.Omschrijving_boeking || '',
      omschrijving_hoofdrekening: mainRecord.Omschrijving || '',
      omschrijving_subrekening: mainRecord.Omschrijving_2 || '',
      categorie: mainRecord.Omschrijving_3 || '',
      alle_omschrijvingen: descriptions,
      
      // Transaction details
      dagboek: mainRecord.Code_dagboek || '',
      dagboek_type: mainRecord.Code_dagboek === '70' ? 'Inkoop' :
                   mainRecord.Code_dagboek === '90' ? 'Verkoop' :
                   mainRecord.Code_dagboek === '95' ? 'Voorraad' :
                   mainRecord.Code_dagboek === '40' ? 'Bank/Kas' :
                   mainRecord.Code_dagboek === '20' ? 'Memoriaal' :
                   `Dagboek ${mainRecord.Code_dagboek}`,
      factuurnummer: mainRecord.Factuurnummer || '',
      
      // Financial totals
      totaal_debet: totalDebet,
      totaal_credit: totalCredit,
      netto_bedrag: netAmount,
      aantal_regels: matchingRecords.length,
      
      // Involved accounts
      betrokken_rekeningen: accounts,
      
      // Additional context
      kostenplaats: mainRecord.Kostenplaats || '',
      project: mainRecord.Project || '',
      relatie: mainRecord.Relatie || '',
      
      // Summary for AI context
      samenvatting: `Post ${postNumber} (${mainRecord.Jaar}-${String(mainRecord.Periode).padStart(2, '0')}): ${descriptions.join(' | ')} - ${accounts.map(a => `${a.rekening}:${a.naam}`).join(', ')} - Netto: €${netAmount.toLocaleString('nl-NL', {minimumFractionDigits: 2})}`
    });
  }
  
  const query_hash = computeQueryHash('get_post_descriptions', { post_numbers, period_from, period_to });
  
  return {
    posts: postDetails,
    found_posts: postDetails.filter(p => p.found).length,
    missing_posts: postDetails.filter(p => !p.found).map(p => p.post_number),
    context_summary: postDetails
      .filter(p => p.found)
      .map(p => p.samenvatting)
      .join('\n'),
    query_hash
  };
}

// Tool registry for chat function-calling
export const toolRegistry = {
  get_profit_loss_statement: {
    fn: get_profit_loss_statement,
    argOrder: ['period_from', 'period_to', 'granularity', 'filters'],
    parameters: {
      type: 'object',
      properties: {
        period_from: { type: 'string', description: "'YYYY-MM'" },
        period_to: { type: 'string', description: "'YYYY-MM'" },
        granularity: { type: 'string', enum: ['month', 'quarter', 'YTD'] },
        filters: { type: 'object', properties: {}, additionalProperties: false }
      },
      required: ['period_from', 'period_to', 'granularity', 'filters'],
      additionalProperties: false
    }
  },
  get_balance_sheet: {
    fn: get_balance_sheet,
    argOrder: ['as_of_period', 'side'],
    parameters: {
      type: 'object', properties: { as_of_period: { type: 'string' }, side: { type: 'string', enum: ['assets', 'liabilities', 'equity', 'both'] } }, required: ['as_of_period', 'side'], additionalProperties: false
    }
  },
  get_cash_flow_statement: {
    fn: get_cash_flow_statement,
    argOrder: ['period_from', 'period_to', 'method'],
    parameters: { type: 'object', properties: { period_from: { type: 'string' }, period_to: { type: 'string' }, method: { type: 'string', enum: ['indirect'] } }, required: ['period_from', 'period_to', 'method'], additionalProperties: false }
  },
  list_journal_entries: {
    fn: list_journal_entries,
    argOrder: ['filters', 'limit', 'offset'],
    parameters: { type: 'object', properties: { filters: { type: 'object', properties: {}, additionalProperties: false }, limit: { type: 'number' }, offset: { type: 'number' } }, required: ['filters', 'limit', 'offset'], additionalProperties: false }
  },
  aggregate_by: {
    fn: aggregate_by,
    argOrder: ['dimension', 'period_from', 'period_to', 'top_n', 'filters'],
    parameters: { type: 'object', properties: { dimension: { type: 'string', enum: ['rekening', 'post', 'kostenplaats', 'project', 'debiteur', 'crediteur'] }, period_from: { type: 'string' }, period_to: { type: 'string' }, top_n: { type: 'number' }, filters: { type: 'object', properties: {}, additionalProperties: false } }, required: ['dimension', 'period_from', 'period_to', 'top_n', 'filters'], additionalProperties: false }
  },
  variance_report: {
    fn: variance_report,
    argOrder: ['scope', 'a_from', 'a_to', 'b_from', 'b_to', 'basis', 'dimension'],
    parameters: { type: 'object', properties: { scope: { type: 'string', enum: ['P&L', 'Balance', 'CashFlow'] }, a_from: { type: 'string' }, a_to: { type: 'string' }, b_from: { type: 'string' }, b_to: { type: 'string' }, basis: { type: 'string', enum: ['abs', 'pct'] }, dimension: { type: 'string', enum: ['post', 'rekening', 'kostenplaats', 'project'] } }, required: ['scope', 'a_from', 'a_to', 'b_from', 'b_to', 'basis', 'dimension'], additionalProperties: false }
  },
  top_deviations: {
    fn: top_deviations,
    argOrder: ['scope', 'period_from', 'period_to', 'compare_to', 'n', 'direction', 'dimension'],
    parameters: { type: 'object', properties: { scope: { type: 'string', enum: ['P&L', 'Balance', 'CashFlow'] }, period_from: { type: 'string' }, period_to: { type: 'string' }, compare_to: { type: 'string', enum: ['prev_period', 'same_period_last_year', 'budget'] }, n: { type: 'number' }, direction: { type: 'string', enum: ['increases', 'decreases', 'both'] }, dimension: { type: 'string', enum: ['post', 'rekening'] } }, required: ['scope', 'period_from', 'period_to', 'compare_to', 'n', 'direction', 'dimension'], additionalProperties: false }
  },
  explain_account_change: {
    fn: explain_account_change,
    argOrder: ['account_or_post', 'a_period', 'b_period', 'breakdown'],
    parameters: { type: 'object', properties: { account_or_post: { type: 'string' }, a_period: { type: 'string' }, b_period: { type: 'string' }, breakdown: { type: 'string', enum: ['rekening', 'kostenplaats', 'project', 'boekstuk'] } }, required: ['account_or_post', 'a_period', 'b_period', 'breakdown'], additionalProperties: false }
  },
  anomaly_scan: {
    fn: anomaly_scan,
    argOrder: ['period_from', 'period_to', 'zscore', 'min_amount', 'by'],
    parameters: { type: 'object', properties: { period_from: { type: 'string' }, period_to: { type: 'string' }, zscore: { type: 'number' }, min_amount: { type: 'number' }, by: { type: 'string', enum: ['post', 'rekening'] } }, required: ['period_from', 'period_to', 'zscore', 'min_amount', 'by'], additionalProperties: false }
  },
  reconcile_pl_to_balance: {
    fn: reconcile_pl_to_balance,
    argOrder: ['period_from', 'period_to'],
    parameters: { type: 'object', properties: { period_from: { type: 'string' }, period_to: { type: 'string' } }, required: ['period_from', 'period_to'], additionalProperties: false }
  },
  ratio_current: { fn: ratio_current, argOrder: ['as_of_period'], parameters: { type: 'object', properties: { as_of_period: { type: 'string' } }, required: ['as_of_period'], additionalProperties: false } },
  ratio_quick: { fn: ratio_quick, argOrder: ['as_of_period'], parameters: { type: 'object', properties: { as_of_period: { type: 'string' } }, required: ['as_of_period'], additionalProperties: false } },
  ratio_debt_to_equity: { fn: ratio_debt_to_equity, argOrder: ['as_of_period'], parameters: { type: 'object', properties: { as_of_period: { type: 'string' } }, required: ['as_of_period'], additionalProperties: false } },
  ratio_gross_margin: { fn: ratio_gross_margin, argOrder: ['period_from', 'period_to'], parameters: { type: 'object', properties: { period_from: { type: 'string' }, period_to: { type: 'string' } }, required: ['period_from', 'period_to'], additionalProperties: false } },
  trend: { fn: trend, argOrder: ['series', 'kpi', 'period_from', 'period_to', 'window'], parameters: { type: 'object', properties: { series: { type: 'string' }, kpi: { type: 'string' }, period_from: { type: 'string' }, period_to: { type: 'string' }, window: { type: 'number' } }, required: ['series', 'kpi', 'period_from', 'period_to', 'window'], additionalProperties: false } },
  aging_report: { fn: aging_report, argOrder: ['entity', 'as_of_period', 'buckets', 'detail'], parameters: { type: 'object', properties: { entity: { type: 'string', enum: ['debiteuren', 'crediteuren'] }, as_of_period: { type: 'string' }, buckets: { type: 'array', items: { type: 'string' } }, detail: { type: 'boolean' } }, required: ['entity', 'as_of_period'], additionalProperties: false } },
  journal_template: { fn: journal_template, argOrder: ['template', 'params'], parameters: { type: 'object', properties: { template: { type: 'string', enum: ['depreciation', 'ifrs16_initial', 'ifrs16_monthly'] }, params: { type: 'object', properties: {}, additionalProperties: false } }, required: ['template'], additionalProperties: false } },
  get_transaction_details: { fn: get_transaction_details, argOrder: ['filters'], parameters: { type: 'object', properties: { filters: { type: 'object', properties: { period_from: { type: 'string' }, period_to: { type: 'string' }, boekstuknummer: { type: 'string' }, rekening: { type: 'string' }, tekst: { type: 'string' }, bedrag_min: { type: 'number' }, bedrag_max: { type: 'number' } }, additionalProperties: false } }, required: ['filters'], additionalProperties: false } },
  get_opening_balance: { fn: get_opening_balance, argOrder: ['period_start'], parameters: { type: 'object', properties: { period_start: { type: 'string', description: 'Start period in YYYY-MM format. Opening balance will include all transactions BEFORE this period.' } }, required: ['period_start'], additionalProperties: false } },
  get_post_descriptions: { fn: get_post_descriptions, argOrder: ['post_numbers', 'period_from', 'period_to'], parameters: { type: 'object', properties: { post_numbers: { type: 'array', items: { type: 'string' }, description: "Array of post numbers (Boekstuknummer) to get descriptions for, e.g. ['SA000107', '942', '1003']" }, period_from: { type: 'string', description: "Start period in 'YYYY-MM' format (optional)" }, period_to: { type: 'string', description: "End period in 'YYYY-MM' format (optional)" } }, required: ['post_numbers'], additionalProperties: false } }
};

export function getToolsForOpenAI() {
  return Object.entries(toolRegistry).map(([name, def]) => ({
    type: 'function',
    name,
    description: name.replaceAll('_', ' '),
    parameters: def.parameters,
    strict: true
  }));
}

export function getToolsForGemini() {
  
  const tools = [];
  
  tools.push({
    name: 'get_profit_loss_statement',
    description: 'Genereren van een winst- en verliesrekening voor een bepaalde periode',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' },
        granularity: { type: Type.STRING, description: 'Detailniveau: month, quarter, YTD' },
        filters: { type: Type.OBJECT, description: 'Optionele filters' }
      },
      required: ['period_from', 'period_to', 'granularity', 'filters']
    }
  });

  tools.push({
    name: 'get_balance_sheet',
    description: 'Genereren van een balans op een bepaalde peildatum',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_period: { type: Type.STRING, description: 'Peildatum (YYYY-MM)' },
        side: { type: Type.STRING, description: 'Welke kant: assets, liabilities, equity, both' }
      },
      required: ['as_of_period', 'side']
    }
  });

  tools.push({
    name: 'get_cash_flow_statement',
    description: 'Genereren van een kasstroomoverzicht voor een periode',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' },
        method: { type: Type.STRING, description: 'Methode: indirect' }
      },
      required: ['period_from', 'period_to', 'method']
    }
  });

  tools.push({
    name: 'list_journal_entries',
    description: 'Opvragen van grootboekboekingen met filters',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filters: { type: Type.OBJECT, description: 'Selectiecriteria' },
        limit: { type: Type.NUMBER, description: 'Maximum aantal resultaten' },
        offset: { type: Type.NUMBER, description: 'Startpunt voor paginering' }
      },
      required: ['filters', 'limit', 'offset']
    }
  });

  tools.push({
    name: 'aggregate_by',
    description: 'Aggregeren van data op verschillende dimensies zoals rekening, post, kostenplaats',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dimension: { type: Type.STRING, description: 'Aggregatieniveau: rekening, post, kostenplaats, project, debiteur, crediteur' },
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' },
        top_n: { type: Type.NUMBER, description: 'Aantal top resultaten' },
        filters: { type: Type.OBJECT, description: 'Selectiecriteria' }
      },
      required: ['dimension', 'period_from', 'period_to', 'top_n', 'filters']
    }
  });

  tools.push({
    name: 'variance_report',
    description: 'Vergelijking tussen twee periodes voor verschillenanalyse',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scope: { type: Type.STRING, description: 'Bereik: P&L, Balance, CashFlow' },
        a_from: { type: Type.STRING, description: 'Eerste periode van (YYYY-MM)' },
        a_to: { type: Type.STRING, description: 'Eerste periode tot (YYYY-MM)' },
        b_from: { type: Type.STRING, description: 'Tweede periode van (YYYY-MM)' },
        b_to: { type: Type.STRING, description: 'Tweede periode tot (YYYY-MM)' },
        basis: { type: Type.STRING, description: 'Vergelijkingsbasis: abs, pct' },
        dimension: { type: Type.STRING, description: 'Detailniveau: post, rekening, kostenplaats, project' }
      },
      required: ['scope', 'a_from', 'a_to', 'b_from', 'b_to', 'basis', 'dimension']
    }
  });

  tools.push({
    name: 'top_deviations',
    description: 'Identificeren van grootste afwijkingen t.o.v. vorige periode',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scope: { type: Type.STRING, description: 'Bereik: P&L, Balance, CashFlow' },
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' },
        compare_to: { type: Type.STRING, description: 'Vergelijkingsbasis: prev_period, same_period_last_year, budget' },
        n: { type: Type.NUMBER, description: 'Aantal resultaten' },
        direction: { type: Type.STRING, description: 'Richting: increases, decreases, both' },
        dimension: { type: Type.STRING, description: 'Analyseniveau: post, rekening' }
      },
      required: ['scope', 'period_from', 'period_to', 'compare_to', 'n', 'direction', 'dimension']
    }
  });

  tools.push({
    name: 'explain_account_change',
    description: 'Detailanalyse van veranderingen in een specifieke rekening of post',
    parameters: {
      type: Type.OBJECT,
      properties: {
        account_or_post: { type: Type.STRING, description: 'Rekening of post naam' },
        a_period: { type: Type.STRING, description: 'Eerste periode (YYYY-MM)' },
        b_period: { type: Type.STRING, description: 'Tweede periode (YYYY-MM)' },
        breakdown: { type: Type.STRING, description: 'Detailniveau: rekening, kostenplaats, project, boekstuk' }
      },
      required: ['account_or_post', 'a_period', 'b_period', 'breakdown']
    }
  });

  tools.push({
    name: 'anomaly_scan',
    description: 'Detecteren van ongewone patronen in financiële data',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' },
        zscore: { type: Type.NUMBER, description: 'Statistische drempelwaarde' },
        min_amount: { type: Type.NUMBER, description: 'Minimum bedrag' },
        by: { type: Type.STRING, description: 'Analyseniveau: post, rekening' }
      },
      required: ['period_from', 'period_to', 'zscore', 'min_amount', 'by']
    }
  });

  tools.push({
    name: 'reconcile_pl_to_balance',
    description: 'Aansluiting winst- en verliesrekening met balans',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' }
      },
      required: ['period_from', 'period_to']
    }
  });

  tools.push({
    name: 'ratio_current',
    description: 'Berekenen van current ratio (vlottende activa / kortlopende schulden)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_period: { type: Type.STRING, description: 'Peildatum (YYYY-MM)' }
      },
      required: ['as_of_period']
    }
  });

  tools.push({
    name: 'ratio_quick',
    description: 'Berekenen van quick ratio (liquid ratio)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_period: { type: Type.STRING, description: 'Peildatum (YYYY-MM)' }
      },
      required: ['as_of_period']
    }
  });

  tools.push({
    name: 'ratio_debt_to_equity',
    description: 'Berekenen van debt-to-equity ratio (solvabiliteit)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        as_of_period: { type: Type.STRING, description: 'Peildatum (YYYY-MM)' }
      },
      required: ['as_of_period']
    }
  });

  tools.push({
    name: 'ratio_gross_margin',
    description: 'Berekenen van bruto winstmarge',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' }
      },
      required: ['period_from', 'period_to']
    }
  });

  tools.push({
    name: 'trend',
    description: 'Trendanalyse van KPIs over tijd',
    parameters: {
      type: Type.OBJECT,
      properties: {
        series: { type: Type.STRING, description: 'Type serie' },
        kpi: { type: Type.STRING, description: 'Te analyseren metric' },
        period_from: { type: Type.STRING, description: 'Begin periode (YYYY-MM)' },
        period_to: { type: Type.STRING, description: 'Eind periode (YYYY-MM)' },
        window: { type: Type.NUMBER, description: 'Analyse window' }
      },
      required: ['series', 'kpi', 'period_from', 'period_to', 'window']
    }
  });

  tools.push({
    name: 'aging_report',
    description: 'Ouderdomsanalyse van debiteuren of crediteuren',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entity: { type: Type.STRING, description: 'Type: debiteuren, crediteuren' },
        as_of_period: { type: Type.STRING, description: 'Peildatum (YYYY-MM)' },
        buckets: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING },
          description: 'Ouderdomscategorieën (bijv. ["0-30", "31-60", "61-90", ">90"])' 
        },
        detail: { type: Type.BOOLEAN, description: 'Detail niveau' }
      },
      required: ['entity', 'as_of_period']
    }
  });

  tools.push({
    name: 'journal_template',
    description: 'Genereren van boekingssjablonen voor standaard transacties',
    parameters: {
      type: Type.OBJECT,
      properties: {
        template: { type: Type.STRING, description: 'Type: depreciation, ifrs16_initial, ifrs16_monthly' },
        params: { type: Type.OBJECT, description: 'Template-specifieke parameters' }
      },
      required: ['template']
    }
  });

  return tools;
}

function getToolDescription(name) {
  const descriptions = {
    get_profit_loss_statement: 'Genereren van een winst- en verliesrekening voor een bepaalde periode',
    get_balance_sheet: 'Genereren van een balans op een bepaalde peildatum',
    get_cash_flow_statement: 'Genereren van een kasstroomoverzicht voor een periode',
    list_journal_entries: 'Opvragen van grootboekboekingen met filters',
    aggregate_by: 'Aggregeren van data op verschillende dimensies zoals rekening, post, kostenplaats',
    variance_report: 'Vergelijking tussen twee periodes voor verschillenanalyse',
    top_deviations: 'Identificeren van grootste afwijkingen t.o.v. vorige periode',
    explain_account_change: 'Detailanalyse van veranderingen in een specifieke rekening of post',
    anomaly_scan: 'Detecteren van ongewone patronen in financiële data',
    reconcile_pl_to_balance: 'Aansluiting winst- en verliesrekening met balans',
    ratio_current: 'Berekenen van current ratio (vlottende activa / kortlopende schulden)',
    ratio_quick: 'Berekenen van quick ratio (liquid ratio)',
    ratio_debt_to_equity: 'Berekenen van debt-to-equity ratio (solvabiliteit)',
    ratio_gross_margin: 'Berekenen van bruto winstmarge',
    trend: 'Trendanalyse van KPIs over tijd',
    aging_report: 'Ouderdomsanalyse van debiteuren of crediteuren',
    journal_template: 'Genereren van boekingssjablonen voor standaard transacties',
    get_transaction_details: 'Gedetailleerde analyse van specifieke financiële mutaties en transacties'
  };
  return descriptions[name] || '';
}

function convertToGeminiSchema(openaiSchema) {
  // Convert OpenAI schema to Gemini schema
  const geminiSchema = {
    type: "OBJECT",
    properties: {}
  };

  if (openaiSchema.properties) {
    for (const [key, value] of Object.entries(openaiSchema.properties)) {
      geminiSchema.properties[key] = convertProperty(value);
    }
  }

  if (openaiSchema.required) {
    geminiSchema.required = openaiSchema.required;
  }

  return geminiSchema;
}

function convertProperty(prop) {
  const geminiProp = {};
  
  switch (prop.type) {
    case 'string':
      geminiProp.type = 'STRING';
      break;
    case 'number':
      geminiProp.type = 'NUMBER';
      break;
    case 'integer':
      geminiProp.type = 'INTEGER';
      break;
    case 'boolean':
      geminiProp.type = 'BOOLEAN';
      break;
    case 'array':
      geminiProp.type = 'ARRAY';
      if (prop.items) {
        geminiProp.items = convertProperty(prop.items);
      }
      break;
    case 'object':
      geminiProp.type = 'OBJECT';
      if (prop.properties) {
        geminiProp.properties = {};
        for (const [key, value] of Object.entries(prop.properties)) {
          geminiProp.properties[key] = convertProperty(value);
        }
      }
      break;
    default:
      geminiProp.type = 'STRING';
  }

  if (prop.description) {
    geminiProp.description = prop.description;
  }

  if (prop.enum) {
    geminiProp.enum = prop.enum;
  }

  return geminiProp;
}

// Calculate Opening Balance (all transactions before the period start)
function calculateOpeningBalance(allRecords, periodStartYear, periodStartMonth) {
  console.log(`[OPENING-BALANCE] Calculating opening balance before ${periodStartYear}-${periodStartMonth}`);
  
  // Filter records to only include those BEFORE the period start
  const openingRecords = allRecords.filter(row => {
    const rowYear = row.Jaar;
    const rowMonth = row.Periode;
    
    // Only include records before the period start
    if (rowYear < periodStartYear) return true;
    if (rowYear === periodStartYear && rowMonth < periodStartMonth) return true;
    return false;
  });

  console.log(`[OPENING-BALANCE] Found ${openingRecords.length} opening balance records (before ${periodStartYear}-${periodStartMonth})`);

  // Calculate totals per account type for opening balance
  const openingTotals = {
    activa: 0,
    passiva: 0,
    kosten: 0,
    opbrengsten: 0
  };

  const openingCategories = {};
  const openingAccounts = {};

  openingRecords.forEach(row => {
    const debet = row.Bedrag_debet || 0;
    const credit = row.Bedrag_credit || 0;
    const netAmount = debet - credit;
    const typeRekening = row.Type_rekening;
    const category = getCategoryFromDescription(row.Omschrijving_3, row.Kenmerk_rekening);
    const accountKey = `${row.Rekeningnummer}-${row.Omschrijving_2 || 'Onbekend'}`;

    // Accumulate by account type
    if (typeRekening === 'Activa') {
      openingTotals.activa += netAmount;
    } else if (typeRekening === 'Passiva') {
      openingTotals.passiva += netAmount;
    } else if (typeRekening === 'Kosten') {
      openingTotals.kosten += netAmount;
    } else if (typeRekening === 'Opbrengsten') {
      openingTotals.opbrengsten += netAmount;
    }

    // Accumulate by category
    if (!openingCategories[category]) {
      openingCategories[category] = {
        netAmount: 0,
        recordCount: 0,
        typeRekening: typeRekening
      };
    }
    openingCategories[category].netAmount += netAmount;
    openingCategories[category].recordCount += 1;

    // Accumulate by account
    if (!openingAccounts[accountKey]) {
      openingAccounts[accountKey] = {
        rekeningnummer: row.Rekeningnummer,
        omschrijving: row.Omschrijving_2 || 'Onbekend',
        typeRekening: typeRekening,
        netAmount: 0,
        recordCount: 0
      };
    }
    openingAccounts[accountKey].netAmount += netAmount;
    openingAccounts[accountKey].recordCount += 1;
  });

  // Calculate opening balance eigen vermogen
  const openingEigenVermogen = openingTotals.activa + openingTotals.passiva;
  
  // For balance sheet, we need to include accumulated P&L in eigen vermogen
  const accumulatedResult = openingTotals.opbrengsten + openingTotals.kosten; // Kosten are typically negative
  const totalOpeningEigenVermogen = openingEigenVermogen + accumulatedResult;

  console.log(`[OPENING-BALANCE] Opening totals - Activa: €${openingTotals.activa.toFixed(2)}, Passiva: €${openingTotals.passiva.toFixed(2)}, Eigen Vermogen: €${totalOpeningEigenVermogen.toFixed(2)}`);

  return {
    totals: {
      activa: openingTotals.activa,
      passiva: Math.abs(openingTotals.passiva), // Make passiva positive for display
      eigenVermogen: totalOpeningEigenVermogen,
      totaalPassiva: Math.abs(openingTotals.passiva) + totalOpeningEigenVermogen,
      accumulatedPL: accumulatedResult
    },
    categories: openingCategories,
    accounts: openingAccounts,
    recordCount: openingRecords.length,
    periodBefore: `${periodStartYear}-${String(periodStartMonth).padStart(2, '0')}`
  };
}

export async function executeToolCall(call) {
  const def = toolRegistry[call.function.name];
  if (!def) throw new Error(`Unknown tool ${call.function.name}`);
  const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  const ordered = def.argOrder ? def.argOrder.map((k) => args[k]) : Object.values(args);
  const result = await def.fn(...ordered);
  return JSON.stringify(result);
}


