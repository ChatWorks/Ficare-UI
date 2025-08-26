# Enhanced P&L Implementation Guide

## Overzicht

Deze implementatie voegt een geavanceerde winst- en verliesrekening toe aan de Financial Controller Agent met AI-gebaseerde categorisering van AFAS data.

## Nieuwe Functionaliteiten

### 1. AI-Gebaseerde Categorie Mapping

**Database Schema:**
- `category_mapping`: Opslag van categorie mappings per gebruiker
- `user_settings`: Gebruikersinstellingen en setup status

**API Endpoints:**
- `GET /api/v2/category-mapping`: Ophalen bestaande mappings
- `POST /api/v2/category-mapping`: Genereren AI mappings
- `PUT /api/v2/category-mapping`: Updaten specifieke mapping
- `GET /api/v2/financial/ai-ready`: Ophalen unieke categorieën voor AI

### 2. Enhanced P&L Categorieën

De nieuwe P&L structuur bevat:

**Directe Opbrengsten & Kosten:**
- Omzet
- Inkoopwaarde omzet
- Provisies  
- Personeelskosten direct

**Berekende Waarden:**
- Marge = SOM(bovenstaande)
- Marge% = (Marge/Omzet) * 100

**Operationele Kosten:**
- Autokosten
- Marketingkosten
- Operationele personeelskosten

**Berekende Waarden:**
- Contributiemarge = Marge + Operationele kosten
- Contributiemarge% = (Contributiemarge/Omzet) * 100

**Vaste Kosten:**
- Huisvestingskosten
- Kantoorkosten
- Algemene kosten

**Berekende Waarden:**
- Totale kosten = SOM(vaste kosten)
- EBITDA = Contributiemarge + Totale kosten
- EBITDA% = (EBITDA/Omzet) * 100

**Financiële Kosten:**
- Afschrijvingskosten
- Financieringskosten

**Eindberekeningen:**
- EBIT = EBITDA + Financiële kosten
- VPB (23%) = EBIT * 0.23 (alleen als EBIT > 0)
- Resultaat na belasting = EBIT + VPB
- Netto resultaat% = (Resultaat na belasting/Omzet) * 100

### 3. AI Integration (Gemini 2.5 Flash)

**Structured Output:**
- Gebruikt JSON schema voor consistente responses
- Enum types voor geldige categorieën
- Confidence scores (0-1)
- Reasoning explanatie

**Mapping Logic:**
- Opbrengsten → alleen Omzet of Provisies
- Kosten → alle andere categorieën
- Fallback bij AI fouten
- Validatie van responses

### 4. User Experience

**Nieuwe Gebruikers:**
- Automatisch doorverwezen naar Settings
- "Nieuw!" badge op Settings tab
- Setup completion tracking

**Settings Interface:**
- Overzicht van alle categorieën
- AI mapping status en confidence
- Handmatige override mogelijkheid
- Bulk AI mapping functionaliteit

**Enhanced P&L Tab:**
- Maandelijkse breakdown
- Automatische berekeningen
- Summary cards met KPIs
- "AI" badge als mappings beschikbaar

## Installatie

### 1. Database Migration

Voer uit in Supabase SQL Editor:
```sql
-- Zie category_mapping_migration.sql
```

### 2. Environment Variables

Zorg dat deze ingesteld zijn:
```bash
GOOGLE_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_BASE_URL=your_app_url_here
```

### 3. Dependencies

Alle benodigde packages zijn al geïnstalleerd:
- `@google/generative-ai`
- `@supabase/auth-helpers-nextjs`

## Gebruik

### Voor Nieuwe Gebruikers:

1. Log in voor de eerste keer
2. Wordt automatisch doorverwezen naar Settings tab
3. Klik "Start AI Mapping" om categorieën te laten mappen
4. Controleer en pas mappings aan indien nodig
5. Klik "Setup Voltooien & Naar Dashboard"
6. Enhanced P&L is nu beschikbaar onder Financiële Overzichten

### Voor Bestaande Gebruikers:

1. Ga naar Settings tab
2. Start AI mapping voor je categorieën
3. Enhanced P&L tab wordt beschikbaar met "AI" badge

## Technical Details

### AI Mapping Process:

1. Extract unieke category_3 waarden uit AFAS data
2. Voor elke categorie: verzamel metadata (type, aantal records, sample descriptions)
3. Verstuur naar Gemini 2.5 Flash met structured output
4. Valideer en store resultaat in database
5. Gebruiker kan handmatig overriden

### Data Flow:

1. AFAS Data → Financial API
2. Category extraction → AI Ready API  
3. AI Mapping → Category Mapping API
4. Enhanced P&L berekeningen → Frontend

### Security:

- Row Level Security (RLS) op alle tabellen
- User-based data isolation
- API authentication required
- Input validation en sanitization

## Troubleshooting

### AI Mapping Fails:
- Check GOOGLE_API_KEY environment variable
- Verify Gemini API quota/limits
- Fallback mapping wordt gebruikt bij fouten

### Database Errors:
- Verify migration ran successfully
- Check RLS policies are active
- Ensure user has proper permissions

### Performance:
- AI mapping heeft rate limiting (100ms delay)
- Large datasets worden in batches verwerkt
- Caching van mappings in frontend state

## Future Enhancements

- Export Enhanced P&L naar Excel/PDF
- Historische trend analyse
- Benchmark vergelijkingen
- Meer granulaire kostenallocatie
- Machine learning voor betere mappings
