# Database (Neon + Prisma)

Pullwright uses a **hybrid** storage model:

| Data | Redis | Postgres (Neon) |
|------|-------|-----------------|
| Sessions + encrypted GitHub tokens | ✅ | ❌ never |
| Live task cache / BullMQ | ✅ | dual-write |
| Full event log (SSE replay) | 24h hot cache | ✅ permanent |
| Users, tasks, metrics, steps | — | ✅ source of truth |
| Budget enforcement (hot counters) | ✅ | usage ledger on complete |

When `DATABASE_URL` is unset, the API runs in **Redis-only mode** (legacy behavior).

## Setup

1. Create a [Neon](https://neon.tech) project.
2. Copy two connection strings:
   - **Pooled** → `DATABASE_URL` (app runtime)
   - **Direct** → `DIRECT_URL` (Prisma migrations only)
3. Add both to Railway `api` variables and `backend/.env` locally.

```env
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

## Migrations

Local development:

```bash
cd backend
npm run db:migrate:dev    # create/apply migrations in dev
npm run db:generate       # regenerate Prisma client
```

Production (Railway): `railway-start.sh` runs `npx prisma migrate deploy` when `DATABASE_URL` is set.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run db:generate` | Regenerate `@prisma/client` |
| `npm run db:migrate` | Apply pending migrations (`migrate deploy`) |
| `npm run db:migrate:dev` | Dev workflow with `migrate dev` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:backfill` | Copy Redis tasks/metrics/events into Postgres (see below) |

## Backfill Redis → Postgres

Historical Redis data has **no `user_id`**. The backfill script assigns all found tasks to one user (you).

**Prerequisites:**
1. Migrations applied (`npm run db:migrate`)
2. You have signed in once via OAuth (so your `users` row exists)

**Preview (no writes):**
```bash
cd backend
npm run db:backfill -- --github-login=YOUR_GITHUB_USERNAME --dry-run
```

**Run backfill:**
```bash
npm run db:backfill -- --github-login=YOUR_GITHUB_USERNAME
```

Or with UUID: `npm run db:backfill -- --user-id=<uuid-from-/api/auth/me>`

**What gets copied:**

| Redis key | Postgres table |
|-----------|----------------|
| `task:{id}` | `tasks` |
| `metrics:{id}` | `task_metrics` (+ optional `usage_ledger` on done/failed) |
| `events:{id}` | `task_events` |

**Not copied:** sessions (tokens stay in Redis), BullMQ jobs, budget counters, checkpoints (24h TTL).

**Note:** Event keys expire after 24h — only tasks with recent logs will have events. Task/metrics keys last 7 days.

## Health check

```bash
curl https://api.pullwright.iayush.com/health/db
```

- `{"status":"ok","database":"connected"}` — Postgres reachable
- `{"status":"disabled","database":"not_configured"}` — Redis-only mode
- `503` — `DATABASE_URL` set but connection failed

## Schema overview

- **users** — GitHub identity (no tokens)
- **tasks** — one row per agent run, scoped by `user_id`
- **task_steps**, **task_metrics**, **task_events** — plan, snapshot, append-only log
- **plans**, **subscriptions**, **usage_ledger**, **payment_events** — billing stubs (no Stripe yet)

## Event log scale

`task_events` grows with every SSE event. At high volume, add monthly range partitions on `created_at` via a raw SQL migration (Prisma does not manage partitions natively).

## Security

- GitHub `accessToken` stays in Redis sessions only — never written to Postgres.
- All task list/get endpoints filter by `session.userId` when the database is enabled.
