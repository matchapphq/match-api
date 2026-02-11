# Sports API Integration (API-Sports Football)

## Overview

The Match App fetches **real football data** from [API-Sports](https://api-sports.io/) (Football v3). This replaces the old seed-based approach where fake matches, teams, and leagues were manually created.

**How it works:**

1. **Sports** (e.g. "Football") are the only manually seeded entity — run the seed script once.
2. **Leagues, Teams, and Matches** are all fetched from API-Sports and synced into the DB automatically.
3. The mobile app and frontend consume matches from the DB via the existing `/api/matches/*` endpoints — no client changes needed.

```
┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│  API-Sports  │ ───► │  Backend    │ ───► │  PostgreSQL  │
│  (Football)  │      │  (Hono)     │      │  (DB)        │
└──────────────┘      └─────────────┘      └──────────────┘
                                                  │
                                           ┌──────┴──────┐
                                           │             │
                                      ┌────▼───┐   ┌────▼────┐
                                      │ Mobile │   │ Frontend│
                                      └────────┘   └─────────┘
```

---

## Architecture

### Data Flow

1. **Seed:** Run `seed-sports.ts` to create the "Football" sport entry (and optionally other sports for future use).
2. **Sync:** When `/api/matches/upcoming` or `/api/matches` is called, the backend checks if the DB has enough upcoming real fixtures (`external_id IS NOT NULL`). If not, it does a **blocking sync** from API-Sports for popular leagues.
3. **Manual sync:** Call `POST /api/matches/sync` to bulk-sync fixtures on demand.
4. **Upsert:** Every fixture from API-Sports is upserted into the DB — the league and both teams are created/updated first, then the match itself.

### Key Files

| File | Purpose |
|---|---|
| `src/lib/api-sports.ts` | API-Sports HTTP client, types, status mapping |
| `src/modules/matches/matches.logic.ts` | Sync logic, auto-sync on request, match queries |
| `src/modules/sports/sports.logic.ts` | Fetch leagues/teams/fixtures from API-Sports |
| `src/modules/sports/sports.controller.ts` | `/football/*` endpoints + existing DB endpoints |
| `src/modules/sports/sports.routes.ts` | Route definitions |
| `src/repository/sports.repository.ts` | Upsert methods for leagues, teams, matches |
| `src/config/db/sports.table.ts` | DB schema with `api_id` columns |
| `src/config/db/matches.table.ts` | Matches schema with `external_id` column |

---

## Environment Setup

Add to your `.env.dev` (or `.env`):

```env
API_SPORTS_KEY=your_real_api_key_here
```

Get your key from: https://dashboard.api-football.com

> **Note:** Free plans only support seasons 2022–2024 and don't have access to `next`/`last` params. A paid plan is required for current season data.

---

## Database Schema Changes

Three columns were added to existing tables to map API-Sports IDs:

| Table | Column | Type | Purpose |
|---|---|---|---|
| `sports` | `api_id` | `integer UNIQUE` | API-Sports sport ID (unused for now) |
| `leagues` | `api_id` | `integer UNIQUE` | API-Sports league ID (e.g. 39 = Premier League) |
| `leagues` | `type` | `varchar(20)` | "League", "Cup", etc. |
| `teams` | `api_id` | `integer UNIQUE` | API-Sports team ID (e.g. 33 = Man Utd) |
| `teams` | `short_code` | `varchar(10)` | Team short code (e.g. "MUN") |
| `matches` | `external_id` | `varchar(255) UNIQUE` | API-Sports fixture ID (already existed) |

These columns enable upsert-by-api-id logic — if a league/team/match already exists, it's updated; if not, it's created.

---

## API Endpoints

### Existing DB-backed endpoints (unchanged)

These are consumed by the mobile app and frontend:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/matches` | List matches (auto-syncs if DB empty) |
| `GET` | `/api/matches/upcoming` | Upcoming matches (auto-syncs if DB empty) |
| `GET` | `/api/matches/:matchId` | Match details |
| `GET` | `/api/matches/:matchId/venues` | Venues showing this match |
| `GET` | `/api/matches/:matchId/live-updates` | Live score data from API-Sports |
| `GET` | `/api/sports` | List all sports |
| `GET` | `/api/sports/:sportId/leagues` | Leagues for a sport |
| `GET` | `/api/leagues/:leagueId` | League details |
| `GET` | `/api/leagues/:leagueId/teams` | Teams in a league |
| `GET` | `/api/teams/:teamId` | Team details |

### Sync endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/matches/sync` | Bulk-sync upcoming fixtures from API-Sports |
| `POST` | `/api/matches/sync-today` | Sync today's fixtures (live score updates) |

### API-Sports pass-through endpoints

These fetch directly from API-Sports and sync results to DB:

| Method | Path | Query Params | Description |
|---|---|---|---|
| `GET` | `/api/football/countries` | `?search=` | List countries |
| `GET` | `/api/football/leagues` | `?country=&season=&search=&type=&current=` | List leagues |
| `GET` | `/api/football/teams` | `?league=&season=&search=&country=` | List teams |
| `GET` | `/api/football/fixtures` | `?league=&date=&team=&season=&from=&to=&live=` | List fixtures |

---

## Sync Logic

### Auto-sync (on request)

When `GET /api/matches` or `GET /api/matches/upcoming` is called:

1. Count upcoming real matches in DB (`scheduled_at >= now AND external_id IS NOT NULL`)
2. If count < 5 (threshold), trigger a **blocking** sync
3. Sync fetches the next 14 days of fixtures for 10 popular leagues
4. Each fixture upserts its league, both teams, and the match into the DB
5. Query the DB and return results

This means the **first request** after a fresh DB may be slow (syncing ~100 fixtures), but all subsequent requests are fast.

### Manual sync (`POST /api/matches/sync`)

Request body (all optional):

```json
{
  "leagues": [39, 140, 135],
  "season": "2025",
  "from": "2026-02-12",
  "to": "2026-02-28",
  "days": 14
}
```

| Field | Default | Description |
|---|---|---|
| `leagues` | 10 popular leagues | Array of API-Sports league IDs |
| `season` | Current football season | e.g. "2025" for 2025-2026 |
| `from` | Today | Start date (YYYY-MM-DD) |
| `to` | Today + 14 days | End date (YYYY-MM-DD) |
| `days` | 14 | Alternative to `to` — from today + N days |

Response:

```json
{
  "message": "Sync completed",
  "synced": 95,
  "errors": 0,
  "leagues": 3
}
```

### Season calculation

The current football season is calculated dynamically:
- **Aug–Dec:** season = current year (e.g. Aug 2025 → "2025")
- **Jan–Jul:** season = previous year (e.g. Feb 2026 → "2025")

This maps to the 2025-2026 football season.

### Popular leagues (auto-synced)

| API ID | League |
|---|---|
| 39 | Premier League (England) |
| 140 | La Liga (Spain) |
| 135 | Serie A (Italy) |
| 78 | Bundesliga (Germany) |
| 61 | Ligue 1 (France) |
| 94 | Primeira Liga (Portugal) |
| 2 | Champions League |
| 3 | Europa League |
| 848 | Conference League |
| 253 | MLS (USA) |

---

## Upsert Logic

Every fixture from API-Sports goes through this pipeline:

```
API-Sports Fixture
    │
    ├── Upsert League (by api_id)
    │     └── Creates or updates league in DB
    │
    ├── Upsert Home Team (by api_id)
    │     └── Creates or updates team in DB
    │
    ├── Upsert Away Team (by api_id)
    │     └── Creates or updates team in DB
    │
    └── Upsert Match (by external_id)
          └── Creates or updates match in DB
          └── Maps API status to internal enum
```

### Status Mapping

| API-Sports Status | Internal Status |
|---|---|
| `TBD`, `NS` | `scheduled` |
| `1H`, `HT`, `2H`, `ET`, `P`, `BT`, `LIVE` | `live` |
| `FT`, `AET`, `PEN` | `finished` |
| `CANC`, `ABD`, `AWD`, `WO` | `canceled` |
| `PST`, `SUSP`, `INT` | `postponed` |

---

## Seeding a Fresh Database

For a new database, only **sports** need to be manually seeded. Everything else (leagues, teams, matches) comes from API-Sports.

```bash
# 1. Setup DB schema
bun run db:setup:dev

# 2. Generate and run migrations
bun run db:gen:dev

# 3. Seed sports (the only manual data)
bun --env-file=.env.dev run src/config/seeds/seed-sports-only.ts

# 4. Sync real fixtures from API-Sports
curl -X POST http://localhost:8008/api/matches/sync
```

Or simply start the server and hit `/api/matches/upcoming` — the auto-sync will populate everything.

---

## What's Manual vs What's from API-Sports

| Entity | Source | Notes |
|---|---|---|
| **Sports** | Manual seed | "Football", "Basketball", etc. — only Football has API data for now |
| **Leagues** | API-Sports | Created automatically when fixtures are synced |
| **Teams** | API-Sports | Created automatically when fixtures are synced |
| **Matches** | API-Sports | Synced via auto-sync or manual `POST /sync` |
| **Venue Matches** | Manual / Partner | Venue owners link their venues to matches |

---

## Future: Adding More Sports

The architecture supports multiple sports. To add a new sport (e.g. Basketball via API-Sports Basketball):

1. Add a new API client method in `src/lib/api-sports.ts` (or a separate `api-sports-basketball.ts`)
2. Create the sport entry in the seed script
3. Add sync logic similar to football
4. The DB schema already supports it — `api_id` on leagues/teams works across sports
