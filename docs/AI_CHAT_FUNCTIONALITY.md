# AI Chat Functionaliteit - Technische Documentatie

## Overzicht

De AI chat functionaliteit is een geavanceerd systeem dat Google Gemini 2.5 Flash gebruikt om financiële data te analyseren en te interpreteren. Het systeem combineert natuurlijke taalverwerking met specifieke financiële tools om accurate, contextuele antwoorden te geven.

## Architectuur

### Component Hiërarchie
```
AIChat.jsx (Frontend Component)
    ↓
/api/v2/ai-chat (API Endpoint)
    ↓
Google Gemini 2.5 Flash (AI Model)
    ↓
Financial Tools (Function Calling)
    ↓
AFAS Data (Data Source)
```

## Frontend Component (AIChat.jsx)

### State Management
```javascript
const [messages, setMessages] = useState([]);           // Chat geschiedenis
const [input, setInput] = useState('');                 // User input
const [loading, setLoading] = useState(false);          // Loading state
const [periodFrom, setPeriodFrom] = useState('');       // Periode van
const [periodTo, setPeriodTo] = useState('');           // Periode tot
```

### Message Structuur
```javascript
{
  role: 'user' | 'assistant',
  content: string,
  timestamp?: Date
}
```

### API Call Flow
```javascript
const ask = async () => {
  // 1. Input validation
  if (!input.trim() || loading) return;
  
  // 2. Prepare message
  const userInput = input.trim();
  const newMsgs = [...messages, { role: 'user', content: userInput }];
  
  // 3. Update UI state
  setMessages(newMsgs);
  setInput('');
  setLoading(true);
  
  // 4. Get current date/time context
  const currentDate = new Date().toLocaleDateString('nl-NL');
  const currentTime = new Date().toLocaleTimeString('nl-NL');
  
  // 5. API call
  const res = await fetch('/api/v2/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      messages: newMsgs, 
      period_from: periodFrom, 
      period_to: periodTo, 
      baseUrl,
      currentDate,
      currentTime
    })
  });
  
  // 6. Handle response
  const data = await res.json();
  setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
  setLoading(false);
};
```

## API Endpoint (/api/v2/ai-chat)

### Request Processing
```javascript
export async function POST(request) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  try {
    // 1. Parse request
    const { messages, period_from, period_to, baseUrl, currentDate, currentTime } = 
      await request.json();
    
    // 2. Initialize Gemini
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    
    // 3. Load financial tools
    const tools = getToolsForGemini();
    
    // 4. Process conversation
    // ... (zie hieronder voor details)
  } catch (error) {
    // Error handling
  }
}
```

### System Prompt Construction
```javascript
const systemText = `Je bent een financiële AI assistent. Gebruik ALLEEN de beschikbare tools voor berekeningen. Geef directe, concrete antwoorden zonder bronverwijzingen.

HUIDIGE CONTEXT:
- Huidige datum: ${currentDate || 'Onbekend'}
- Huidige tijd: ${currentTime || 'Onbekend'}

BELANGRIJKE FORMATTERING:
- Presenteer bedragen ALTIJD in het formaat: "Categorie: €X.XXX"
- Bijvoorbeeld: "Netto-omzet: €125.000" of "Autokosten: €15.500"
- Gebruik Nederlandse valutering (€) met punten als duizendtalscheidingsteken
- Maak duidelijke categorieën voor bedragen zodat ze klikbaar kunnen worden
- Geen bronverwijzingen of referenties - bedragen zijn al klikbaar voor details

KRITIEKE WERKWIJZE:
- ALTIJD eerst variance_report of vergelijkbare tools gebruiken om cijfers te valideren
- Als user beweert "meer in periode X dan Y" - controleer dit EERST in de data
- GELOOF de user en zoek uit waarom de verschillen bestaan
- Voor ELKE boekstuknummer: gebruik get_transaction_details met specifieke filters
- Geef concrete details: datum, type transactie, rekeningen, wat het betekent
- Gebruik bestaande AFAS data, niet opnieuw ophalen
- Zeg NOOIT "zonder verdere details" - haal altijd alle details op`;
```

### Conversation Context Building
```javascript
// Build conversation context with full message history
const conversationContext = messages.map((msg, index) => {
  const role = msg.role === 'assistant' ? 'AI' : 'User';
  return `${role}: ${msg.content}`;
}).join('\n\n');

const userMessage = messages[messages.length - 1]?.content || '';
const prompt = `${systemText}${periodHint}\n\nConversatie geschiedenis:\n${conversationContext}\n\nBeantwoord de laatste vraag van de gebruiker in de context van de hele conversatie.`;
```

## Function Calling Systeem

### Tool Definition (lib/finance/tools.js)
```javascript
export function getToolsForGemini() {
  return [
    {
      name: "variance_report",
      description: "Genereer een variance report tussen twee periodes",
      parameters: {
        type: "object",
        properties: {
          period1_from: { type: "string", description: "Start datum periode 1 (YYYY-MM-DD)" },
          period1_to: { type: "string", description: "Eind datum periode 1 (YYYY-MM-DD)" },
          period2_from: { type: "string", description: "Start datum periode 2 (YYYY-MM-DD)" },
          period2_to: { type: "string", description: "Eind datum periode 2 (YYYY-MM-DD)" },
          category: { type: "string", description: "Categorie om te vergelijken" }
        },
        required: ["period1_from", "period1_to", "period2_from", "period2_to"]
      }
    },
    {
      name: "get_transaction_details",
      description: "Haal gedetailleerde transactie informatie op",
      parameters: {
        type: "object",
        properties: {
          boekstuknummer: { type: "string", description: "Boekstuknummer" },
          datum_from: { type: "string", description: "Start datum (YYYY-MM-DD)" },
          datum_to: { type: "string", description: "Eind datum (YYYY-MM-DD)" },
          rekeningnummer: { type: "string", description: "Rekeningnummer" }
        },
        required: ["boekstuknummer"]
      }
    },
    // ... andere tools
  ];
}
```

### Tool Execution Flow
```javascript
// 1. Gemini maakt function calls
if (response.functionCalls && response.functionCalls.length > 0) {
  // 2. Execute alle function calls parallel
  const functionResults = await Promise.all(
    response.functionCalls.map(async (call, index) => {
      const callStart = Date.now();
      
      // 3. Adapt Gemini function call naar ons format
      const adapted = {
        id: call.name,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args || {})
        }
      };
      
      // 4. Execute tool
      const output = await executeToolCall(adapted);
      
      // 5. Log resultaten
      const callTime = Date.now() - callStart;
      console.log(`Tool ${call.name} completed in ${callTime}ms`);
      
      return {
        name: call.name,
        output: output
      };
    })
  );
  
  // 6. Build follow-up prompt met resultaten
  const resultsText = functionResults.map(fr => 
    `Function ${fr.name} result: ${fr.output}`
  ).join('\n\n');
  
  // 7. Continue conversation met resultaten
  response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: followUpPrompt,
    config: {
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
      }
    }
  });
}
```

## Multi-Hop Conversation Systeem

### Hop Management
```javascript
const maxHops = 6; // Maximum aantal function call rounds

for (let hop = 0; hop < maxHops; hop++) {
  console.log(`Processing hop ${hop + 1}/${maxHops}`);
  
  // Check voor function calls
  if (!response.functionCalls || response.functionCalls.length === 0) {
    // Geen meer function calls, return text response
    const answer = response.text || 'Kon geen definitief antwoord genereren.';
    return new Response(JSON.stringify({ answer, toolResults }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  // Execute function calls en continue conversation
  // ... (zie hierboven voor details)
}
```

### Follow-up Prompt Construction
```javascript
const followUpPrompt = `${systemText}${periodHint}

Conversatie geschiedenis:
${conversationContext}

Function call resultaten:
${resultsText}

Geef een uitgebreide analyse en beantwoord de laatste vraag van de gebruiker. Gebruik de function resultaten en houd rekening met de volledige conversatie context.

BELANGRIJK bij analyse:
- Valideer EERST wat user beweert met concrete cijfers uit de data
- Voor ELKE boekstuknummer in de resultaten: gebruik get_transaction_details
- Leg uit wat elke transactie precies doet en waarom het verschil veroorzaakt
- Geef volledige context: datum, type, rekeningen, bedragen, betekenis
- Wees specifiek maar zonder bronverwijzingen - bedragen zijn klikbaar voor details.`;
```

## Financial Tools Implementatie

### Tool Execution (lib/finance/tools.js)
```javascript
export async function executeToolCall(toolCall) {
  const { id, function: func } = toolCall;
  const args = JSON.parse(func.arguments || '{}');
  
  switch (id) {
    case 'variance_report':
      return await generateVarianceReport(args);
    case 'get_transaction_details':
      return await getTransactionDetails(args);
    case 'financial_summary':
      return await getFinancialSummary(args);
    case 'category_analysis':
      return await analyzeCategory(args);
    case 'period_comparison':
      return await comparePeriods(args);
    default:
      throw new Error(`Unknown tool: ${id}`);
  }
}
```

### Variance Report Tool
```javascript
async function generateVarianceReport({ period1_from, period1_to, period2_from, period2_to, category }) {
  try {
    // 1. Haal data op voor beide periodes
    const data1 = await fetchAFASData(period1_from, period1_to);
    const data2 = await fetchAFASData(period2_from, period2_to);
    
    // 2. Filter op categorie
    const filtered1 = data1.filter(row => 
      row.Omschrijving_3?.toLowerCase().includes(category.toLowerCase())
    );
    const filtered2 = data2.filter(row => 
      row.Omschrijving_3?.toLowerCase().includes(category.toLowerCase())
    );
    
    // 3. Bereken totalen
    const total1 = filtered1.reduce((sum, row) => sum + (row.Debet - row.Credit), 0);
    const total2 = filtered2.reduce((sum, row) => sum + (row.Debet - row.Credit), 0);
    
    // 4. Bereken variance
    const variance = total2 - total1;
    const variancePercent = total1 !== 0 ? (variance / Math.abs(total1)) * 100 : 0;
    
    return JSON.stringify({
      period1: { from: period1_from, to: period1_to, total: total1 },
      period2: { from: period2_from, to: period2_to, total: total2 },
      variance: variance,
      variancePercent: variancePercent,
      category: category,
      details: {
        period1_transactions: filtered1.length,
        period2_transactions: filtered2.length
      }
    });
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}
```

### Transaction Details Tool
```javascript
async function getTransactionDetails({ boekstuknummer, datum_from, datum_to, rekeningnummer }) {
  try {
    // 1. Haal alle transacties op
    const allData = await fetchAFASData(datum_from, datum_to);
    
    // 2. Filter op criteria
    let filtered = allData.filter(row => 
      row.Boekstuknummer === boekstuknummer
    );
    
    if (rekeningnummer) {
      filtered = filtered.filter(row => 
        row.Rekeningnummer === rekeningnummer
      );
    }
    
    // 3. Groepeer en analyseer
    const grouped = filtered.reduce((acc, row) => {
      const key = `${row.Rekeningnummer}-${row.Omschrijving_3}`;
      if (!acc[key]) {
        acc[key] = {
          rekeningnummer: row.Rekeningnummer,
          omschrijving: row.Omschrijving_3,
          debet: 0,
          credit: 0,
          transactions: []
        };
      }
      
      acc[key].debet += row.Debet || 0;
      acc[key].credit += row.Credit || 0;
      acc[key].transactions.push({
        datum: row.Datum,
        boekstuknummer: row.Boekstuknummer,
        debet: row.Debet,
        credit: row.Credit,
        omschrijving: row.Omschrijving_2
      });
      
      return acc;
    }, {});
    
    return JSON.stringify({
      boekstuknummer,
      total_transactions: filtered.length,
      grouped_transactions: Object.values(grouped),
      summary: {
        total_debet: filtered.reduce((sum, row) => sum + (row.Debet || 0), 0),
        total_credit: filtered.reduce((sum, row) => sum + (row.Credit || 0), 0),
        net_amount: filtered.reduce((sum, row) => sum + (row.Debet - row.Credit), 0)
      }
    });
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
}
```

## Error Handling & Logging

### Request Tracking
```javascript
const requestId = Math.random().toString(36).substring(7);
const startTime = Date.now();

console.log(`🚀 [${requestId}] AI Chat Request Started`);
console.log(`📨 [${requestId}] Request Data:`, {
  messageCount: messages.length,
  period_from,
  period_to,
  userMessage: messages[messages.length - 1]?.content?.substring(0, 100) + '...'
});
```

### Function Call Logging
```javascript
console.log(`🛠️  [${requestId}] Executing ${response.functionCalls.length} function calls:`, 
  response.functionCalls.map(call => call.name));

const callStart = Date.now();
console.log(`🔧 [${requestId}] Tool ${index + 1}: ${call.name} - Starting...`);
console.log(`📋 [${requestId}] Tool ${index + 1}: Args:`, call.args);

// After execution
const callTime = Date.now() - callStart;
const parsedOutput = JSON.parse(output);
console.log(`✅ [${requestId}] Tool ${index + 1}: ${call.name} completed in ${callTime}ms`);
console.log(`📊 [${requestId}] Tool ${index + 1}: Result summary:`, {
  hasRows: !!parsedOutput.rows,
  rowCount: parsedOutput.rows?.length || 0,
  hasTotals: !!parsedOutput.totals,
  hasSourceRefs: !!parsedOutput.source_refs,
  sourceRefCount: parsedOutput.source_refs?.length || 0,
  outputLength: output.length
});
```

### Error Handling
```javascript
try {
  // ... function execution
} catch (err) {
  const callTime = Date.now() - callStart;
  console.error(`❌ [${requestId}] Tool ${index + 1}: ${call.name} failed after ${callTime}ms:`, err.message);
  return {
    name: call.name,
    output: `Error: ${String(err)}`
  };
}
```

## Performance Optimalisaties

### Parallel Execution
```javascript
// Execute alle function calls parallel in plaats van sequentieel
const functionResults = await Promise.all(
  response.functionCalls.map(async (call, index) => {
    // ... execution logic
  })
);
```

### Request Optimization
```javascript
// Gebruik bestaande AFAS data in plaats van nieuwe API calls
const existingData = getExistingAFASData(); // From global state
const filteredData = existingData.filter(/* criteria */);
```

### Memory Management
```javascript
// Cleanup na elke hop om memory leaks te voorkomen
const resultsText = functionResults.map(fr => 
  `Function ${fr.name} result: ${fr.output}`
).join('\n\n');

// Clear functionResults array
functionResults.length = 0;
```

## Security Considerations

### Input Validation
```javascript
// Validate function arguments
const validateArgs = (args, required) => {
  for (const field of required) {
    if (!args[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};

// Sanitize user input
const sanitizeInput = (input) => {
  return input.replace(/[<>]/g, ''); // Basic XSS prevention
};
```

### API Key Security
```javascript
// Environment variable voor API key
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY // Never hardcode
});
```

### Rate Limiting
```javascript
// Implement rate limiting per user/IP
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
};
```

## Monitoring & Analytics

### Performance Metrics
```javascript
// Track response times
const totalTime = Date.now() - startTime;
console.log(`✅ [${requestId}] Request completed in ${totalTime}ms`);

// Track function call success rates
const successRate = successfulCalls / totalCalls;
console.log(`📊 [${requestId}] Function call success rate: ${successRate * 100}%`);
```

### Usage Analytics
```javascript
// Track popular queries
const queryType = analyzeQueryType(userMessage);
console.log(`📈 [${requestId}] Query type: ${queryType}`);

// Track tool usage
console.log(`🔧 [${requestId}] Tools used:`, usedTools);
```

## Troubleshooting

### Common Issues

1. **Function Call Failures**
   - Check tool availability
   - Validate function arguments
   - Check AFAS API connectivity

2. **Timeout Issues**
   - Reduce maxHops
   - Optimize function execution
   - Implement caching

3. **Memory Issues**
   - Clear arrays after use
   - Limit conversation history
   - Implement garbage collection

### Debug Tips

```javascript
// Enable detailed logging
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Full conversation context:', conversationContext);
  console.log('Function call details:', response.functionCalls);
  console.log('Tool results:', toolResults);
}
```

## Future Enhancements

### Planned Features
- **Conversation Memory**: Persistent chat history
- **Advanced Analytics**: User behavior tracking
- **Custom Tools**: User-defined financial tools
- **Multi-language Support**: Internationalization
- **Voice Integration**: Speech-to-text capabilities

### Technical Improvements
- **Caching Layer**: Redis for tool results
- **Streaming Responses**: Real-time AI responses
- **Advanced Error Recovery**: Automatic retry mechanisms
- **Performance Monitoring**: APM integration
