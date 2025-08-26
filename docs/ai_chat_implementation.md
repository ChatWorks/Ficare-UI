# AI Chat Implementation

## Overzicht

De financial controller agent heeft nu een AI Chat interface powered by **Gemini 2.0 Flash** met function calling capabilities. De AI heeft toegang tot 14 financiële tools voor complete analyse van AFAS data.

## Implementatie Details

### 🚀 AI Model
- **Model**: `gemini-2.0-flash-exp` 
- **Provider**: Google Generative AI
- **Interface**: AI Chat (geen merknaam zichtbaar)

### 🔧 Function Declarations
Alle 14 functies zijn gedefinieerd met het juiste formaat:

```javascript
const functionDeclaration = {
  name: 'function_name',
  description: 'Nederlandse beschrijving van de functie',
  parameters: {
    type: Type.OBJECT,
    properties: {
      parameter_name: { 
        type: Type.STRING, 
        description: 'Parameter beschrijving' 
      }
    },
    required: ['required_params']
  }
};
```

### 📁 Bestandsstructuur
```
app/
├── api/v2/ai-chat/route.js          # AI Chat endpoint
├── demo/v2/AIChat.jsx               # Chat interface component
└── demo/v2/page.js                  # Main demo page

lib/finance/tools.js                 # Alle 14 financiële functies
```

## 🔧 Beschikbare Tools

### 1. **Basis Rapportages**
- `get_profit_loss_statement` - Winst & verliesrekening
- `get_balance_sheet` - Balans
- `get_cash_flow_statement` - Kasstroom

### 2. **Data Analyses**
- `list_journal_entries` - Grootboekboekingen
- `aggregate_by` - Aggregatie per dimensie
- `variance_report` - Periodevergelijking
- `top_deviations` - Grootste afwijkingen
- `explain_account_change` - Rekening mutatie analyse
- `anomaly_scan` - Anomalie detectie
- `reconcile_pl_to_balance` - P&L/Balans aansluiting

### 3. **Ratio's & KPIs**
- `ratio_current` - Current ratio
- `ratio_quick` - Quick ratio  
- `ratio_debt_to_equity` - Solvabiliteit
- `ratio_gross_margin` - Bruto marge
- `trend` - Trendanalyse

### 4. **Specifieke Rapportages**
- `aging_report` - Debiteuren/crediteuren ouderdom
- `journal_template` - Boekingssjablonen

## 🎯 Voorbeeldvragen

### Basis Rapportages
```
"Toon me de P&L voor 2024 YTD met maanddetails"
"Wat is de balans per december 2024?"
"Genereer een kasstroomoverzicht voor Q4"
```

### Analyses
```
"Wat zijn de top 5 afwijkingen deze maand?"
"Verklaar de verandering in kosten t.o.v. vorige maand"
"Scan op anomalieën in de laatste 3 maanden"
"Aggregeer kosten per kostenplaats voor dit jaar"
```

### Ratio's & Trends
```
"Bereken alle liquiditeitsratio's voor december"
"Toon me de trend van de brutomarge over het jaar"
"Wat is de solvabiliteit en hoe ontwikkelt deze zich?"
```

### Specifieke Rapportages
```
"Toon aging report voor debiteuren per december"
"Maak een depreciation template voor nieuwe apparatuur (€50k, 5 jaar)"
"Controleer aansluiting P&L naar balans voor YTD"
```

## 🔐 Environment Setup

Zorg dat deze environment variable ingesteld is:
```bash
GOOGLE_API_KEY=your_google_api_key
```

## 🎨 Interface Features

- **Responsive design** met volledige breedte
- **Loading indicators** tijdens AI processing
- **Error handling** met gebruiksvriendelijke berichten
- **Persistent Message History** - Chat blijft bewaard bij tabwisseling
- **Auto-scroll** naar nieuwste berichten
- **Tool hasil tracking** voor audit purposes
- **Clickable Amounts** 💰 - Bedragen in AI antwoorden zijn klikbaar voor drill-down
- **Financial Drill-Down** - Toon onderliggende mutaties net als in W&V en balans
- **Clear Chat** functie voor nieuwe sessies
- **Message Numbering** voor betere traceerbaarheid

## 🔄 API Workflow

```
User Input → AIChat.jsx → /api/v2/ai-chat → Gemini 2.0 Flash → Function Calls → Financial Tools → AFAS Data → Response
```

## 🧪 Testing

Om te testen:
1. Start development server: `npm run dev`
2. Ga naar `/demo/v2`
3. Klik op "Chat" tab
4. Stel financiële vragen

## 💰 Clickable Amounts & Drill-Down

### **Automatische Bedrag Detectie**
De AI Chat herkent automatisch bedragen in responses en maakt ze klikbaar:

```
"Netto-omzet: €125.000" → Klikbaar bedrag dat toont onderliggende mutaties
"Autokosten: €15.500" → Drill-down naar specifieke kostenplaats
"Resultaat: €45.000" → Overzicht van alle categorieën
```

### **Intelligente Categorie Mapping**
- **Tool Results Analysis** - Extraheert categorieën uit function call resultaten
- **Context Matching** - Koppelt bedragen aan juiste categorieën
- **Fallback Mapping** - Standaard categorieën voor algemene begrippen

### **Veilige HTML Rendering**
- **Sanitization** - Veilige HTML rendering voor klikbare buttons
- **User Input Protection** - User berichten blijven plain text
- **XSS Prevention** - Script tags en gevaarlijke attributen gefilterd

### **Drill-Down Flow**
```
AI Response → Bedrag Klik → setSelectedCategory → Transactie Overzicht
```

## 🎯 Key Benefits

- **Single AI interface** - geen verwarring tussen providers
- **Consistent tool access** - alle 14 functies beschikbaar
- **Dutch language optimized** - Nederlandse beschrijvingen en responses
- **Audit trail** - source_refs en query_hash voor traceability
- **Performance** - Gemini 2.0 Flash voor snelle responses
- **Cost effective** - efficiënte token usage
- **Interactive Analysis** - Klikbare bedragen voor diepere analyse
- **Seamless Integration** - Zelfde drill-down als W&V en balans
