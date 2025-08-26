// Client-side transformation of raw AFAS records into the structure
// expected by the v2 financial UI. This allows fast period changes
// without extra API calls.

function getCategoryFromDescription(omschrijving3, kenmerkRekening) {
  if (omschrijving3) {
    return String(omschrijving3).trim();
  }
  if (kenmerkRekening) {
    const kenmerk = String(kenmerkRekening).trim();
    if (kenmerk === 'Crediteuren' || kenmerk === 'Debiteuren') return kenmerk;
    if (kenmerk === 'Grootboekrekening') return 'Overige';
    return kenmerk;
  }
  return 'Overige';
}

function getAccountTypeName(typeRekening) {
  const map = { Kosten: 'Kosten', Passiva: 'Passiva', Opbrengsten: 'Opbrengsten', Activa: 'Activa' };
  return map[typeRekening] || typeRekening || 'Overige';
}

function isInRange(row, range) {
  const y = row.Jaar;
  const m = row.Periode;
  if (y < range.startYear || y > range.endYear) return false;
  if (y === range.startYear && m < range.startMonth) return false;
  if (y === range.endYear && m > range.endMonth) return false;
  return true;
}

export function buildFinancialView(allRecords, range) {
  if (!Array.isArray(allRecords)) {
    return null;
  }

  // Prepare copies with derived fields used downstream
  const prepared = allRecords.map((row) => {
    const copy = { ...row };
    const category = getCategoryFromDescription(copy.Omschrijving_3, copy.Kenmerk_rekening);
    copy.Categorie = category;
    copy.AccountTypeName = getAccountTypeName(copy.Type_rekening);
    return copy;
  });

  // Filter range
  const filtered = prepared.filter((row) => isInRange(row, range));

  const groupedData = {};
  const categoryTotals = {};
  const accountTypeTotals = {};

  for (const row of filtered) {
    const year = row.Jaar;
    const month = row.Periode;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const category = row.Categorie;
    const accountTypeName = row.AccountTypeName;

    if (!groupedData[monthKey]) {
      const displayDate = new Date(year, month - 1, 1);
      groupedData[monthKey] = {
        year,
        month,
        monthName: displayDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }),
        records: [],
        totalDebet: 0,
        totalCredit: 0,
        netAmount: 0,
        categorieBreakdown: {},
        accountTypeBreakdown: {}
      };
    }

    const g = groupedData[monthKey];
    const deb = row.Bedrag_debet || 0;
    const cre = row.Bedrag_credit || 0;
    g.records.push(row);
    g.totalDebet += deb;
    g.totalCredit += cre;
    g.netAmount = g.totalCredit - g.totalDebet;

    if (!g.categorieBreakdown[category]) {
      g.categorieBreakdown[category] = { totalDebet: 0, totalCredit: 0, netAmount: 0, recordCount: 0 };
    }
    g.categorieBreakdown[category].totalDebet += deb;
    g.categorieBreakdown[category].totalCredit += cre;
    g.categorieBreakdown[category].netAmount = g.categorieBreakdown[category].totalCredit - g.categorieBreakdown[category].totalDebet;
    g.categorieBreakdown[category].recordCount += 1;

    if (!g.accountTypeBreakdown[accountTypeName]) {
      g.accountTypeBreakdown[accountTypeName] = { totalDebet: 0, totalCredit: 0, netAmount: 0, recordCount: 0 };
    }
    g.accountTypeBreakdown[accountTypeName].totalDebet += deb;
    g.accountTypeBreakdown[accountTypeName].totalCredit += cre;
    g.accountTypeBreakdown[accountTypeName].netAmount = g.accountTypeBreakdown[accountTypeName].totalCredit - g.accountTypeBreakdown[accountTypeName].totalDebet;
    g.accountTypeBreakdown[accountTypeName].recordCount += 1;

    // Overall totals
    if (!categoryTotals[category]) {
      categoryTotals[category] = { totalDebet: 0, totalCredit: 0, netAmount: 0, recordCount: 0 };
    }
    categoryTotals[category].totalDebet += deb;
    categoryTotals[category].totalCredit += cre;
    categoryTotals[category].netAmount = categoryTotals[category].totalCredit - categoryTotals[category].totalDebet;
    categoryTotals[category].recordCount += 1;

    if (!accountTypeTotals[accountTypeName]) {
      accountTypeTotals[accountTypeName] = { totalDebet: 0, totalCredit: 0, netAmount: 0, recordCount: 0 };
    }
    accountTypeTotals[accountTypeName].totalDebet += deb;
    accountTypeTotals[accountTypeName].totalCredit += cre;
    accountTypeTotals[accountTypeName].netAmount = accountTypeTotals[accountTypeName].totalCredit - accountTypeTotals[accountTypeName].totalDebet;
    accountTypeTotals[accountTypeName].recordCount += 1;
  }

  const monthlyData = Object.values(groupedData).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const activaTotal = accountTypeTotals['Activa']?.netAmount || 0;
  const passivaTotal = accountTypeTotals['Passiva']?.netAmount || 0;
  const eigenVermogen = activaTotal - Math.abs(passivaTotal);
  const totaalPassivaInclusief = Math.abs(passivaTotal) + eigenVermogen;

  const eigenVermogenPerMonth = monthlyData.map((m) => {
    const monthActiva = m.accountTypeBreakdown['Activa']?.netAmount || 0;
    const monthVreemdVermogen = m.accountTypeBreakdown['Passiva']?.netAmount || 0;
    const monthEigenVermogen = monthActiva - Math.abs(monthVreemdVermogen);
    return {
      monthKey: `${m.year}-${String(m.month).padStart(2, '0')}`,
      year: m.year,
      month: m.month,
      monthName: m.monthName,
      activa: monthActiva,
      vreemdVermogen: monthVreemdVermogen,
      eigenVermogen: monthEigenVermogen,
      totaalPassiva: Math.abs(monthVreemdVermogen) + monthEigenVermogen
    };
  });

  const result = {
    summary: {
      totalRecords: filtered.length,
      monthsIncluded: monthlyData.length,
      dataSource: 'AFAS API v2 (client-aggregated)',
      dateRange: {
        startYear: range.startYear,
        startMonth: range.startMonth,
        endYear: range.endYear,
        endMonth: range.endMonth
      },
      totalDebet: filtered.reduce((s, r) => s + (r.Bedrag_debet || 0), 0),
      totalCredit: filtered.reduce((s, r) => s + (r.Bedrag_credit || 0), 0),
      netAmount: filtered.reduce((s, r) => s + (r.Bedrag_credit || 0), 0) - filtered.reduce((s, r) => s + (r.Bedrag_debet || 0), 0)
    },
    categoryTotals,
    accountTypeTotals,
    balans: {
      activa: activaTotal,
      vreemdVermogen: passivaTotal,
      eigenVermogen,
      totaalPassiva: totaalPassivaInclusief,
      perMonth: eigenVermogenPerMonth
    },
    monthlyData,
    allRecords: filtered,
    // Minimal placeholder for checks to keep UI compatible; can be expanded if needed
    financialChecks: {
      byMonth: {},
      overall: []
    }
  };

  return result;
}




