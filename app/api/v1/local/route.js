import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    
    console.log(`Fetching local data for ${finalStartYear}-${finalStartMonth} to ${finalEndYear}-${finalEndMonth}`);
    
    // Read the JSON file from public folder
    const filePath = path.join(process.cwd(), 'public', 'csvjson.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(fileContent);
    
    // Filter data based on date range and add category from MARAP field
    const filteredData = jsonData.filter(row => {
      const year = row.Jaar;
      const month = row.Periode;
      
      // Check if the record falls within the requested date range
      if (year < finalStartYear || year > finalEndYear) return false;
      if (year === finalStartYear && month < finalStartMonth) return false;
      if (year === finalEndYear && month > finalEndMonth) return false;
      
      return true;
    }).map(row => {
      // Add category from MARAP field
      row.Categorie = row.MARAP || 'Overige';
      
      // Convert string amounts to numbers
      const debet = parseFloat(row.Debet?.replace('.', '').replace(',', '.')) || 0;
      const credit = parseFloat(row.Credit?.replace('.', '').replace(',', '.')) || 0;
      
      row.Bedrag_debet = debet;
      row.Bedrag_credit = credit;
      
      // Use consistent field names
      row.Boekstukdatum = row["Boekstukdatum"] || row["Datum boeking"];
      row.Omschrijving_boeking = row["Omschrijving boeking"];
      row.Boekstuknummer = row.Boekstuknr;
      row.Rekeningnummer = row["Grootboekrekeningnr."];
      row.Omschrijving_2 = row["Grootboekrekeningoms."];
      row.Kenmerk_rekening = row["Kenmerk rekening"];
      
      return row;
    });
    
    // Group data by month and year
    const groupedData = {};
    const categoryTotals = {};
    
    filteredData.forEach(row => {
      const year = row.Jaar;
      const month = row.Periode;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const category = row.Categorie;
      
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
        totalRecords: filteredData.length,
        monthsIncluded: monthlyData.length,
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          startYear: finalStartYear,
          startMonth: finalStartMonth,
          endYear: finalEndYear,
          endMonth: finalEndMonth
        },
        totalDebet: filteredData.reduce((sum, row) => sum + (row.Bedrag_debet || 0), 0),
        totalCredit: filteredData.reduce((sum, row) => sum + (row.Bedrag_credit || 0), 0),
        netAmount: filteredData.reduce((sum, row) => sum + (row.Bedrag_credit || 0), 0) - filteredData.reduce((sum, row) => sum + (row.Bedrag_debet || 0), 0),
        dataSource: 'Lokaal JSON bestand'
      },
      categoryTotals: categoryTotals,
      monthlyData: monthlyData,
      allRecords: filteredData
    };
    
    console.log(`Successfully loaded ${filteredData.length} records from local JSON across ${monthlyData.length} months`);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Local API Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error.message 
      }, 
      { 
        status: 500
      }
    );
  }
} 