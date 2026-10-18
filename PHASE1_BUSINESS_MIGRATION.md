# Phase 1 — Business-Centric Migration

SellUp is now designed around **businesses**, not stores. This document covers
what Phase 1 changed and what you must run when the database is back online.

## URL architecture

| Surface | URL |
|---|---|
| Marketing / landing | `https://try.sellup.ng` |
| Login + dashboard (merchant app) | `https://app.sellup.ng` |
| Public business pages | `https://sellup.ng/{business_slug}` |
| Legacy URLs (redirect) | `sellup.ng/store/{slug}` → `sellup.ng/{slug}` |

Routing is implemented in `src/proxy.ts` (Next 16 proxy convention):

- Requests are classified by **host** (`app.`, `try.`, apex) and by the first
  path segment (app route / marketing route / business slug).
- Cross-host mismatches redirect to the canonical host.
- In local development the base domain is `localhost`: bare
  `localhost:3000` serves everything directly (old workflow unchanged), while
  `app.localhost:3000` and `try.localhost:3000` simulate production behavior.
- Configure the base domain with `NEXT_PUBLIC_BASE_DOMAIN` (default
  `sellup.ng`). In production set `NEXT_PUBLIC_APP_URL=https://app.sellup.ng`
  so verification emails and payment callbacks land on the app subdomain.

DNS for production: point `try` and `app` CNAME/A records at the same host as
`sellup.ng` (wildcard `*.sellup.ng` also works for future subdomains).

## Data model

- The `stores` table is now the **`businesses`** table.
- New column: `business_type` with values `product` | `service` | `both`
  (default `product`).
- In `src/db/schema.ts` the canonical export is `businesses`;
  `stores` remains as a deprecated alias so existing code keeps compiling.

### ⚠️ Applying the migration (required)

The Supabase project referenced by `DATABASE_URL` was unreachable while this
migration was prepared (`tenant/user ... not found`), so the SQL has **not**
been applied yet. When the database is available, run ONE of:

```bash
npm run db:phase1      # idempotent helper (safe to re-run, recommended)
# or
npm run db:migrate     # runs drizzle/0005_businesses.sql via drizzle-kit
```

> **Do not run `npm run db:push` before applying this migration.** With the
> schema now named `businesses`, a push against an old database that still has
> `stores` could drop data. Apply `db:phase1`/`db:migrate` first; afterwards
> `db:push` sees no difference.

`drizzle/meta/_journal.json` was also repaired (it contained invalid JSON, a
duplicate `0003` entry, and a duplicated `breakpoints` key).

## Business type

- Onboarding now starts with **“What does your business offer?”**
  (`product` / `service` / `both`), stored on the business record.
- Service businesses skip the product step, publish immediately, and get a
  WhatsApp-first public page (no product grid, no cart).
- `businessType` can be changed later via `PUT /api/stores/update`.

## Reserved slugs

`src/lib/slugs.ts` now exports `RESERVED_BUSINESS_SLUGS` built from
`APP_ROUTE_SLUGS`, `MARKETING_ROUTE_SLUGS` and `SYSTEM_SLUGS` — every platform
route is blocked at the root level. Validation entry point:
`validateBusinessSlug` (old names `RESERVED_STORE_SLUGS` /
`validateStoreSlug` kept as aliases).

## Not in Phase 1 (planned)

Services/Bookings/Availability systems, reviews, verification badges, SEO
metadata per business, dashboard nav that adapts to `businessType`, and
rename of remaining `store*` code identifiers.
