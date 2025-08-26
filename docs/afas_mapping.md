# AFAS Data Mapping Documentation

Dit document beschrijft hoe de data van AFAS wordt gemapt naar de verschillende onderdelen van de financiële rapportage.

## Winst & Verliesrekening (P&L)

### Omzet
- Komt uit AFAS veld `Type_rekening = 'Opbrengsten'`
- Wordt geaggregeerd per maand in `accountTypeBreakdown.Opbrengsten`
- Positieve bedragen (credit) worden als omzet geteld

### Kosten
- Komt uit AFAS veld `Type_rekening = 'Kosten'`
- Wordt geaggregeerd per maand in `accountTypeBreakdown.Kosten`
- Negatieve bedragen (debet) worden als kosten geteld
- Absolute waarde wordt gebruikt voor rapportage

## Balans (Activa & Passiva)

### Activa
- Komt uit AFAS veld `Type_rekening = 'Activa'`
- Wordt onderverdeeld in categorieën op basis van `Omschrijving_3` of `Kenmerk_rekening`:
  - Debiteuren
  - Voorraad
  - Bank/Kas/Liquide middelen
  - Materiële vaste activa
  - Immateriële vaste activa
  - Overige activa

### Passiva
- Komt uit AFAS veld `Type_rekening = 'Passiva'`
- Wordt onderverdeeld in categorieën op basis van `Omschrijving_3` of `Kenmerk_rekening`:
  - Crediteuren
  - Leningen
  - Schulden
  - BTW/Belastingen
  - Overige passiva

### Eigen Vermogen
- Wordt berekend als: Activa - Passiva
- Wordt per maand bijgehouden voor trend analyse

## Categorieën

Categorieën worden bepaald op basis van de volgende hiërarchie:
1. `Omschrijving_3` (indien aanwezig)
2. `Kenmerk_rekening` (indien geen Omschrijving_3)
3. Default naar 'Overige' als beide niet aanwezig zijn

Speciale categorieën:
- 'Crediteuren' (wanneer `Kenmerk_rekening = 'Crediteuren'`)
- 'Debiteuren' (wanneer `Kenmerk_rekening = 'Debiteuren'`)
- 'Overige' (wanneer `Kenmerk_rekening = 'Grootboekrekening'`)

## Berekeningen en Ratio's

### Current Ratio
- Vlottende Activa ≈ 60% van totale Activa (heuristiek)
- Kortlopende schulden ≈ 70% van Vreemd Vermogen (heuristiek)
- Formule: Vlottende Activa / Kortlopende Schulden

### Quick Ratio
- Vlottende Activa minus Voorraad (Voorraad ≈ 10% van Activa)
- Formule: (Vlottende Activa - Voorraad) / Kortlopende Schulden

### Debt to Equity
- Vreemd Vermogen / Eigen Vermogen
- Eigen Vermogen = Activa - Passiva

### Bruto Marge
- (Omzet - Kosten) / Omzet
- Gebruikt de totalen uit de W&V rekening

## AFAS Velden Mapping

Belangrijkste AFAS velden die worden gebruikt:
- `Jaar`: Boekjaar
- `Periode`: Maand (1-12)
- `Type_rekening`: Hoofdcategorie (Activa, Passiva, Kosten, Opbrengsten)
- `Omschrijving_3`: Primaire categorie indeling
- `Kenmerk_rekening`: Backup categorie indeling
- `Bedrag_debet`: Debet bedrag
- `Bedrag_credit`: Credit bedrag
- `Boekstuknummer`: Referentie voor audit trail
- `Rekeningnummer`: Grootboekrekening
- `Code_dagboek`/`Dagboek`: Dagboek code
- `Kostenplaats`/`KostenplaatsCode`: Kostenplaats
- `Project`/`ProjectCode`: Project code
