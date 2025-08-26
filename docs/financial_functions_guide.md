# Complete Gids: Financiële Functies in AI Chat

## 📋 Overzicht

De AI Chat heeft toegang tot 17 financiële functies die complete analyses mogelijk maken van AFAS data. Alle functies werken met Nederlandse financiële standaarden en retourneren auditeerbare resultaten.

## 🏗️ Basis Structuur

### **Return Format**
Alle functies retourneren een consistent formaat:
```json
{
  "rows": [],           // Data rijen
  "totals": {},         // Totalen/samenvattingen  
  "source_refs": [],    // Bronverwijzingen (boekstuknummers)
  "query_hash": "xxx"   // Audit hash voor traceerbaarheid
}
```

### **Periode Formaat**
- **periode_from/to**: `"YYYY-MM"` (bijv. `"2024-01"`)
- **as_of_period**: `"YYYY-MM"` (peildatum)

---

## 💰 1. BASIS RAPPORTAGES

### **get_profit_loss_statement**
Genereren van een winst- en verliesrekening

**Parameters:**
- `period_from` (string): Begin periode (YYYY-MM) 
- `period_to` (string): Eind periode (YYYY-MM)
- `granularity` (string): `"month"` | `"quarter"` | `"YTD"`
- `filters` (object): Optionele filters

**Output:**
```json
{
  "rows": [
    {"post": "Opbrengsten", "periode": "2024-01", "bedrag": 125000},
    {"post": "Kosten", "periode": "2024-01", "bedrag": 95000},
    {"post": "Resultaat", "periode": "2024-01", "bedrag": 30000}
  ],
  "totals": {
    "Opbrengsten": 125000,
    "Kosten": 95000, 
    "Resultaat": 30000
  }
}
```

**Voorbeelden:**
- `"Toon me de P&L voor 2024 YTD"`
- `"Wat is het maandelijkse resultaat dit jaar?"`
- `"Genereer kwartaal P&L voor Q4"`

### **get_balance_sheet**
Genereren van een balans op peildatum

**Parameters:**
- `as_of_period` (string): Peildatum (YYYY-MM)
- `side` (string): `"assets"` | `"liabilities"` | `"equity"` | `"both"`

**Output:**
```json
{
  "assets": [
    {"post": "Debiteuren", "amount": 85000},
    {"post": "Voorraad", "amount": 45000}
  ],
  "liabilities": [
    {"post": "Crediteuren", "amount": 35000},
    {"post": "BTW schuld", "amount": 15000}
  ],
  "equity": [
    {"post": "Eigen vermogen", "amount": 125000}
  ],
  "totals": {
    "activa": 175000,
    "vreemdVermogen": 50000,
    "eigenVermogen": 125000,
    "totaalPassiva": 175000
  }
}
```

**Voorbeelden:**
- `"Toon me de balans per december 2024"`
- `"Wat zijn de activa per maart?"`
- `"Alleen passiva en eigen vermogen tonen"`

### **get_cash_flow_statement**
Genereren van kasstroomoverzicht (indirecte methode)

**Parameters:**
- `period_from` (string): Begin periode
- `period_to` (string): Eind periode  
- `method` (string): `"indirect"` (vaste waarde)

**Output:**
```json
{
  "operating": {
    "result": 45000,
    "working_capital": {
      "delta_debiteuren": -5000,
      "delta_voorraad": 2000,
      "delta_crediteuren": 3000
    },
    "net": 41000
  },
  "investing": {"total": -15000},
  "financing": {"total": 8000},
  "total": 34000
}
```

**Voorbeelden:**
- `"Toon kasstroomoverzicht voor Q4"`
- `"Wat is de operationele kasstroom YTD?"`

---

## 🔍 2. DATA ANALYSES

### **list_journal_entries**
Opvragen van grootboekboekingen met filters

**Parameters:**
- `filters` (object): Selectiecriteria
  - `period_from/to`: Periode filter
  - `rekening`: Specifieke rekening
  - `dagboek`: Dagboekcode
  - `bedrag_min/max`: Bedragfilters
  - `tekst`: Tekstfilter in omschrijving
  - `boekstuknummer`: Specifiek boekstuk
  - `kostenplaats`: Kostenplaats filter
  - `project`: Project filter
- `limit` (number): Maximum resultaten (standaard 200)
- `offset` (number): Startpunt paginering

**Output:**
```json
{
  "entries": [
    {
      "Boekstuknummer": "VK240001",
      "Boekstukdatum": "2024-01-15",
      "Jaar": 2024,
      "Periode": 1,
      "Rekeningnummer": "8000",
      "Omschrijving": "Verkoop product A",
      "Categorie": "Netto-omzet",
      "Bedrag_debet": 0,
      "Bedrag_credit": 5000,
      "Dagboek": "VK"
    }
  ],
  "count": 1
}
```

**Voorbeelden:**
- `"Toon alle boekingen van rekening 8000 in januari"`
- `"Welke boekingen zijn er groter dan €1000?"`
- `"Zoek boekingen met 'huur' in de omschrijving"`

### **aggregate_by**
Aggregeren van data op verschillende dimensies

**Parameters:**
- `dimension` (string): `"rekening"` | `"post"` | `"kostenplaats"` | `"project"` | `"debiteur"` | `"crediteur"`
- `period_from` (string): Begin periode
- `period_to` (string): Eind periode
- `top_n` (number): Aantal top resultaten
- `filters` (object): Optionele filters

**Output:**
```json
{
  "rows": [
    {"key": "Netto-omzet", "amount": 125000},
    {"key": "Autokosten", "amount": -15000},
    {"key": "Huisvestingskosten", "amount": -25000}
  ],
  "top_n_applied": true
}
```

**Voorbeelden:**
- `"Aggregeer kosten per kostenplaats"`
- `"Top 10 categorieën dit jaar"`
- `"Verdeling per project voor Q4"`

### **variance_report**
Vergelijking tussen twee periodes

**Parameters:**
- `scope` (string): `"P&L"` | `"Balance"` | `"CashFlow"`
- `a_from/a_to` (string): Eerste periode
- `b_from/b_to` (string): Tweede periode  
- `basis` (string): `"abs"` | `"pct"` (absolute of percentage)
- `dimension` (string): Aggregatieniveau

**Output:**
```json
{
  "rows": [
    {
      "dimension_key": "Netto-omzet",
      "amount_a": 125000,
      "amount_b": 115000,
      "delta_abs": 10000,
      "delta_pct": 8.7
    }
  ]
}
```

**Voorbeelden:**
- `"Vergelijk november met oktober"`
- `"Wat zijn de verschillen t.o.v. vorig jaar?"`
- `"Percentage verandering per categorie"`

### **top_deviations**
Identificeren van grootste afwijkingen

**Parameters:**
- `scope` (string): Bereik van analyse
- `period_from/to` (string): Analyseperiode
- `compare_to` (string): `"prev_period"` | `"same_period_last_year"` | `"budget"`
- `n` (number): Aantal resultaten
- `direction` (string): `"increases"` | `"decreases"` | `"both"`
- `dimension` (string): Analyseniveau

**Output:**
```json
{
  "increases": [
    {"key": "Autokosten", "delta": 8500}
  ],
  "decreases": [
    {"key": "Marketingkosten", "delta": -3200}
  ]
}
```

**Voorbeelden:**
- `"Top 5 stijgingen deze maand"`
- `"Grootste dalingen t.o.v. vorig jaar"`
- `"Wat zijn de afwijkingen in kosten?"`

### **explain_account_change**
Detailanalyse van veranderingen in rekening/post

**Parameters:**
- `account_or_post` (string): Rekening of post naam
- `a_period` (string): Eerste periode
- `b_period` (string): Tweede periode
- `breakdown` (string): `"rekening"` | `"kostenplaats"` | `"project"` | `"boekstuk"`

**Output:**
```json
{
  "delta": 5000,
  "drivers": [
    {"key": "1001", "delta": 3000, "share_pct": 60},
    {"key": "1002", "delta": 2000, "share_pct": 40}
  ]
}
```

**Voorbeelden:**
- `"Verklaar de stijging in autokosten"`
- `"Waarom is omzet gedaald t.o.v. vorige maand?"`
- `"Opsplitsing per kostenplaats voor huurkosten"`

### **anomaly_scan**
Detecteren van ongewone patronen

**Parameters:**
- `period_from/to` (string): Analyseperiode
- `zscore` (number): Statistische drempelwaarde (standaard 3)
- `min_amount` (number): Minimum bedrag (standaard 1000)
- `by` (string): `"post"` | `"rekening"`

**Output:**
```json
{
  "anomalies": [
    {
      "key": "Kantoorkosten", 
      "amount": 15000,
      "zscore": 3.2
    }
  ],
  "notes": []
}
```

**Voorbeelden:**
- `"Scan op anomalieën in Q4"`
- `"Ongewone patronen in kosten"`
- `"Afwijkende bedragen boven €500"`

### **reconcile_pl_to_balance**
Aansluiting winst- en verliesrekening met balans

**Parameters:**
- `period_from/to` (string): Periode voor aansluiting

**Output:**
```json
{
  "ok": true,
  "diffs": [],
  "notes": ["Aansluiting correct binnen tolerantie"]
}
```

**Voorbeelden:**
- `"Controleer P&L aansluiting"`
- `"Klopt de resultaatverwerking?"`

---

## 📊 3. RATIO'S & KPIS

### **ratio_current**
Current ratio (vlottende activa / kortlopende schulden)

**Parameters:**
- `as_of_period` (string): Peildatum

**Output:**
```json
{
  "value": 2.1,
  "numerator": 105000,
  "denominator": 50000,
  "definition": "Vlottende Activa / Kortlopende Schulden (benadering)"
}
```

### **ratio_quick** 
Quick ratio (acid test)

**Parameters:**
- `as_of_period` (string): Peildatum

**Output:**
```json
{
  "value": 1.8,
  "numerator": 90000,
  "denominator": 50000,
  "definition": "(Vlottende Activa − Voorraad) / Kortlopende Schulden (benadering)"
}
```

### **ratio_debt_to_equity**
Debt-to-equity ratio (solvabiliteit)

**Parameters:**
- `as_of_period` (string): Peildatum

**Output:**
```json
{
  "value": 0.4,
  "numerator": 50000,
  "denominator": 125000,
  "definition": "Rentedragende schuld / Eigen Vermogen (benadering VV/EV)"
}
```

### **ratio_gross_margin**
Bruto winstmarge

**Parameters:**
- `period_from/to` (string): Periode

**Output:**
```json
{
  "value": 0.24,
  "numerator": 30000,
  "denominator": 125000,
  "definition": "(Omzet − COGS) / Omzet"
}
```

**Voorbeelden:**
- `"Wat is de current ratio per december?"`
- `"Bereken alle liquiditeitsratio's"`
- `"Hoe is de solvabiliteit ontwikkeld?"`

### **trend**
Trendanalyse van KPIs over tijd

**Parameters:**
- `series` (string): Type serie
- `kpi` (string): Te analyseren metric
  - `"current_ratio"`, `"quick_ratio"`, `"debt_to_equity"`, `"gross_margin"`
  - `"post:Categorie naam"` - specifieke post
  - `"rekening:nummer"` - specifieke rekening
- `period_from/to` (string): Analyseperiode
- `window` (number): Analyse window (standaard 12)

**Output:**
```json
{
  "points": [
    {"periode": "2024-01", "value": 2.1},
    {"periode": "2024-02", "value": 2.3}
  ],
  "avg": 2.2,
  "stdev": 0.15
}
```

**Voorbeelden:**
- `"Trendanalyse current ratio dit jaar"`
- `"Ontwikkeling autokosten per maand"`
- `"Gemiddelde en spreiding van brutomarge"`

---

## 📈 4. SPECIFIEKE RAPPORTAGES

### **aging_report**
Ouderdomsanalyse debiteuren/crediteuren

**Parameters:**
- `entity` (string): `"debiteuren"` | `"crediteuren"`
- `as_of_period` (string): Peildatum
- `buckets` (array): Ouderdomscategorieën (standaard: `["0-30", "31-60", "61-90", ">90"]`)
- `detail` (boolean): Toon detail rijen

**Output:**
```json
{
  "buckets": [
    {"range": "0-30", "amount": 45000, "count": 15},
    {"range": "31-60", "amount": 25000, "count": 8},
    {"range": "61-90", "amount": 12000, "count": 4},
    {"range": ">90", "amount": 8000, "count": 3}
  ]
}
```

**Voorbeelden:**
- `"Aging report debiteuren per december"`
- `"Ouderdom crediteuren met details"`
- `"Custom buckets: 0-45, 46-90, >90 dagen"`

### **journal_template**
Genereren van boekingssjablonen

**Parameters:**
- `template` (string): `"depreciation"` | `"ifrs16_initial"` | `"ifrs16_monthly"`
- `params` (object): Template-specifieke parameters

**Template: depreciation**
```json
{
  "params": {
    "asset_cost": 50000,
    "useful_life_months": 60,
    "start_date": "2024-01-01",
    "method": "linear",
    "contra_account": "Cumulatieve afschrijving"
  }
}
```

**Template: ifrs16_initial**
```json
{
  "params": {
    "pv_lease_payments": 120000,
    "right_of_use_account": "ROU-asset",
    "lease_liability_account": "Lease verplichting",
    "start_date": "2024-01-01"
  }
}
```

**Template: ifrs16_monthly**
```json
{
  "params": {
    "interest_rate": 0.05,
    "opening_liability": 115000,
    "payment": 2500,
    "months_elapsed": 3
  }
}
```

**Output:**
```json
{
  "entries": [
    {
      "rekening": "Afschrijvingskosten",
      "debit": 833.33,
      "credit": 0,
      "omschrijving": "Maandelijkse afschrijving"
    }
  ],
  "notes": ["Lineaire afschrijving vanaf 2024-01-01"]
}
```

**Voorbeelden:**
- `"Maak afschrijvingssjabloon voor €50k over 5 jaar"`
- `"IFRS16 initiële boeking voor lease €120k"`
- `"Maandelijkse lease boeking met 5% rente"`

---

## 🎯 PRAKTISCHE VOORBEELDEN

### **Maandelijkse Analyse**
```
"Wat is het resultaat voor november 2024?"
→ get_profit_loss_statement(2024-11, 2024-11, month)

"Vergelijk november met oktober"
→ variance_report(P&L, 2024-11, 2024-11, 2024-10, 2024-10, abs)

"Top 5 afwijkingen deze maand"
→ top_deviations(P&L, 2024-11, 2024-11, prev_period, 5, both)
```

### **Kwartaalrapportage**
```
"Q4 resultaten met kwartaalverdeling"
→ get_profit_loss_statement(2024-10, 2024-12, quarter)

"Balans per einde kwartaal"
→ get_balance_sheet(2024-12, both)

"Kasstroomoverzicht Q4"
→ get_cash_flow_statement(2024-10, 2024-12, indirect)
```

### **Jaaranalyse**
```
"P&L 2024 YTD"
→ get_profit_loss_statement(2024-01, 2024-12, YTD)

"Vergelijking met vorig jaar"
→ variance_report(P&L, 2024-01, 2024-12, 2023-01, 2023-12, pct)

"Trendanalyse liquiditeit"
→ trend(monthly, current_ratio, 2024-01, 2024-12, 12)
```

### **Ad-hoc Analyses**
```
"Waarom zijn autokosten gestegen?"
→ explain_account_change(Autokosten, 2024-10, 2024-11, kostenplaats)

"Scan op anomalieën Q4"
→ anomaly_scan(2024-10, 2024-12, 3, 1000, post)

"Aging debiteuren december"
→ aging_report(debiteuren, 2024-12, ["0-30","31-60","61-90",">90"], true)
```

---

## 🔧 TECHNISCHE DETAILS

### **Audit Trail**
Elke functie retourneert:
- `source_refs`: Array van boekstuknummers voor traceerbaarheid
- `query_hash`: SHA256 hash van functie + parameters voor audit

### **Performance**
- Caching van maandelijkse data aggregaties
- Optimized queries via bestaande v2 financial API
- Deterministische berekeningen voor consistentie

### **Error Handling**
- Graceful degradation bij ontbrekende data
- Duidelijke foutmeldingen in Nederlands
- Automatische fallbacks waar mogelijk

### **Data Sources**
- Primair: AFAS grootboekdata via `/api/v2/financial`
- Transformaties via `lib/finance/transform.js`
- Real-time data zonder caching voor audit compliance
