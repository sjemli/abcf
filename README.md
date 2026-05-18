# CAAR — Counterparty & Account Angular Registry

Angular 18 standalone app for BNPP Global Markets party lookup and relationship graph visualisation.

## Design System

Built with **BNPP Paribas colours** on a dark base:
- Primary green: `#009B77` / Bright: `#00c896`
- Dark base: `#0b0f18` / Surface: `#0d1120`
- All accents, borders, glows and highlights use the BNPP green ramp

## Quick Start

```bash
npm install
ng serve
# → http://localhost:4200
```

## Features

| Feature | Description |
|---------|-------------|
| 🔍 Party Search | Debounced search by name, LEI, or CRDS. Mock-first, API fallback |
| 📋 Party Detail | Identifiers, roles, accounts, system info with stat counters |
| 🕸️ Graph View | Foblex interactive clearing-chain diagram; click node → side panel |
| 🎨 BNPP Theme | Dark navy + BNPP green `#009B77` throughout |

## Mock Data (pre-loaded)

**FM Arbitrage graph (EUREX & CME):**
CME Market → CME Clearing ← BNPP SEC Corp ↔ BNPP SA Paris → EUREX Clearing → EUREX Market
BNPP FM clears via both SEC Corp and SA Paris

**CFL Simple Client graph:**
BNPP SA London → AAML U (Clears agreement)

**Quick searches:** `BNPP` · `BEDUPAR` · `PARBLON` · `AAML` · `R0MUWSFPU8MPR08K5P83`

## Architecture

```
src/app/
├── core/
│   ├── models/party.model.ts       # Party, PartyGraph, interfaces
│   ├── services/party.service.ts   # Mock-first → API fallback
│   └── mock-data.ts                # 9 parties + 2 graphs hardcoded
├── features/
│   ├── search/                     # Search page
│   ├── party-detail/               # Detail page
│   └── party-graph/                # Foblex graph
├── app.component.ts                # CAAR shell + sidebar
└── app.config.ts                   # provideRouter, provideHttpClient
```

## API Endpoints (fallback when no mock match)

```
GET /api/v1/parties/search?q=&page=&pageSize=
GET /api/v1/parties/:id
GET /api/v1/parties/:id/graphs
```

Configure base URL in `src/environments/environment.ts`.

## Foblex Setup

Add to `angular.json` styles:
```json
"node_modules/@foblex/flow/styles/f-flow.css"
```

## Dependencies

```
@angular/core ^18    @foblex/flow ^1.2    rxjs ~7.8
```
