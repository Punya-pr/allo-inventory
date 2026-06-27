# Allo Inventory — Reservation-Based Checkout

A Next.js (App Router) inventory/reservation system that solves the
checkout-race-condition problem described in the brief: stock is held via a
short-lived reservation at checkout time, confirmed (permanently decremented)
on payment success, and released (auto or manual) on failure/timeout/cancel.

## Stack

- **Next.js 14 (App Router)** + **TypeScript** end-to-end
- **Prisma** + **Postgres** (hosted — Supabase/Neon/Railway; not SQLite/local)
- **Redis** (optional) — distributed lock as a throughput optimization, and
  idempotency fast-path. **Not** the correctness mechanism (see below).
- **Zod** — shared validation schema (`src/lib/validation.ts`) used by the
  reservation API route.
- **Tailwind CSS** — styling, no component library, kept it minimal.

## Running locally

1. **Provision a hosted Postgres DB** (any of these have free tiers):
   - Supabase, Neon, or Railway. Grab the connection string.
   - **If using Supabase**: you need *two* connection strings — the pooled
     one (port 6543, `?pgbouncer=true`) for `DATABASE_URL`, and the direct
     one (port 5432) for `DIRECT_URL`, since pgbouncer's transaction mode
     can't run Prisma's migration commands. Both are on the same
     Project Settings → Database page. `prisma/schema.prisma` already has
     `directUrl` wired up for this.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`. `REDIS_URL` and
   `CRON_SECRET` are optional locally.
3. Install deps and set up the schema:
   ```bash
   npm install
   npx prisma migrate dev --name init
   npm run seed
   ```
4. Run the app:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000.

### Demoing the concurrency guarantee

The seed data includes a "Ceramic Mug — Red (Last Unit Demo)" product with
exactly **1 unit** at the Bengaluru warehouse, specifically so you can fire
concurrent requests at it. Two ways to see it:

- **In the UI**: open the product page in two browser tabs and click
  "Reserve" on the mug in both at roughly the same time. One will redirect to
  checkout; the other will show the 409 error inline.
- **Scripted**: `npx tsx scripts/concurrency-test.ts <productId> <warehouseId>`
  fires 10 concurrent `POST /api/reservations` at the same SKU and asserts
  exactly one returns `201`.

## How correctness under concurrency is guaranteed

This is the part the exercise cares about most, so to be explicit:

The reservation endpoint does **not** rely on Redis, in-memory locks, or
"read stock, check if enough, then write" logic — that pattern always has a
race window between the read and the write. Instead, reserving is a single
**atomic, conditional UPDATE** run inside a Postgres transaction:

```sql
UPDATE "Stock"
SET "reservedUnits" = "reservedUnits" + :qty
WHERE "productId" = :productId
  AND "warehouseId" = :warehouseId
  AND ("totalUnits" - "reservedUnits") >= :qty
```

Postgres takes a row lock on the matching `Stock` row for the duration of the
update. If two requests race for the same row, the database itself serializes
them: the first to arrive locks the row and commits; the second blocks until
the first is done, then re-evaluates the `WHERE` clause against the
**now-updated** row. If availability has dropped below the requested quantity,
the `WHERE` clause is false, the statement affects zero rows, and the code
treats `rowCount === 0` as "insufficient stock" → `409`. Exactly one of the
two requests can win, by construction — this isn't dependent on application
process count, server count, or anything else operating "in time."

`confirmReservation` similarly uses one atomic UPDATE that decrements
`totalUnits` and `reservedUnits` together, so the two numbers can never
visibly desync even under concurrent reads.

**Where Redis fits in**: under high contention on a single hot SKU, every
losing request above still has to attempt (and fail) a DB write, which wastes
connections/throughput at scale. `src/lib/redis.ts` adds an optional
short-TTL distributed lock (`SET NX EX`) around the reserve path purely to
reduce that wasted work — most retries get serialized in Redis before they
ever reach Postgres. If `REDIS_URL` is unset, or Redis is briefly down, the
app **falls through to direct DB calls and is still 100% correct** — just
slightly less efficient under heavy load on the same SKU. This separation is
deliberate: I didn't want the actual correctness guarantee to depend on a
component that can fail independently of the database.

## Data model (`prisma/schema.prisma`)

- `Product`, `Warehouse` — straightforward.
- `Stock` — one row per `(productId, warehouseId)`, holding `totalUnits` and
  `reservedUnits`. Available stock is always **derived** (`totalUnits -
  reservedUnits`), never stored, so there's only one place that can go wrong.
- `Reservation` — `status` enum (`pending | confirmed | released | expired`)
  and `expiresAt`. Confirming decrements `totalUnits` (permanent); releasing
  or expiring only undoes the `reservedUnits` hold, leaving `totalUnits`
  untouched.
- `IdempotencyKey` — bonus feature, see below.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products` | Products with available/reserved/total stock per warehouse |
| GET | `/api/warehouses` | List warehouses |
| POST | `/api/reservations` | `{ productId, warehouseId, quantity }` → `201` + reservation, or `409` if insufficient stock |
| GET | `/api/reservations/:id` | Fetch one reservation (used by the checkout page's polling) |
| POST | `/api/reservations/:id/confirm` | `200` on success, `410` if expired, `404` if not found |
| POST | `/api/reservations/:id/release` | Early cancel, idempotent |
| GET | `/api/cron/release-expired` | Sweep job, see below. Protected by `CRON_SECRET` |

## Expiry mechanism

Two layers, both implemented:

1. **Lazy cleanup on read/write** (`releaseExpiredReservations` in
   `src/lib/reservations.ts`): every time a new reservation is attempted for
   a given product/warehouse, expired pending reservations for that
   product/warehouse are swept first, inside the same transaction, before
   availability is checked. This means availability is *never* stale due to
   un-swept expired holds for any SKU someone is actively trying to buy.
   `GET /api/reservations/:id` also lazily reports `expired` status in its
   response even if the row hasn't been swept yet, so the checkout page
   never shows a falsely-still-pending state.
2. **Scheduled sweep** (`/api/cron/release-expired`, wired to Vercel Cron via
   `vercel.json`, running every minute): catches reservations for SKUs that
   nobody happens to touch again, so held units don't sit invisible to
   anyone until eternity. `scripts/release-expired.ts` is the same logic as a
   standalone script, for hosts without Vercel Cron (plain crontab, GitHub
   Actions scheduled workflow, Railway cron, etc).

## Idempotency (bonus, implemented)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` accept an
`Idempotency-Key` header. Implementation in `src/lib/idempotency.ts`:

- On first request with a given key, the handler runs normally; the
  resulting `(statusCode, body)` is stored against that key in the
  `IdempotencyKey` table.
- On a retry with the same key, the stored response is replayed verbatim —
  the handler does **not** re-run, so there's no duplicate reservation /
  duplicate confirm. The response carries an `Idempotent-Replayed: true`
  header so this is observable in dev tools.
- Two concurrent requests with the same fresh key: both attempt to store
  their result; the loser hits the table's `UNIQUE(key)` constraint and
  re-reads what the winner stored, so both callers see the *same* response
  rather than two different ones for what's logically one operation.

The frontend (`src/lib/api-client.ts`) sends a fresh
`crypto.randomUUID()` as the idempotency key on every reserve/confirm call —
a real client would persist the same key across its own retries of one
logical action; I generate one per attempt here for simplicity, which is
enough to demonstrate the mechanism end-to-end.

## Frontend

- `/` — product listing, available stock per warehouse, "Reserve" button.
  A failed reserve (409, lost the race) is shown inline without navigating
  away.
- `/checkout/[id]` — reservation details, live countdown to `expiresAt`,
  "Confirm purchase" / "Cancel" buttons. Polls the reservation every 5s so
  the status reflects server-side expiry even if the tab is just sitting
  open. 409/410 errors from confirm are surfaced directly in the UI, not
  swallowed.

## Trade-offs / what I'd do differently with more time

- **No auth / multi-tenant concept.** Real checkout would tie reservations to
  a session/user and prevent e.g. cancelling someone else's reservation.
  Out of scope here per the brief's focus on the reservation mechanics.
- **Idempotency key generated per-attempt on the client**, not persisted
  across actual network retries (e.g. in `localStorage` keyed by reservation
  intent). Good enough to prove the server-side mechanism works; a real
  client would need a slightly more deliberate retry strategy.
- **No optimistic UI rollback** — actions show a pending state but on error
  just re-fetch from the server rather than maintaining a local
  optimistic state machine. Simpler, and arguably more correct given the
  server is the actual source of truth here.
- **Quantity is fixed at 1** in the UI (the API supports arbitrary
  `quantity`) — multi-quantity cart UX felt like scope creep relative to the
  core ask.
- **Reservation list/admin view** (e.g. "see all pending reservations") isn't
  built — not in the required deliverables, but would be the natural next
  feature for an ops dashboard.
- I used `$executeRaw` for the atomic stock updates rather than Prisma's
  higher-level query builder, because Prisma doesn't currently support
  conditional `UPDATE ... WHERE <expression on other columns>` semantics
  needed for the atomic check-and-decrement in one round trip. I considered
  optimistic concurrency (version column + retry loop) as an alternative —
  it would also be correct, but adds client-visible retry complexity for no
  real benefit over the conditional-UPDATE approach here.

## Deployment

- **App**: Vercel.
- **Postgres**: Supabase/Neon/Railway — set `DATABASE_URL` in Vercel env vars,
  then `npx prisma migrate deploy` (or let it run as part of your build step)
  and `npm run seed` once against the prod DB.
- **Redis** (optional): Upstash — set `REDIS_URL` in Vercel env vars.
- **Cron**: `vercel.json` already declares the `/api/cron/release-expired`
  schedule; set `CRON_SECRET` in env vars to match what Vercel Cron sends.
