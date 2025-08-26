// ARCHIVED VERSION - Route with account number to category mapping
// This version maps categories based on account numbers (Rekeningnummer field)
// Archived on request - might be needed later

// Mapping van rekeningnummers naar categorieën
const accountCategoryMapping = {
  // Personeelskosten direct
  "4000": "Personeelskosten direct",
  "4010": "Personeelskosten direct", 
  "4050": "Personeelskosten direct",
  "4076": "Personeelskosten direct",
  "4070": "Personeelskosten direct",
  "4075": "Personeelskosten direct",
  "4101": "Personeelskosten direct",
  "4030": "Personeelskosten direct",
  "4096": "Personeelskosten direct",
  "4035": "Personeelskosten direct",
  "4005": "Personeelskosten direct",
  "4011": "Personeelskosten direct",
  "4015": "Personeelskosten direct",
  "4040": "Personeelskosten direct",
  "4020": "Personeelskosten direct",
  "4025": "Personeelskosten direct",
  "4060": "Personeelskosten direct",
  "4077": "Personeelskosten direct",
  "4078": "Personeelskosten direct",
  "4100": "Personeelskosten direct",
  "4080": "Personeelskosten direct",
  "4097": "Personeelskosten direct",
  
  // Operationele personeelskosten
  "4055": "Operationele personeelskosten",
  "4095": "Operationele personeelskosten",
  "4007": "Operationele personeelskosten",
  "4012": "Operationele personeelskosten",
  "4013": "Operationele personeelskosten",
  "4043": "Operationele personeelskosten",
  "4045": "Operationele personeelskosten",
  "4046": "Operationele personeelskosten",
  "4048": "Operationele personeelskosten",
  "4072": "Operationele personeelskosten",
  "4073": "Operationele personeelskosten",
  "4074": "Operationele personeelskosten",
  "4170": "Operationele personeelskosten",
  "4600": "Operationele personeelskosten",
  "4810": "Operationele personeelskosten",
  "4830": "Operationele personeelskosten",
  "4940": "Operationele personeelskosten",
  "4930": "Operationele personeelskosten",
  
  // Huisvestingskosten
  "4200": "Huisvestingskosten",
  "4260": "Huisvestingskosten",
  "4250": "Huisvestingskosten",
  "4300": "Huisvestingskosten",
  "4205": "Huisvestingskosten",
  "4210": "Huisvestingskosten",
  
  // Kantoorkosten
  "4500": "Kantoorkosten",
  "4510": "Kantoorkosten",
  "4530": "Kantoorkosten",
  "4520": "Kantoorkosten",
  "4540": "Kantoorkosten",
  "4680": "Kantoorkosten",
  "4640": "Kantoorkosten", //AFAS
  
  // Algemene kosten
  "4560": "Algemene kosten",
  "4550": "Algemene kosten",
  "4610": "Algemene kosten",
  "4820": "Algemene kosten",
  "4900": "Algemene kosten",
  "4310": "Algemene kosten",
  "4320": "Algemene kosten",
  "4330": "Algemene kosten",
  "4360": "Algemene kosten",
  "4800": "Algemene kosten",
  "4802": "Algemene kosten",
  "4850": "Algemene kosten",
  "4860": "Algemene kosten",
  "5250": "Algemene kosten",
  "5300": "Algemene kosten",
  "5400": "Algemene kosten",
  "6000": "Algemene kosten",
  "6200": "Algemene kosten",
  "9898": "Algemene kosten",
  "4570": "Algemene kosten",
  "4480": "Algemene kosten", //AFAS
  
  // Leasekosten auto's
  "4400": "Leasekosten auto's",
  "4420": "Leasekosten auto's",
  "4430": "Leasekosten auto's",
  "4440": "Leasekosten auto's",
  
  // Marketingkosten
  "4590": "Marketingkosten",
  "4620": "Marketingkosten",
  
  // Afschrijvingskosten
  "4720": "Afschrijvingskosten",
  "4700": "Afschrijvingskosten",
  "4740": "Afschrijvingskosten",
  "4750": "Afschrijvingskosten",
  "4710": "Afschrijvingskosten",
  "4730": "Afschrijvingskosten",
  
  // Financieringskosten
  "4910": "Financieringskosten",
  "4920": "Financieringskosten",
  "9300": "Financieringskosten",
  "9350": "Financieringskosten",
  
  // Inkoopwaarde omzet
  "7050": "Inkoopwaarde omzet",
  "4085": "Inkoopwaarde omzet",
  "4090": "Inkoopwaarde omzet",
  "5000": "Inkoopwaarde omzet",
  "5010": "Inkoopwaarde omzet",
  "5100": "Inkoopwaarde omzet",
  "5200": "Inkoopwaarde omzet",
  "7000": "Inkoopwaarde omzet",
  "7001": "Inkoopwaarde omzet",
  "7100": "Inkoopwaarde omzet",
  "7200": "Inkoopwaarde omzet",
  "7400": "Inkoopwaarde omzet",
  "7500": "Inkoopwaarde omzet",
  

  // Inkoopwaarde omzet AFAS
  "3120": "Inkoopwaarde omzet",
  "3110": "Inkoopwaarde omzet",
  "3100": "Inkoopwaarde omzet",
  "3050": "Inkoopwaarde omzet",
  "3040": "Inkoopwaarde omzet",
  "3030": "Inkoopwaarde omzet",
  "3020": "Inkoopwaarde omzet",
  "3080": "Inkoopwaarde omzet",

  

  // Provisies
  "7080": "Provisies",
  
  // Omzet AFAS
  "8090": "Omzet",
  "8095": "Omzet", 
  "8084": "Omzet",
  "8082": "Omzet",
  "8091": "Omzet", 
  "8092": "Omzet", 
  "8083": "Omzet", 
  "8080": "Omzet", 
  "8060": "Omzet", 


  // Omzet
  "8010": "Omzet",
  "8020": "Omzet",
  "8030": "Omzet",
  "8040": "Omzet",
  "8500": "Omzet",
  "8050": "Omzet",
  "8100": "Omzet",
  "8150": "Omzet",
  "8170": "Omzet",
  "8300": "Omzet",
  "8400": "Omzet",
  "8800": "Omzet",
  "8900": "Omzet",
  "9000": "Omzet",
  "9101": "Omzet",
  "9170": "Omzet",
  "9202": "Omzet",
  "9205": "Omzet",
  "9900": "Omzet",
  
  // Balans accounts
  "0100": "Materiële vaste activa",
  "0120": "Materiële vaste activa",
  "0110": "Materiële vaste activa",
  "0130": "Materiële vaste activa",
  "0200": "Materiële vaste activa",
  "0220": "Materiële vaste activa",
  "0210": "Materiële vaste activa",
  "0230": "Materiële vaste activa",
  "0140": "Overlopende activa",
  "0240": "Overlopende activa",
  "0150": "Immateriële vaste activa",
  "0250": "Immateriële vaste activa",
  "0500": "Eigen vermogen",
  "0600": "Eigen vermogen",
  "0610": "Eigen vermogen",
  "0650": "Eigen vermogen",
  "0300": "Eigen vermogen",
  "0310": "Eigen vermogen",
  "1100": "Liquide middelen",
  "1000": "Liquide middelen",
  "1150": "Liquide middelen",
  "1160": "Liquide middelen", //AFAS
  "1250": "Liquide middelen",
  "1310": "Overlopende activa",
  "1311": "Overlopende activa",
  "1330": "Overlopende activa",
  "1340": "Overlopende activa",
  "1350": "Overlopende activa",
  "1415": "Overlopende activa",
  "1900": "Overlopende activa",
  "3600": "Overlopende activa", //AFAS
  "2020": "Overlopende activa",
  "3000": "Overlopende activa",
  "3200": "Overlopende activa",
  "3210": "Overlopende activa",
  "3250": "Overlopende activa",
  "3300": "Overlopende activa",
  "3400": "Overlopende activa",
  "3500": "Overlopende activa",
  "3550": "Overlopende activa",
  "1400": "Debiteur",
  "1405": "Debiteur",
  "1500": "Belastingen/premies",
  "1510": "Belastingen/premies",
  "1520": "Belastingen/premies",
  "1570": "Belastingen/premies",
  "1700": "Belastingen/premies",
  "1825": "Belastingen/premies",
  "1830": "Belastingen/premies",
  "1835": "Belastingen/premies",
  "1840": "Belastingen/premies",
  "1950": "Belastingen/premies",
  "1600": "Crediteur",
  "1601": "Crediteur",
  "1615": "Crediteur",
  "1670": "Rekening courant directie",
  "1671": "Rekening courant directie",
  "1450": "Rekening courant directie",
  "1651": "Rekening courant directie",
  "1652": "Rekening courant directie",
  "1653": "Rekening courant directie",
  "1654": "Rekening courant directie",
  "1655": "Rekening courant directie",
  "1656": "Rekening courant directie",
  "1657": "Rekening courant directie",
  "1658": "Rekening courant directie",
  "1659": "Rekening courant directie",
  "1660": "Rekening courant directie",
  
  // Overlopende passiva
  "0700": "Overlopende passiva",
  "0750": "Overlopende passiva",
  "0900": "Overlopende passiva",
  "1550": "Overlopende passiva",
  "1565": "Overlopende passiva",
  "1610": "Overlopende passiva",
  "1602": "Overlopende passiva",
  "1800": "Overlopende passiva",
  "1805": "Overlopende passiva",
  "1810": "Overlopende passiva",
  "1815": "Overlopende passiva",
  "1820": "Overlopende passiva",
  "1821": "Overlopende passiva",
  "1845": "Overlopende passiva",
  "1850": "Overlopende passiva",
  "1853": "Overlopende passiva",
  "1855": "Overlopende passiva",
  "1860": "Overlopende passiva",
  "1901": "Overlopende passiva",
  "1995": "Overlopende passiva",
  "2000": "Overlopende passiva",
  "2010": "Overlopende passiva",
  "2011": "Overlopende passiva",
  "2015": "Overlopende passiva",
  "2035": "Overlopende passiva",
  "2045": "Overlopende passiva",
  "2055": "Overlopende passiva",
  "2060": "Overlopende passiva",
  "2065": "Overlopende passiva",
  "2070": "Overlopende passiva",
  "2075": "Overlopende passiva",
  "2080": "Overlopende passiva",
  "2100": "Overlopende passiva",
  "2150": "Overlopende passiva",
  "2200": "Overlopende passiva",
  "2600": "Overlopende passiva",
  "2700": "Overlopende passiva",
  "2710": "Overlopende passiva",
  "2900": "Overlopende passiva"
};

// Functie om categorie te bepalen op basis van rekeningnummer en kenmerk
function getCategoryForAccount(accountNumber, kenmerkRekening) {
  // Als kenmerk_rekening is "Crediteur" of "Debiteur", gebruik die waarde als categorie
  if (kenmerkRekening === "Crediteur") {
    return "Crediteur";
  }
  if (kenmerkRekening === "Debiteur") {
    return "Debiteur";
  }
  
  // Alleen als kenmerk_rekening is "Grootboekrekening", gebruik de account mapping
  if (kenmerkRekening === "Grootboekrekening") {
    const account = accountNumber ? accountNumber.toString() : '';
    return accountCategoryMapping[account] || 'Overige';
  }
  
  // Voor alle andere gevallen, return het kenmerk zelf of 'Overige'
  return kenmerkRekening || 'Overige';
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get year and month parameters directly
    const startYear = parseInt(searchParams.get('startYear'));
    const startMonth = parseInt(searchParams.get('startMonth'));
    const endYear = parseInt(searchParams.get('endYear'));
    const endMonth = parseInt(searchParams.get('endMonth'));
    
    // Default to current month if no parameters provided
    const now = new Date();
    const defaultYear = now.getFullYear();
    const defaultMonth = now.getMonth() + 1;
    
    const finalStartYear = startYear || defaultYear;
    const finalStartMonth = startMonth || defaultMonth;
    const finalEndYear = endYear || defaultYear;
    const finalEndMonth = endMonth || defaultMonth;
    
    console.log(`Fetching data for ${finalStartYear}-${finalStartMonth} to ${finalEndYear}-${finalEndMonth}`);
    
    let allData = [];
    
    // Generate all year-month combinations in the range
    const yearMonthCombos = [];
    let currentYear = finalStartYear;
    let currentMonth = finalStartMonth;
    
    while (currentYear < finalEndYear || (currentYear === finalEndYear && currentMonth <= finalEndMonth)) {
      yearMonthCombos.push({ year: currentYear, month: currentMonth });
      
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    console.log(`Fetching ${yearMonthCombos.length} year-month combinations:`, yearMonthCombos);
    
    // Fetch data for each year-month combination
    for (const combo of yearMonthCombos) {
      let skip = 0;
      const take = 50;
      let hasMoreData = true;
      
      while (hasMoreData) {
        // Build AFAS filter URL for specific year and month
        const filterfieldids = encodeURIComponent('Jaar,Periode');
        const filtervalues = encodeURIComponent(`${combo.year},${combo.month}`);
        const operatortypes = encodeURIComponent('1,1'); // Both equals
        
        const afasUrl = `https://96778.resttest.afas.online/ProfitRestServices/connectors/Innoworks_Financiele_mutaties?filterfieldids=${filterfieldids}&filtervalues=${filtervalues}&operatortypes=${operatortypes}&skip=${skip}&take=${take}&orderbyfieldids=-Boekstukdatum`;
        
        console.log(`Fetching ${combo.year}-${combo.month}: skip=${skip}, take=${take}`);
        
        const response = await fetch(afasUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-language': 'nl-nl',
            'Authorization': 'AfasToken PHRva2VuPjx2ZXJzaW9uPjE8L3ZlcnNpb24+PGRhdGE+RTI4OUU4M0NGQTNGNDhDNjkyQzQzNTJGNjYxMDE3QzlFQkI1MDk0M0RDOTk0MTkwOTU1RUREQTg4NjJDQjM4OTwvZGF0YT48L3Rva2VuPg=='
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch ${combo.year}-${combo.month}: ${response.status} ${response.statusText}`);
          // Continue with next combination instead of failing completely
          break;
        }

        const batchData = await response.json();
        
        if (!batchData.rows || batchData.rows.length === 0) {
          hasMoreData = false;
          break;
        }
        
        // Debug logging to see what we're actually getting
        console.log(`Received ${batchData.rows.length} records for ${combo.year}-${combo.month}`);
        if (batchData.rows.length > 0) {
          const sampleRecord = batchData.rows[0];
          console.log(`Sample record: Jaar=${sampleRecord.Jaar}, Periode=${sampleRecord.Periode}, Boekstukdatum=${sampleRecord.Boekstukdatum}`);
        }
        
        allData = allData.concat(batchData.rows);
        
        // If we got less than the requested amount, we've reached the end for this month
        if (batchData.rows.length < take) {
          hasMoreData = false;
        } else {
          skip += take;
        }
        
        // Safety check to prevent infinite loops
        if (skip > 10000) {
          console.log(`Safety break for ${combo.year}-${combo.month}: too many records`);
          hasMoreData = false;
        }
      }
    }
    
    // Add category to each record and group data by month and year
    const groupedData = {};
    const categoryTotals = {};
    
    allData.forEach(row => {
      // Add category to each record using account number mapping and kenmerk
      const category = getCategoryForAccount(row.Rekeningnummer, row.Kenmerk_rekening);
      row.Categorie = category;
      
      // Group by month and year using AFAS Jaar and Periode fields
      const year = row.Jaar;
      const month = row.Periode;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      
      if (!groupedData[monthKey]) {
        // Create a proper date for display purposes
        const displayDate = new Date(year, month - 1, 1);
        groupedData[monthKey] = {
          year: year,
          month: month,
          monthName: displayDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }),
          records: [],
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          categorieBreakdown: {}
        };
      }
      
      // Add to monthly totals
      groupedData[monthKey].records.push(row);
      groupedData[monthKey].totalDebet += row.Bedrag_debet || 0;
      groupedData[monthKey].totalCredit += row.Bedrag_credit || 0;
      groupedData[monthKey].netAmount = groupedData[monthKey].totalCredit - groupedData[monthKey].totalDebet;
      
      // Add to category breakdown for this month
      if (!groupedData[monthKey].categorieBreakdown[category]) {
        groupedData[monthKey].categorieBreakdown[category] = {
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          recordCount: 0
        };
      }
      groupedData[monthKey].categorieBreakdown[category].totalDebet += row.Bedrag_debet || 0;
      groupedData[monthKey].categorieBreakdown[category].totalCredit += row.Bedrag_credit || 0;
      groupedData[monthKey].categorieBreakdown[category].netAmount = 
        groupedData[monthKey].categorieBreakdown[category].totalCredit - 
        groupedData[monthKey].categorieBreakdown[category].totalDebet;
      groupedData[monthKey].categorieBreakdown[category].recordCount++;
      
      // Add to overall category totals
      if (!categoryTotals[category]) {
        categoryTotals[category] = {
          totalDebet: 0,
          totalCredit: 0,
          netAmount: 0,
          recordCount: 0
        };
      }
      categoryTotals[category].totalDebet += row.Bedrag_debet || 0;
      categoryTotals[category].totalCredit += row.Bedrag_credit || 0;
      categoryTotals[category].netAmount = categoryTotals[category].totalCredit - categoryTotals[category].totalDebet;
      categoryTotals[category].recordCount++;
    });
    
    // Convert to array and sort by date (newest first)
    const monthlyData = Object.values(groupedData).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    
    // Create date range for display (first day of start month to last day of end month)
    const startDate = new Date(finalStartYear, finalStartMonth - 1, 1);
    const endDate = new Date(finalEndYear, finalEndMonth, 0, 23, 59, 59);
    
    const result = {
      summary: {
        totalRecords: allData.length,
        monthsIncluded: monthlyData.length,
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          startYear: finalStartYear,
          startMonth: finalStartMonth,
          endYear: finalEndYear,
          endMonth: finalEndMonth
        },
        yearMonthCombos: yearMonthCombos,
        totalDebet: allData.reduce((sum, row) => sum + (row.Bedrag_debet || 0), 0),
        totalCredit: allData.reduce((sum, row) => sum + (row.Bedrag_credit || 0), 0),
        netAmount: allData.reduce((sum, row) => sum + (row.Bedrag_credit || 0), 0) - allData.reduce((sum, row) => sum + (row.Bedrag_debet || 0), 0)
      },
      categoryTotals: categoryTotals,
      monthlyData: monthlyData,
      allRecords: allData
    };
    
    console.log(`Successfully fetched ${allData.length} records across ${monthlyData.length} months`);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 