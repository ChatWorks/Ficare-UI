# AI Chat Functies Overzicht

Dit document bevat een complete lijst van alle functies die de AI chat kan aanroepen voor financiële analyses en rapportages.

## AI Model & Implementatie

- **AI Model**: Google Gemini 2.5 Flash
- **Interface**: AI Chat (powered by Function Calling)
- **Totaal aantal functies**: 17 beschikbare tools
- **Data bron**: AFAS ERP systeem via `/api/v2/financial` endpoint

## Beschikbare Functies

### 1. Basis Rapportages (3 functies)

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
  - `period_from`: Begin periode (YYYY-MM)
  - `period_to`: Eind periode (YYYY-MM)
  - `method`: Methode ('indirect')
- **Output**: Operationele, investerings- en financieringskasstromen

### 2. Data Analyses (7 functies)

#### `list_journal_entries`
- **Doel**: Opvragen van grootboekboekingen
- **Parameters**:
  - `filters`: Selectiecriteria (periode, rekening, tekst, bedrag, etc.)
  - `limit`: Maximum aantal resultaten
  - `offset`: Startpunt voor paginering
- **Output**: Lijst van boekingen met details

#### `aggregate_by`
- **Doel**: Aggregeren van data op verschillende dimensies
- **Parameters**:
  - `dimension`: Aggregatieniveau ('rekening', 'post', 'kostenplaats', 'project', 'debiteur', 'crediteur')
  - `period_from`: Begin periode (YYYY-MM)
  - `period_to`: Eind periode (YYYY-MM)
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
  - `dimension`: Detailniveau ('post', 'rekening', 'kostenplaats', 'project')
- **Output**: Verschillenanalyse tussen periodes

#### `top_deviations`
- **Doel**: Identificeren van grootste afwijkingen
- **Parameters**:
  - `scope`: Bereik ('P&L', 'Balance', 'CashFlow')
  - `period_from`, `period_to`: Periode
  - `compare_to`: Vergelijkingsbasis ('prev_period', 'same_period_last_year', 'budget')
  - `n`: Aantal resultaten
  - `direction`: Richting ('increases', 'decreases', 'both')
  - `dimension`: Analyseniveau ('post', 'rekening')
- **Output**: Lijst van grootste afwijkingen

#### `explain_account_change`
- **Doel**: Detailanalyse van veranderingen in een rekening
- **Parameters**:
  - `account_or_post`: Rekening of post
  - `a_period`, `b_period`: Vergelijkingsperiodes
  - `breakdown`: Detailniveau ('rekening', 'kostenplaats', 'project', 'boekstuk')
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

### 3. Ratio's en KPI's (5 functies)

#### `ratio_current`
- **Doel**: Berekenen van current ratio (vlottende activa / kortlopende schulden)
- **Parameters**:
  - `as_of_period`: Peildatum (YYYY-MM)
- **Output**: Current ratio waarde met berekening

#### `ratio_quick`
- **Doel**: Berekenen van quick ratio (liquid ratio)
- **Parameters**:
  - `as_of_period`: Peildatum (YYYY-MM)
- **Output**: Quick ratio waarde met berekening

#### `ratio_debt_to_equity`
- **Doel**: Berekenen van debt-to-equity ratio (solvabiliteit)
- **Parameters**:
  - `as_of_period`: Peildatum (YYYY-MM)
- **Output**: Solvabiliteitsratio met berekening

#### `ratio_gross_margin`
- **Doel**: Berekenen van bruto winstmarge
- **Parameters**:
  - `period_from`: Begin periode (YYYY-MM)
  - `period_to`: Eind periode (YYYY-MM)
- **Output**: Bruto marge percentage met berekening

#### `trend`
- **Doel**: Trendanalyse over tijd
- **Parameters**:
  - `series`: Type serie
  - `kpi`: Te analyseren metric
  - `period_from`, `period_to`: Periode
  - `window`: Analyse window
- **Output**: Trenddata met gemiddelden en standaarddeviaties

### 4. Specifieke Rapportages (2 functies)

#### `aging_report`
- **Doel**: Ouderdomsanalyse debiteuren/crediteuren
- **Parameters**:
  - `entity`: Type ('debiteuren', 'crediteuren')
  - `as_of_period`: Peildatum (YYYY-MM)
  - `buckets`: Ouderdomscategorieën (bijv. ['0-30', '31-60', '61-90', '>90'])
  - `detail`: Detail niveau (boolean)
- **Output**: Ouderdomsanalyse met buckets

#### `journal_template`
- **Doel**: Genereren van boekingssjablonen
- **Parameters**:
  - `template`: Type ('depreciation', 'ifrs16_initial', 'ifrs16_monthly')
  - `params`: Template-specifieke parameters
- **Output**: Voorgestelde boekingen met toelichting

## Aanvullende Functies (Niet in standaard tools.js)

### Enhanced Data Handlers (3 functies)

Deze functies zijn geïmplementeerd in de AI Chat API route voor specifieke data verwerking:

#### `handleEnhancedPnLData`
- **Doel**: Verwerken van enhanced P&L data met category mappings
- **Parameters**: 
  - `months`: Array van maanden
  - `categories`: Array van categorieën
- **Output**: Enhanced P&L data met mapped categorieën

#### `handleBalanceSheetData`
- **Doel**: Verwerken van balans data voor specifieke presentatie
- **Parameters**: Balans specifieke argumenten
- **Output**: Geformatteerde balans data

#### `handleCashFlowData`
- **Doel**: Verwerken van kasstroom data met enhanced berekeningen
- **Parameters**: 
  - `months`: Array van maanden
- **Output**: Enhanced kasstroom data

## Algemene Kenmerken

### Audit Trail
- Alle functies retourneren een `query_hash` voor audit trail
- `source_refs` worden bijgehouden voor verificatie
- Resultaten bevatten metadata over berekeningen

### Data Consistentie
- Periodes worden consistent gespecificeerd als 'YYYY-MM'
- Bedragen worden consistent weergegeven (debet/credit)
- Veel functies ondersteunen filters voor specifieke selecties

### Performance Optimalisatie
- Smart loading: AI-ready cache data waar mogelijk
- Parallel function execution
- Data size monitoring en logging
- Beperking van jaar ranges (max 3 jaar) om server overbelasting te voorkomen

## Function Calling Flow

1. **User Input**: Gebruiker stelt vraag in natuurlijke taal
2. **AI Analysis**: Gemini analyseert vraag en bepaalt benodigde functies
3. **Function Calls**: AI roept relevante functies aan (parallel waar mogelijk)
4. **Data Processing**: Functies verwerken AFAS data en retourneren resultaten
5. **AI Synthesis**: Gemini combineert resultaten tot coherent antwoord
6. **Response**: Gebruiker krijgt uitgebreid antwoord met concrete cijfers

## Logging en Monitoring

De AI chat logt uitgebreid:
- Function call details en uitvoeringstijd
- Data sizes van requests en responses
- Success rates van function calls
- Performance metrics per request
- Foutafhandeling en error recovery

## Beveiliging

- Input validatie op alle parameters
- Periode validatie (min/max jaar ranges)
- Rate limiting per gebruiker
- Secure API key management
- Data sanitization voor XSS preventie

