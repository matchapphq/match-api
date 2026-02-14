# Match App – Football Data Integration Guide

**Complete implementation guide for integrating API-Sports Football data with Match App using Hono, Bun, Drizzle ORM, Redis, and Dokploy.**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API-Sports Endpoints Reference](#api-sports-endpoints-reference)
4. [Database Schema](#database-schema)
5. [Redis Setup](#redis-setup)
6. [Implementation](#implementation)
7. [Deployment](#deployment)
8. [Usage Examples](#usage-examples)

---

## Overview

### Goals

Match App aggregates football data to help users find venues (bars/restaurants) showing live matches. This requires:

- **Countries** – Filter leagues by geography
- **Leagues** – Premier League, La Liga, etc.
- **Teams** – Manchester United, Real Madrid, etc.
- **Fixtures** – Who vs who, when, live status

### Tech Stack

- **Backend**: Hono + Bun + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Cache**: Redis (Dokploy internal)
- **Data Source**: API-Sports Football v3
- **Deployment**: Dokploy + Docker Compose

### Data Flow

```
API-Sports → Hono Sync Endpoints → Postgres (Drizzle) → Redis Cache → Mobile/Web Clients
```

- External API called **once** per TTL period
- Redis serves 95%+ of requests
- Postgres provides persistent storage and complex queries

---

## Architecture

### High-Level Design

```
┌─────────────────┐
│   API-Sports    │ (External API - rate limited)
│   Football v3   │
└────────┬────────┘
         │ Sync on cron/demand
         ▼
┌─────────────────┐
│  Hono Backend   │ (Bun runtime)
│  + Cache Layer  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ Redis  │ │ Postgres │
│ (15min)│ │ (Drizzle)│
└────────┘ └──────────┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  Mobile/Web     │
│  Expo + React   │
└─────────────────┘
```

### Caching Strategy

| Data Type | Redis TTL | Update Frequency | Why |
|-----------|-----------|------------------|-----|
| Countries | 30 days | Almost never | Static reference data |
| Leagues | 7 days | Seasonal | Changes per season only |
| Teams | 7 days | Seasonal | Roster changes rare |
| Fixtures (live) | 15 min | Real-time | Live scores update frequently |
| Fixtures (future) | 24 hours | Daily | Schedule changes rare |

---

## API-Sports Endpoints Reference

**Base URL**: `https://v3.football.api-sports.io`  
**Authentication**: Header `x-apisports-key: YOUR_API_KEY`

### 1. Countries

Retrieve all available countries across all seasons and competitions.

#### Endpoints

```bash
# Get all countries
GET /countries

# Get country by name
GET /countries?name=england

# Get country by code (ISO 3166-1 alpha-2)
GET /countries?code=gb

# Search countries
GET /countries?search=engl
```

#### Response Structure

```json
{
  "get": "countries",
  "parameters": { "name": "england" },
  "errors": [],
  "results": 1,
  "paging": { "current": 1, "total": 1 },
  "response": [
    {
      "name": "England",
      "code": "GB",
      "flag": "https://media.api-sports.io/flags/gb.svg"
    }
  ]
}
```

#### Fields

- `name` – Country display name
- `code` – ISO country code (used as primary key)
- `flag` – SVG flag icon URL

---

### 2. Leagues

Retrieve leagues/competitions with seasonal data.

#### Endpoints

```bash
# Get league by ID with all seasons
GET /leagues?id=39

# Get league by name
GET /leagues?name=premier league

# Get all leagues from a country
GET /leagues?country=england

# Get leagues by country code
GET /leagues?code=gb

# Get leagues by season
GET /leagues?season=2026

# Get leagues by team (all leagues a team has played in)
GET /leagues?team=33

# Get current/active leagues only
GET /leagues?current=true

# Search leagues
GET /leagues?search=premier

# Get last N leagues added
GET /leagues?last=99

# Combined filters
GET /leagues?country=england&season=2026&type=league
```

#### Response Structure

```json
{
  "get": "leagues",
  "parameters": { "id": "39" },
  "errors": [],
  "results": 1,
  "response": [
    {
      "league": {
        "id": 39,
        "name": "Premier League",
        "type": "League",
        "logo": "https://media.api-sports.io/football/leagues/2.png"
      },
      "country": {
        "name": "England",
        "code": "GB",
        "flag": "https://media.api-sports.io/flags/gb.svg"
      },
      "seasons": [
        {
          "year": 2010,
          "start": "2010-08-14",
          "end": "2011-05-17",
          "current": false,
          "coverage": {
            "fixtures": {
              "events": true,
              "lineups": true,
              "statistics_fixtures": false,
              "statistics_players": false
            },
            "standings": true,
            "players": true,
            "top_scorers": true,
            "top_assists": true,
            "top_cards": true,
            "injuries": true,
            "predictions": true,
            "odds": false
          }
        }
      ]
    }
  ]
}
```

#### Fields

- `league.id` – Unique league identifier
- `league.name` – Display name
- `league.type` – "League", "Cup", etc.
- `country.code` – Foreign key to countries
- `seasons[]` – Array of season objects with coverage details

---

### 3. Teams

Retrieve team information with venue/stadium details.

#### Endpoints

```bash
# Get team by ID
GET /teams?id=33

# Get team by name
GET /teams?name=manchester united

# Get all teams from a league + season
GET /teams?league=39&season=2026

# Get teams by country
GET /teams?country=england

# Get teams by country code
GET /teams?code=fra

# Get teams by venue ID
GET /teams?venue=789

# Search teams
GET /teams?search=manches
```

#### Response Structure

```json
{
  "get": "teams",
  "parameters": { "id": "33" },
  "errors": [],
  "results": 1,
  "response": [
    {
      "team": {
        "id": 33,
        "name": "Manchester United",
        "code": "MUN",
        "country": "England",
        "founded": 1878,
        "national": false,
        "logo": "https://media.api-sports.io/football/teams/33.png"
      },
      "venue": {
        "id": 556,
        "name": "Old Trafford",
        "address": "Sir Matt Busby Way",
        "city": "Manchester",
        "capacity": 76212,
        "surface": "grass",
        "image": "https://media.api-sports.io/football/venues/556.png"
      }
    }
  ]
}
```

#### Fields

- `team.id` – Unique team identifier
- `team.code` – Short code (e.g., "MUN")
- `team.country` – Country name
- `venue.*` – Stadium details (capacity, surface, image)

---

### 4. Fixtures

Retrieve match fixtures with status, teams, scores.

#### Endpoints

```bash
# Get all live fixtures
GET /fixtures?live=all

# Get fixtures by league
GET /fixtures?league=39

# Get fixtures by date
GET /fixtures?date=2026-02-11

# Get fixtures by team
GET /fixtures?team=33

# Get fixtures by season
GET /fixtures?season=2026

# Combined filters
GET /fixtures?league=39&date=2026-02-11
GET /fixtures?team=33&season=2026&last=10
```

#### Response Structure

```json
{
  "get": "fixtures",
  "parameters": { "live": "all" },
  "errors": [],
  "results": 4,
  "paging": { "current": 1, "total": 1 },
  "response": [
    {
      "fixture": {
        "id": 239625,
        "referee": null,
        "timezone": "UTC",
        "date": "2020-02-06T14:00:00+00:00",
        "timestamp": 1580997600,
        "periods": {
          "first": 1580997600,
          "second": null
        },
        "venue": {
          "id": 1887,
          "name": "Stade Municipal",
          "city": "Oued Zem"
        },
        "status": {
          "long": "Halftime",
          "short": "HT",
          "elapsed": 45,
          "extra": null
        }
      },
      "league": {
        "id": 200,
        "name": "Botola Pro",
        "country": "Morocco",
        "logo": "https://media.api-sports.io/football/leagues/115.png",
        "flag": "https://media.api-sports.io/flags/ma.svg",
        "season": 2019,
        "round": "Regular Season - 14"
      },
      "teams": {
        "home": {
          "id": 967,
          "name": "Rapide Oued ZEM",
          "logo": "https://media.api-sports.io/football/teams/967.png",
          "winner": false
        },
        "away": {
          "id": 968,
          "name": "Wydad AC",
          "logo": "https://media.api-sports.io/football/teams/968.png",
          "winner": true
        }
      },
      "goals": {
        "home": 0,
        "away": 1
      },
      "score": {
        "halftime": { "home": 0, "away": 1 },
        "fulltime": { "home": null, "away": null },
        "extratime": { "home": null, "away": null },
        "penalty": { "home": null, "away": null }
      }
    }
  ]
}
```

#### Status Codes

- `TBD` – Time to be defined
- `NS` – Not started
- `1H` – First half
- `HT` – Halftime
- `2H` – Second half
- `ET` – Extra time
- `P` – Penalty in progress
- `FT` – Finished
- `AET` – Finished after extra time
- `PEN` – Finished after penalty
- `BT` – Break time
- `SUSP` – Suspended
- `INT` – Interrupted
- `PST` – Postponed
- `CANC` – Cancelled
- `ABD` – Abandoned
- `AWD` – Technical loss
- `WO` – Walkover
- `LIVE` – In progress

---

## Database Schema

### Complete Drizzle ORM Schema

File: `src/db/schema/sports.ts`

```typescript
import { pgTable, varchar, integer, timestamp, boolean, serial } from 'drizzle-orm/pg-core';

// ===== COUNTRIES =====
export const countriesTable = pgTable('countries', {
  code: varchar('code', { length: 2 }).primaryKey(),    // "GB", "FR", etc.
  name: varchar('name', { length: 100 }).notNull(),     // "England"
  flag_url: varchar('flag_url'),                        // SVG flag URL
});

// ===== LEAGUES =====
export const leaguesTable = pgTable('leagues', {
  api_id: integer('api_id').primaryKey(),               // 39 (Premier League)
  name: varchar('name', { length: 100 }).notNull(),     // "Premier League"
  type: varchar('type', { length: 20 }),                // "League", "Cup"
  logo_url: varchar('logo_url'),                        // League logo
  country_code: varchar('country_code', { length: 2 })
    .references(() => countriesTable.code),             // "GB"
});

// ===== SEASONS =====
export const seasonsTable = pgTable('seasons', {
  id: serial('id').primaryKey(),
  league_api_id: integer('league_api_id')
    .references(() => leaguesTable.api_id),
  year: integer('year').notNull(),                      // 2026
  start: timestamp('start'),                            // Season start date
  end: timestamp('end'),                                // Season end date
  current: boolean('current').default(false),           // Is current season
});

// ===== STADIUMS =====
export const stadiumsTable = pgTable('stadiums', {
  api_id: integer('api_id').primaryKey(),               // 556 (Old Trafford)
  name: varchar('name').notNull(),                      // "Old Trafford"
  address: varchar('address'),                          // "Sir Matt Busby Way"
  city: varchar('city'),                                // "Manchester"
  capacity: integer('capacity'),                        // 76212
  surface: varchar('surface'),                          // "grass"
  image_url: varchar('image_url'),                      // Stadium photo
});

// ===== TEAMS =====
export const teamsTable = pgTable('teams', {
  api_id: integer('api_id').primaryKey(),               // 33 (Man Utd)
  name: varchar('name', { length: 100 }).notNull(),     // "Manchester United"
  code: varchar('code', { length: 10 }),                // "MUN"
  country_code: varchar('country_code', { length: 2 })
    .references(() => countriesTable.code),             // "GB"
  founded: integer('founded'),                          // 1878
  logo_url: varchar('logo_url'),                        // Team logo
  stadium_api_id: integer('stadium_api_id')
    .references(() => stadiumsTable.api_id),            // 556
});

// ===== MATCHES/FIXTURES =====
export const matchesTable = pgTable('matches', {
  api_id: integer('api_id').primaryKey(),               // Fixture ID from API
  home_team_api_id: integer('home_team_api_id')
    .references(() => teamsTable.api_id),
  away_team_api_id: integer('away_team_api_id')
    .references(() => teamsTable.api_id),
  league_api_id: integer('league_api_id')
    .references(() => leaguesTable.api_id),
  date: timestamp('date').notNull(),                    // Match date/time
  status: varchar('status', { length: 10 }),            // "HT", "FT", "LIVE"
  stadium_api_id: integer('stadium_api_id')
    .references(() => stadiumsTable.api_id),
  home_goals: integer('home_goals'),                    // Score
  away_goals: integer('away_goals'),                    // Score
});

// Type exports
export type Country = typeof countriesTable.$inferSelect;
export type League = typeof leaguesTable.$inferSelect;
export type Season = typeof seasonsTable.$inferSelect;
export type Stadium = typeof stadiumsTable.$inferSelect;
export type Team = typeof teamsTable.$inferSelect;
export type Match = typeof matchesTable.$inferSelect;
```

### Entity Relationships

```
countriesTable (code)
    ↓
leaguesTable (country_code) ← seasonsTable (league_api_id)
    ↓
matchesTable (league_api_id)
    ↓
teamsTable (api_id) → matchesTable (home_team_api_id, away_team_api_id)
    ↓
stadiumsTable (api_id) ← teamsTable (stadium_api_id)
                        ← matchesTable (stadium_api_id)
```

---

## Redis Setup

### 1. Redis Client Configuration

File: `src/lib/redis.ts`

```typescript
import Redis from 'ioredis';

// Connect to Dokploy internal Redis
export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

// Connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
  console.log('Redis connection closed');
  process.exit(0);
});

export default redis;
```

### 2. Cache Middleware

File: `src/middleware/cache.ts`

```typescript
import { Context, Next } from 'hono';
import { redis } from '../lib/redis';

export const cache = (ttl: number) => {
  return async (c: Context, next: Next) => {
    const cacheKey = `cache:${c.req.url}`;
    
    try {
      // Check cache
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        console.log(`[CACHE HIT] ${cacheKey}`);
        return c.json(JSON.parse(cached), 200, {
          'Cache-Control': `public, max-age=${ttl}`,
          'X-Cache': 'HIT',
        });
      }
      
      console.log(`[CACHE MISS] ${cacheKey}`);
      
      // Execute route handler
      await next();
      
      // Cache response if status is 200
      if (c.res.status === 200) {
        const body = await c.res.clone().text();
        await redis.setex(cacheKey, ttl, body);
        console.log(`[CACHE STORED] ${cacheKey} TTL:${ttl}s`);
      }
      
    } catch (error) {
      console.error('[CACHE ERROR]', error);
      // Bypass cache on error
      await next();
    }
  };
};
```

### 3. Environment Variables

```bash
# .env
REDIS_URL=redis://match-redis.dokploy.internal:6379
# Or with auth: redis://username:password@host:6379
```

### 4. Docker Compose Network

```yaml
# docker-compose.yml
services:
  match-api:
    build: .
    environment:
      - REDIS_URL=${REDIS_URL}
      - API_SPORTS_KEY=${API_SPORTS_KEY}
    networks:
      - dokploy-network  # Connect to Dokploy Redis

networks:
  dokploy-network:
    external: true
    name: dokploy-network
```

---

## Implementation

### 1. Install Dependencies

```bash
bun add hono ioredis drizzle-orm postgres zod
bun add -d @types/node drizzle-kit
```

### 2. API Routes

File: `src/routes/api.ts`

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../lib/db';
import { cache } from '../middleware/cache';
import {
  countriesTable,
  leaguesTable,
  seasonsTable,
  teamsTable,
  stadiumsTable,
  matchesTable,
} from '../db/schema/sports';

const app = new Hono();

const API_BASE = 'https://v3.football.api-sports.io';
const HEADERS = {
  'x-apisports-key': process.env.API_SPORTS_KEY!,
};

// Query params validator
const QuerySchema = z.object({
  league: z.string().optional(),
  country: z.string().optional(),
  season: z.string().optional(),
  date: z.string().optional(),
  team: z.string().optional(),
  search: z.string().optional(),
});

// ===== COUNTRIES =====
app.get('/countries', cache(2592000), async (c) => { // 30 days
  const { search } = c.req.query();
  const params = new URLSearchParams({
    ...(search && { search }),
  });
  
  const url = `${API_BASE}/countries${params.toString() ? '?' + params : ''}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  // Sync to database
  await db.insert(countriesTable).values(
    data.response.map((country: any) => ({
      code: country.code,
      name: country.name,
      flag_url: country.flag,
    }))
  ).onConflictDoNothing();
  
  return c.json(data.response);
});

// ===== LEAGUES =====
app.get('/leagues', cache(604800), zValidator('query', QuerySchema), async (c) => { // 7 days
  const { country, season, search } = c.req.valid('query');
  const params = new URLSearchParams({
    ...(country && { country }),
    ...(season && { season }),
    ...(search && { search }),
  });
  
  const url = `${API_BASE}/leagues?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  // Sync leagues
  for (const item of data.response) {
    const lg = item.league;
    await db.insert(leaguesTable).values({
      api_id: lg.id,
      name: lg.name,
      type: lg.type,
      logo_url: lg.logo,
      country_code: item.country.code,
    }).onConflictDoUpdate({ 
      target: leaguesTable.api_id,
      set: {
        name: lg.name,
        type: lg.type,
        logo_url: lg.logo,
      }
    });
    
    // Sync seasons
    if (item.seasons && item.seasons.length > 0) {
      for (const s of item.seasons) {
        await db.insert(seasonsTable).values({
          league_api_id: lg.id,
          year: s.year,
          start: new Date(s.start),
          end: new Date(s.end),
          current: s.current,
        }).onConflictDoNothing();
      }
    }
  }
  
  return c.json(data.response);
});

// ===== TEAMS =====
app.get('/teams', cache(604800), zValidator('query', QuerySchema), async (c) => { // 7 days
  const { league, season, search } = c.req.valid('query');
  const params = new URLSearchParams({
    ...(league && { league }),
    ...(season && { season }),
    ...(search && { search }),
  });
  
  const url = `${API_BASE}/teams?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  // Sync teams and stadiums
  for (const item of data.response) {
    const tm = item.team;
    const vn = item.venue;
    
    // Sync stadium first if exists
    if (vn && vn.id) {
      await db.insert(stadiumsTable).values({
        api_id: vn.id,
        name: vn.name,
        address: vn.address,
        city: vn.city,
        capacity: vn.capacity,
        surface: vn.surface,
        image_url: vn.image,
      }).onConflictDoUpdate({
        target: stadiumsTable.api_id,
        set: {
          name: vn.name,
          capacity: vn.capacity,
        }
      });
    }
    
    // Sync team
    await db.insert(teamsTable).values({
      api_id: tm.id,
      name: tm.name,
      code: tm.code,
      country_code: tm.country,
      founded: tm.founded,
      logo_url: tm.logo,
      stadium_api_id: vn?.id || null,
    }).onConflictDoUpdate({
      target: teamsTable.api_id,
      set: {
        name: tm.name,
        logo_url: tm.logo,
      }
    });
  }
  
  return c.json(data.response);
});

// ===== FIXTURES =====
app.get('/fixtures', cache(900), zValidator('query', QuerySchema), async (c) => { // 15 min
  const { league, date, team } = c.req.valid('query');
  const params = new URLSearchParams({
    live: 'all',
    ...(league && { league }),
    ...(date && { date }),
    ...(team && { team }),
  });
  
  const url = `${API_BASE}/fixtures?${params}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  
  // Sync fixtures
  for (const match of data.response) {
    await db.insert(matchesTable).values({
      api_id: match.fixture.id,
      home_team_api_id: match.teams.home.id,
      away_team_api_id: match.teams.away.id,
      league_api_id: match.league.id,
      date: new Date(match.fixture.date),
      status: match.fixture.status.short,
      stadium_api_id: match.fixture.venue?.id || null,
      home_goals: match.goals.home,
      away_goals: match.goals.away,
    }).onConflictDoUpdate({
      target: matchesTable.api_id,
      set: {
        status: match.fixture.status.short,
        home_goals: match.goals.home,
        away_goals: match.goals.away,
      }
    });
  }
  
  return c.json(data.response);
});

// ===== CACHE MANAGEMENT =====
app.delete('/cache/:pattern', async (c) => {
  const pattern = c.req.param('pattern');
  const keys = await redis.keys(`cache:*${pattern}*`);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  
  return c.json({ cleared: keys.length, pattern });
});

export default app;
```

### 3. Main App Entry

File: `src/index.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import apiRoutes from './routes/api';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Mount API routes
app.route('/api', apiRoutes);

// Start server
const port = process.env.PORT || 3000;
console.log(`🚀 Match API running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

---

## Deployment

### 1. Environment Variables (Dokploy)

```bash
# API Keys
API_SPORTS_KEY=your_api_sports_key_here

# Database
DATABASE_URL=postgresql://user:pass@host:5432/matchapp

# Redis (Dokploy internal)
REDIS_URL=redis://match-redis.dokploy.internal:6379

# App
PORT=3000
NODE_ENV=production
```

### 2. Docker Compose

```yaml
version: '3.8'

services:
  match-api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - API_SPORTS_KEY=${API_SPORTS_KEY}
      - NODE_ENV=production
    networks:
      - dokploy-network
    restart: unless-stopped

networks:
  dokploy-network:
    external: true
    name: dokploy-network
```

### 3. Dockerfile

```dockerfile
FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build (if using TypeScript compilation)
# RUN bun build ./src/index.ts --outdir ./dist

# Expose port
EXPOSE 3000

# Run
CMD ["bun", "run", "src/index.ts"]
```

### 4. Cron Jobs (Optional)

Schedule periodic syncs to keep data fresh without client requests.

```bash
# Sync fixtures every 15 minutes
*/15 * * * * curl https://api.matchapp.com/api/fixtures?live=all

# Sync leagues daily at 6 AM
0 6 * * * curl https://api.matchapp.com/api/leagues

# Sync teams weekly on Monday at 3 AM
0 3 * * 1 curl https://api.matchapp.com/api/teams
```

Or use Bun's built-in cron:

```typescript
// src/cron/sync.ts
import { CronJob } from 'cron';

// Sync live fixtures every 15 minutes
const fixturesJob = new CronJob('*/15 * * * *', async () => {
  console.log('[CRON] Syncing live fixtures...');
  await fetch('http://localhost:3000/api/fixtures?live=all');
});

fixturesJob.start();
```

---

## Usage Examples

### 1. Venue Owner Dashboard Flow

**Step 1: Get countries**
```bash
GET /api/countries
→ Returns: [{ code: "GB", name: "England", flag_url: "..." }]
```

**Step 2: Get leagues for England**
```bash
GET /api/leagues?country=england&current=true
→ Returns: [{ league: { id: 39, name: "Premier League" }, ... }]
```

**Step 3: Get teams in Premier League (2026 season)**
```bash
GET /api/teams?league=39&season=2026
→ Returns: [{ team: { id: 33, name: "Manchester United" }, ... }]
```

**Step 4: Get fixtures for a specific date**
```bash
GET /api/fixtures?league=39&date=2026-02-11
→ Returns: [
  {
    fixture: { id: 123, date: "2026-02-11T20:00:00Z", status: "NS" },
    teams: {
      home: { id: 33, name: "Manchester United" },
      away: { id: 34, name: "Liverpool" }
    }
  }
]
```

**Step 5: Venue selects fixture to broadcast**
```bash
POST /api/venues/{venue_id}/broadcasts
Body: { fixture_id: 123, capacity: 50, price: 0 }
```

### 2. Mobile User Flow

**Step 1: Search for a team**
```bash
GET /api/teams?search=manchester
→ Returns matching teams
```

**Step 2: Get fixtures for that team**
```bash
GET /api/fixtures?team=33&date=2026-02-11
→ Returns Man Utd fixtures on Feb 11
```

**Step 3: Find venues broadcasting that match**
```bash
GET /api/venues?fixture_id=123&lat=51.5074&lng=-0.1278&radius=5000
→ Returns venues within 5km showing fixture 123
```

### 3. Cache Invalidation

**Clear all fixture caches**
```bash
DELETE /api/cache/fixtures
```

**Clear specific league cache**
```bash
DELETE /api/cache/leagues?country=england
```

---

## Performance Metrics

### Expected API Call Reduction

Without caching:
- 10,000 users/day × 5 requests = **50,000 API calls/day**
- API-Sports free tier: 100 calls/day → **Impossible**

With Redis caching (this implementation):
- Countries: 1 call per 30 days = **~1 call/month**
- Leagues: 1 call per 7 days × 10 countries = **~50 calls/month**
- Teams: 1 call per 7 days × 20 leagues = **~100 calls/month**
- Fixtures: 1 call per 15 min × 96 intervals = **96 calls/day** = **~3,000 calls/month**

**Total: ~3,150 calls/month** vs 1.5 million without caching = **99.8% reduction**

### Cache Hit Rates (Expected)

- Countries: **99.9%** (almost never changes)
- Leagues: **99.5%** (weekly updates)
- Teams: **99.5%** (weekly updates)
- Fixtures: **95%** (15-min TTL, high traffic overlap)

---

## Troubleshooting

### Redis Connection Issues

**Problem**: `ECONNREFUSED` or `Connection is closed`

**Solution**:
1. Verify Redis is running: `docker ps | grep redis`
2. Check network: `docker network inspect dokploy-network`
3. Test connection: `docker exec -it match-api redis-cli -h match-redis.dokploy.internal ping`
4. Check credentials if auth enabled

### API Rate Limiting

**Problem**: `429 Too Many Requests` from API-Sports

**Solution**:
1. Increase Redis TTL values
2. Implement request queuing with BullMQ
3. Upgrade API-Sports plan
4. Add multiple API keys with round-robin

### Stale Cache Data

**Problem**: Live scores not updating

**Solution**:
1. Reduce fixtures TTL: `cache(300)` for 5-min updates
2. Implement webhook-based invalidation
3. Manual cache clear: `DELETE /api/cache/fixtures`

### Database Performance

**Problem**: Slow queries on large datasets

**Solution**:
1. Add indexes:
```sql
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_league ON matches(league_api_id);
CREATE INDEX idx_matches_teams ON matches(home_team_api_id, away_team_api_id);
```

2. Use materialized views for complex queries
3. Implement read replicas for high traffic

---

## Next Steps

1. **Add more sports**: Basketball (NBA), American Football (NFL) using same pattern
2. **Implement webhooks**: Real-time fixture updates from API-Sports
3. **Add player data**: Lineups, statistics, injuries
4. **Implement odds**: Betting odds for matches
5. **Add notifications**: Push notifications for match start/goals
6. **Optimize queries**: Use Drizzle relational queries for complex joins

---

## Resources

- **API-Sports Documentation**: https://www.api-football.com/documentation-v3
- **Drizzle ORM Docs**: https://orm.drizzle.team
- **Hono Framework**: https://hono.dev
- **Redis Best Practices**: https://redis.io/docs/manual/patterns/
- **Bun Runtime**: https://bun.sh/docs

---

**Last Updated**: February 11, 2026  
**Version**: 1.0.0  
**Author**: Match App Team