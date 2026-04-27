# Match Backend API

API Hono/Bun du projet Match (version finale).

## Objectif
Le backend expose l'ensemble des services métier:
- auth et session management
- discovery / venues / matches / sports
- reservations
- partner tools (analytics, billing, boosts, referral, fidelity)
- notifications, support, webhooks, media

## Stack
- Bun runtime
- Hono framework
- TypeScript strict
- PostgreSQL + Drizzle ORM
- Redis + BullMQ (queues et jobs)
- Stripe (checkout/webhooks)

## Démarrage rapide
```bash
cd back
bun install
bun run dev
```

API locale:
- `http://localhost:8008/api`

## Scripts utiles
```bash
# dev
bun run dev

# lint
bun run lint

# migrations / db
bun run db:setup
bun run db:push
bun run db:migrate

# typecheck (recommandé avant push)
bunx tsc -p tsconfig.json --noEmit
```

## Architecture (résumé)
- `src/server.ts`: montage des routes
- `src/modules/*`: pattern routes/controller/logic
- `src/repository/*`: accès données
- `src/config/db/*`: schéma Drizzle
- `src/workers/*`: workers BullMQ
- `src/services/*`: services transverses (mail/notifications/storage)
- `services/mail-service/*`: service mail dédié

## Routes principales
Base path: `/api`

Modules montés:
- `/auth`
- `/users`
- `/discovery`
- `/venues`
- `/media`
- `/matches`
- `/sports`, `/leagues`, `/teams` (via routeur racine sports)
- `/reservations`
- `/partners`
- `/reviews`
- `/notifications`
- `/support`
- `/webhooks`
- `/coupons`
- `/referral`
- `/boosts`
- `/fidelity`
- `/challenge`
- `/health`

## Scheduling & workers
- setup scheduler dans `src/config/scheduler.ts`
- jobs récurrents:
  - aggregation billing mensuelle
  - check upcoming matches (horaire)
- workers init au boot (`index.ts` + `src/server.ts` imports workers)

## Variables d'environnement
Référence complète:
- `back/docs/environment_variables.md`

## Docs backend
- `back/docs/index.md`
- `back/docs/architecture.md`
- `back/docs/environment_variables.md`
