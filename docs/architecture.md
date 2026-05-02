# Backend Architecture (Final)

## Vue d'ensemble
API modulaire construite avec Hono, exécutée sur Bun, avec persistence PostgreSQL (Drizzle) et traitements asynchrones BullMQ.

Entrées:
- `index.ts` (serveur Bun, bootstrap workers et scheduler)
- `src/server.ts` (montage middleware + routes)

## Organisation du code
- `src/modules/<domain>/`
  - `*.routes.ts`: wiring des dépendances et endpoints
  - `*.controller.ts`: adaptation HTTP (request/response)
  - `*.logic.ts`: logique métier
- `src/repository/`: accès DB et requêtes métier
- `src/config/db/`: définition du schéma Drizzle
- `src/middleware/`: auth / optional-auth / rôles
- `src/queue/` et `src/workers/`: jobs asynchrones
- `src/services/`: services techniques (mail, storage, notifications)
- `services/mail-service/`: service mail dédié

## Middleware globaux
- CORS avec `credentials: true`
- logger
- header `X-Robots-Tag: noindex, nofollow`
- auth middleware appliqué aux routes protégées (`/partners/*`, `/users/*`, `/reservations/*`, `/fidelity/*`, `/challenge/*`)

## Routes montées (base `/api`)
- `/health`
- `/auth`
- `/users`
- `/discovery`
- `/venues`
- `/media`
- `/matches`
- `/sports`, `/leagues`, `/teams` (via routeur sports monté à `/`)
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

## Scheduling & asynchrone
Scheduler (`src/config/scheduler.ts`):
- agrégation billing mensuelle
- vérification matchs à venir (horaire)

Workers démarrés:
- `stripe.worker`
- `notification.worker`
- `billing-aggregation.worker`

## Données & intégrations
- PostgreSQL / Drizzle ORM
- Redis / BullMQ
- Stripe (checkout + webhooks)
- SMTP (service mail)
- S3/R2 (media)
- LocationIQ (geocoding)

## Nettoyage compte supprimé
Au boot puis périodiquement:
- purge des comptes supprimés au-delà de `ACCOUNT_DELETION_GRACE_DAYS`
- fréquence via `ACCOUNT_DELETION_CLEANUP_INTERVAL_HOURS`
