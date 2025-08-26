# AI Tools Documentation

Dit document beschrijft alle beschikbare functies die de AI kan gebruiken voor financiële analyses en rapportages.

## Financiële Statements

### 1. get_profit_loss_statement
- **Doel**: Genereren van een winst- en verliesrekening
- **Parameters**:
  - `period_from`: Begin periode (YYYY-MM)
  - `period_to`: Eind periode (YYYY-MM)
  - `granularity`: Detailniveau ('month', 'quarter', 'YTD')
  - `filters`: Optionele filters voor specifieke selecties
- **Output**: Omzet, kosten en resultaat per periode

### 2. get_balance_sheet
- **Doel**: Genereren van een balans
- **Parameters**:
  - `as_of_period`: Peildatum (YYYY-MM)
  - `side`: Welke kant van de balans ('assets', 'liabilities', 'equity', 'both')
- **Output**: Activa, passiva en eigen vermogen posities

### 3. get_cash_flow_statement
- **Doel**: Genereren van een kasstroomoverzicht
- **Parameters**:
  - `period_from`: Begin periode
  - `period_to`: Eind periode
  - `method`: Methode ('indirect')
- **Output**: Operationele, investerings- en financieringskasstromen

## Analyses

### 4. list_journal_entries
- **Doel**: Opvragen van grootboekboekingen
- **Parameters**:
  - `filters`: Selectiecriteria
  - `limit`: Maximum aantal resultaten
  - `offset`: Startpunt voor paginering
- **Output**: Lijst van boekingen met details

### 5. aggregate_by
- **Doel**: Aggregeren van data op verschillende dimensies
- **Parameters**:
  - `dimension`: Aggregatieniveau ('rekening', 'post', 'kostenplaats', 'project', 'debiteur', 'crediteur')
  - `period_from`: Begin periode
  - `period_to`: Eind periode
  - `top_n`: Aantal top resultaten
  - `filters`: Selectiecriteria
- **Output**: Geaggregeerde totalen per dimensie

### 6. variance_report
- **Doel**: Vergelijking tussen periodes
- **Parameters**:
  - `scope`: Bereik ('P&L', 'Balance', 'CashFlow')
  - `a_from`, `a_to`: Eerste periode
  - `b_from`, `b_to`: Tweede periode
  - `basis`: Vergelijkingsbasis ('abs', 'pct')
  - `dimension`: Detailniveau
- **Output**: Verschillenanalyse tussen periodes

### 7. top_deviations
- **Doel**: Identificeren van grootste afwijkingen
- **Parameters**:
  - `scope`: Bereik
  - `period_from`, `period_to`: Periode
  - `compare_to`: Vergelijkingsbasis ('prev_period', 'same_period_last_year')
  - `n`: Aantal resultaten
  - `direction`: Richting ('increases', 'decreases', 'both')
- **Output**: Lijst van grootste afwijkingen

## Specifieke Analyses

### 8. explain_account_change
- **Doel**: Detailanalyse van veranderingen in een rekening
- **Parameters**:
  - `account_or_post`: Rekening of post
  - `a_period`, `b_period`: Vergelijkingsperiodes
  - `breakdown`: Detailniveau
- **Output**: Verklaring van veranderingen

### 9. anomaly_scan
- **Doel**: Detecteren van ongewone patronen
- **Parameters**:
  - `period_from`, `period_to`: Periode
  - `zscore`: Statistische drempelwaarde
  - `min_amount`: Minimum bedrag
  - `by`: Analyseniveau ('post', 'rekening')
- **Output**: Lijst van gedetecteerde anomalieën

### 10. reconcile_pl_to_balance
- **Doel**: Aansluiting W&V met balans
- **Parameters**:
  - `period_from`, `period_to`: Periode
- **Output**: Verschillen en verklaringen

## Ratio's en Trends

### 11. Ratio Functies
- `ratio_current`: Current ratio
- `ratio_quick`: Quick ratio
- `ratio_debt_to_equity`: Solvabiliteit
- `ratio_gross_margin`: Bruto marge

### 12. trend
- **Doel**: Trendanalyse over tijd
- **Parameters**:
  - `series`: Type serie
  - `kpi`: Te analyseren metric
  - `period_from`, `period_to`: Periode
  - `window`: Analyse window
- **Output**: Trenddata met gemiddelden en standaarddeviaties

## Specifieke Rapportages

### 13. aging_report
- **Doel**: Ouderdomsanalyse debiteuren/crediteuren
- **Parameters**:
  - `entity`: Type ('debiteuren', 'crediteuren')
  - `as_of_period`: Peildatum
  - `buckets`: Ouderdomscategorieën
  - `detail`: Detail niveau
- **Output**: Ouderdomsanalyse met buckets

### 14. journal_template
- **Doel**: Genereren van boekingssjablonen
- **Parameters**:
  - `template`: Type ('depreciation', 'ifrs16_initial', 'ifrs16_monthly')
  - `params`: Template-specifieke parameters
- **Output**: Voorgestelde boekingen met toelichting

## Algemene Kenmerken

- Alle functies retourneren een `query_hash` voor audit trail
- Veel functies ondersteunen filters voor specifieke selecties
- Resultaten bevatten vaak `source_refs` voor verificatie
- Periodes worden consistent gespecificeerd als 'YYYY-MM'
- Bedragen worden consistent weergegeven (debet/credit)
