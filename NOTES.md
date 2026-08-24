# Notes

## Database schema, and why

Normalised around the real-world entities: `User`, `Centre`, `Farmer`,
`PriceList` + `PriceListEntry`, `Delivery`, `AuditLogEntry`, plus
`CentreCapacity` and `CentreStock` as separate tables from `Centre` itself.

The two decisions that shape everything else:

- **`Delivery.priceListId` is a hard foreign key to the exact `PriceList` row
  the delivery was priced against**, and `PriceList`/`PriceListEntry` rows are
  never updated or deleted after creation — only inserted. This is what makes
  "publishing a new price list must never change what an already-recorded
  delivery is worth" a data-integrity guarantee rather than an application
  convention someone could accidentally violate later.
- **`CentreStock` is a materialized running total**, not a value computed by
  summing deliveries on every read. It's kept correct by updating it inside
  the same transaction as every delivery insert (see concurrency section
  below), which keeps the capacity check O(1) instead of scanning history.

Indexes are on every column the brief's filters touch (`centreId`, `farmerId`,
`status`, `produceType`, `deliveryDate`, and a composite `(centreId, status)`
for the verification queue's most common query shape).

## Prices changing over time

`getEffectivePriceList()` picks the most recently published list whose
`effectiveFrom <= deliveryDate`. This is only ever consulted **at record
time**; the resulting `priceListId` is then stored on the `Delivery` row
permanently. A test (`effectiveDatePricing.test.ts`) proves this directly: it
records a March delivery, publishes a new list effective in April, and asserts
the March delivery's stored price is untouched — while a fresh lookup for a
date in April correctly picks up the new rate.

## Stock correctness under concurrency

Two places needed this: capacity checks on recording, and preventing a
double-payment. Both use the same pattern — a single atomic, conditional SQL
`UPDATE` instead of a separate read-check-write:

```sql
UPDATE "CentreStock" SET "quantityKg" = "quantityKg" + $net
WHERE ... AND "quantityKg" + $net <= capacityKg
```

If two deliveries race for the same centre/produce, Postgres row-locks the
`CentreStock` row during the `UPDATE`; the second transaction's `WHERE`
clause is evaluated against the *already-updated* value once the first
commits, so it's impossible for both to slip past capacity. If the condition
fails, 0 rows are affected and the app returns `CENTRE_CAPACITY_EXCEEDED`.
The delivery status transition (`transitionDelivery.ts`) uses the identical
technique — `UPDATE ... WHERE status = <expected current status>` — so a
double-clicked "pay" button can never pay a delivery twice.

## What I'd improve with another day

- Rate limiting / brute-force protection on login.
- A materialized "farmer total earnings" column (currently computed on read
  in the farmer profile endpoint) if farmer histories get long.
- Optimistic UI updates on the verification queue instead of a full reload
  after each action.
- More exhaustive API tests (capacity-exceeded race, reject-then-verify
  invalid transition, price list with a future-only effective date).
- A proper design-system pass on the frontend (current styling is
  intentionally restrained given the time budget).

## Assumptions made where the brief was unclear

- **Weight precision**: the brief's prose said "store weights as integers,"
  but its own worked example uses fractional kg (45.5 / 2.5). Confirmed
  directly with the person who gave me this assessment that decimal weights
  are fine — implemented as `Decimal(10,3)` (gram precision), never `Float`,
  so there's still no floating-point representation drift. Money remains
  strictly integer RWF throughout, computed from integer-gram arithmetic so
  it's never derived from an already-rounded weight.
- **Auth mechanism**: brief allowed either session or JWT; chose JWT in an
  httpOnly cookie for simplicity (no session-store infrastructure needed).
- **Managers aren't tied to one centre**: the brief restricts clerks to their
  assigned centre but says managers "view all centres" — modeled `centreId`
  as nullable on `User`, required only for clerks.
- **Admins can record deliveries**: the brief doesn't explicitly grant this,
  but "Admin: Everything, plus..." reads as a superset of Manager and Clerk
  permissions, so admins can both record and verify (never their own entry,
  same rule as clerks).
- **Quote endpoint doesn't check farmer/capacity**: `/api/deliveries/quote`
  only validates weight and pricing, since its purpose is showing a figure
  before farmer/centre are necessarily confirmed. Those checks still run at
  actual record time.
- **Supabase pooler needs `pgbouncer=true`**: Supabase's connection pooler
  (port 6543) runs PgBouncer in transaction mode, which doesn't support
  Prisma's default prepared-statement usage — without `?pgbouncer=true` on
  `DATABASE_URL`, some queries hang instead of failing fast. Documented in
  `.env.example`.
