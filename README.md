# Cooperative Delivery & Payment System

A web application for an agricultural cooperative to record farmer deliveries,
verify and pay them, and keep an accurate running picture of stock at each
collection centre.

Built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL (Supabase).

## Setup (three commands)

Requires Node.js 20+ and a Postgres database (a free [Supabase](https://supabase.com)
project works well — grab the connection string from **Project Settings →
Database → Connection string → URI**).

```bash
cp .env.example .env  
npm install && npm run prisma:migrate && npm run prisma:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> If you don't have a Postgres instance handy, `npx supabase start` after
> installing the [Supabase CLI](https://supabase.com/docs/guides/cli) will run
> one locally via Docker — use the local connection string it prints.

## Seeded login details

The seed script creates one account per role, all with the same password:

| Role    | Email          | Password       |
|---------|----------------|----------------|
| Clerk   | clerk@coop.rw  | Password123!   |
| Manager | manager@coop.rw| Password123!   |
| Admin   | admin@coop.rw  | Password123!   |

The clerk account is assigned to the Kigali Collection Centre. Seed data also
includes 4 centres, 20 farmers (one suspended, `MEM-1008`), two price lists
with different effective-from dates, and deliveries spanning every status.

## Running tests

```bash
npm test
```

Unit tests for the payment calculation module (`src/lib/payment`) run against
no external dependencies. The API-level tests and the price-list
effective-date test are **database-backed integration tests** — they create
and clean up their own fixture rows against whatever `DATABASE_URL` is set.
To avoid running them against your dev database, copy `.env.example` to
`.env.test` too and point it at a disposable test database (or the same
Supabase project's database if you don't mind test rows briefly existing —
tests clean up after themselves in `afterAll`).

```bash
cp .env.example .env.test   
npm run prisma:migrate      
npm test
```

## Deployed link

Not deployed for this submission — see "Setup" above for the three-command
local run. (If you'd like me to deploy it to Vercel/Railway, I can do that as
a follow-up.)

## Project structure

```
prisma/schema.prisma        Database schema
prisma/seed.ts               Seed script
src/lib/payment/             Pure payment calculation module (no DB access)
src/lib/priceList/           Effective-date price list lookup
src/lib/delivery/            Delivery recording + status transition services
src/lib/auth.ts, session.ts  Auth (JWT) and server-side authorization helpers
src/lib/validation.ts        Zod schemas for every API input
src/app/api/                 API routes
src/app/                     Frontend pages (App Router)
src/components/              Shared UI components
```

## Use of AI tools

I used Claude for general code review as I built. All architecture
decisions (schema design, the pure payment module, the atomic-update
concurrency approach, the JWT auth flow) were made and understood by me, and
I'm happy to explain or modify any part of the codebase in a follow-up
conversation.

## Assumptions

See `NOTES.md` for the full list of assumptions made where the brief was
ambiguous, plus the schema design rationale, how price-over-time and
concurrency correctness were handled, and what I'd improve with another day.
