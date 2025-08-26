# Gemini Chat Integratie

## Overzicht

De financial controller agent ondersteunt nu zowel OpenAI GPT-4 als Google Gemini voor AI-gestuurde financiële analyses. Beide chatbots hebben toegang tot dezelfde 14 financiële tools.

## Beschikbare Financiële Tools

### 1. **Basis Rapportages**

#### `get_profit_loss_statement`
- **Doel**: Genereren van een winst- en verliesrekening
- **Parameters**:
  - `period_from`: Begin periode (YYYY-MM)
  - `period_to`: Eind periode (YYYY-MM)  
  - `granularity`: Detailniveau ('month', 'quarter', 'YTD')
  - `filters`: Optionele filters voor specifieke selecties
- **Output**: Omzet, kosten en resultaat per periode

#### `get_balance_sheet`
- **Doel**: Genereren van een balans
- **Parameters**:
  - `as_of_period`: Peildatum (YYYY-MM)
  - `side`: Welke kant van de balans ('assets', 'liabilities', 'equity', 'both')
- **Output**: Activa, passiva en eigen vermogen posities

#### `get_cash_flow_statement`
- **Doel**: Genereren van een kasstroomoverzicht
- **Parameters**:
  - `period_from`: Begin periode
  - `period_to`: Eind periode
  - `method`: Methode ('indirect')
- **Output**: Operationele, investerings- en financieringskasstromen

### 2. **Analyses**

#### `list_journal_entries`
- **Doel**: Opvragen van grootboekboekingen
- **Parameters**:
  - `filters`: Selectiecriteria
  - `limit`: Maximum aantal resultaten
  - `offset`: Startpunt voor paginering
- **Output**: Lijst van boekingen met details

#### `aggregate_by`
- **Doel**: Aggregeren van data op verschillende dimensies
- **Parameters**:
  - `dimension`: Aggregatieniveau ('rekening', 'post', 'kostenplaats', 'project', 'debiteur', 'crediteur')
  - `period_from`: Begin periode
  - `period_to`: Eind periode
  - `top_n`: Aantal top resultaten
  - `filters`: Selectiecriteria
- **Output**: Geaggregeerde totalen per dimensie

#### `variance_report`
- **Doel**: Vergelijking tussen periodes
- **Parameters**:
  - `scope`: Bereik ('P&L', 'Balance', 'CashFlow')
  - `a_from`, `a_to`: Eerste periode
  - `b_from`, `b_to`: Tweede periode
  - `basis`: Vergelijkingsbasis ('abs', 'pct')
  - `dimension`: Detailniveau
- **Output**: Verschillenanalyse tussen periodes

#### `top_deviations`
- **Doel**: Identificeren van grootste afwijkingen
- **Parameters**:
  - `scope`: Bereik
  - `period_from`, `period_to`: Periode
  - `compare_to`: Vergelijkingsbasis ('prev_period', 'same_period_last_year')
  - `n`: Aantal resultaten
  - `direction`: Richting ('increases', 'decreases', 'both')
- **Output**: Lijst van grootste afwijkingen

### 3. **Specifieke Analyses**

#### `explain_account_change`
- **Doel**: Detailanalyse van veranderingen in een rekening
- **Parameters**:
  - `account_or_post`: Rekening of post
  - `a_period`, `b_period`: Vergelijkingsperiodes
  - `breakdown`: Detailniveau
- **Output**: Verklaring van veranderingen

#### `anomaly_scan`
- **Doel**: Detecteren van ongewone patronen
- **Parameters**:
  - `period_from`, `period_to`: Periode
  - `zscore`: Statistische drempelwaarde
  - `min_amount`: Minimum bedrag
  - `by`: Analyseniveau ('post', 'rekening')
- **Output**: Lijst van gedetecteerde anomalieën

#### `reconcile_pl_to_balance`
- **Doel**: Aansluiting W&V met balans
- **Parameters**:
  - `period_from`, `period_to`: Periode
- **Output**: Verschillen en verklaringen

### 4. **Ratio's en KPIs**

#### Ratio Functies
- `ratio_current`: Current ratio
- `ratio_quick`: Quick ratio  
- `ratio_debt_to_equity`: Solvabiliteit
- `ratio_gross_margin`: Bruto marge

#### `trend`
- **Doel**: Trendanalyse over tijd
- **Parameters**:
  - `series`: Type serie
  - `kpi`: Te analyseren metric
  - `period_from`, `period_to`: Periode
  - `window`: Analyse window
- **Output**: Trenddata met gemiddelden en standaarddeviaties

### 5. **Specifieke Rapportages**

#### `aging_report`
- **Doel**: Ouderdomsanalyse debiteuren/crediteuren
- **Parameters**:
  - `entity`: Type ('debiteuren', 'crediteuren')
  - `as_of_period`: Peildatum
  - `buckets`: Ouderdomscategorieën
  - `detail`: Detail niveau
- **Output**: Ouderdomsanalyse met buckets

#### `journal_template`
- **Doel**: Genereren van boekingssjablonen
- **Parameters**:
  - `template`: Type ('depreciation', 'ifrs16_initial', 'ifrs16_monthly')
  - `params`: Template-specifieke parameters
- **Output**: Voorgestelde boekingen met toelichting

## Implementatie Details

### API Endpoints
- **OpenAI Chat**: `/api/v2/chat` (bestaand)
- **Gemini Chat**: `/api/v2/chat-gemini` (nieuw)

### Environment Variables
Zorg dat deze variabelen ingesteld zijn:
```
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_api_key
```

### Tool Schema Conversie
De tools zijn gedefinieerd in OpenAI formaat en worden automatisch geconverteerd naar Gemini formaat via de `getToolsForGemini()` functie.

### Chat Interface
In de demo interface zie je nu beide chatbots naast elkaar:
- Links: OpenAI GPT-4 
- Rechts: Google Gemini

## Voorbeeldvragen

### Basis Rapportages
- "Toon me de P&L voor 2024 YTD"
- "Wat is de balans per december 2024?"
- "Genereer een kasstroomoverzicht voor Q4"

### Analyses
- "Wat zijn de top 5 afwijkingen deze maand?"
- "Verklaar de verandering in kosten t.o.v. vorige maand"
- "Scan op anomalieën in oktober 2024"

### Ratio's en Trends
- "Wat is de current ratio?"
- "Toon me de trend van de brutomarge over het jaar"
- "Bereken alle liquiditeitsratio's"

### Specifieke Analyses
- "Toon aging report voor debiteuren"
- "Maak een depreciation template voor nieuwe apparatuur"
- "Controleer aansluiting P&L naar balans"

## Technische Architectuur

```
User Input
    ↓
Chat Interface (React)
    ↓
API Route (/api/v2/chat-gemini)
    ↓
Google Gemini AI + Function Calling
    ↓
Financial Tools (lib/finance/tools.js)
    ↓
AFAS Data API (/api/v2/financial)
    ↓
Response to User
```

De implementatie zorgt voor:
- Automatische tool detection en uitvoering
- Error handling en fallbacks
- Audit trails via source_refs en query_hash
- Consistente output tussen beide AI providers
