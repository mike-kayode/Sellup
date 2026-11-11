# 🛍️ Sell Up — Premium Commerce Platform for African Merchants

Sell Up is a live multi-tenant commerce platform for merchants in Nigeria and beyond. Built with Next.js 16, React 19, TypeScript, Drizzle ORM on PostgreSQL, Tailwind CSS, Zod, and bcrypt.

**Live at:** https://sellup.ng  
**Repository:** https://github.com/mike-kayode/Sellup  
**License:** MIT

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Environment Variables](#environment-variables)
5. [Database & Migrations](#database--migrations)
6. [Deployment](#deployment)
7. [Roadmap & Phases](#roadmap--phases)
8. [API Reference](#api-reference)
9. [Security](#security)
10. [Testing](#testing)
11. [Contributing](#contributing)

---

## Overview

Sell Up empowers African SMEs to create professional online stores in minutes and receive orders directly on WhatsApp. The platform competes with tools like Bumpa by winning in six areas:

1. **Premium storefront design & SEO** — dark/light modes, sticky mobile cart, JSON-LD SEO, per-host sitemap
2. **Real per-merchant buyer accounts** — separate accounts per merchant, email/phone registration, wishlist, order tracking
3. **Deep inventory analytics** — multi-location stock, append-only ledger, reorder points, FIFO costing, Recharts reports
4. **First-class developer platform** — merchant API keys, webhooks with HMAC-SHA256 signatures, custom domains
5. **Unified social inbox** — WhatsApp, Instagram DMs, Messenger, web chat in one view with convert-to-order
6. **Built-in AI** — product copy from photos, storefront assistant, restock suggestions, weekly digest

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare (DNS + TLS)                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
    ┌──────────────▼──────────────┐
    │  try.sellup.ng              │ Marketing site (landing)
    │  sellup.ng                  │ Merchant app (login, dashboard)
    │  {slug}.sellup.ng           │ Storefronts (subdomain mode)
    │  custom-domain.com          │ Custom domains (Cloudflare SaaS)
    └──────────────┬──────────────┘
                   │
    ┌──────────────▼──────────────┐
    │     Next.js 16 + Passenger   │ cPanel shared hosting
    │     (Node 24, CloudLinux)    │ 50 process cap
    └──────────────┬──────────────┘
                   │
    ┌──────────────▼──────────────┐
    │   Supabase PostgreSQL 13    │ Primary database
    │   Supabase Auth             │ Merchant authentication
    └─────────────────────────────┘
```

### Key Design Decisions

| Concern | Decision |
|---------|----------|
| **Tenant column** | `store_id` referencing `businesses.id` |
| **Merchant Auth** | Supabase Auth (JWT) |
| **Buyer Auth** | bcrypt + HttpOnly/Secure/SameSite=Lax cookies named per store |
| **Money** | Stored as decimal strings, computed in minor units (`toMinorUnits`/`fromMinorUnits`) |
| **Background work** | Cron-triggered, secret-protected endpoints (no long-running processes) |
| **Rate limiting** | Database-backed counters (survives cPanel restarts) |
| **Hosting** | cPanel shared hosting, LiteSpeed/Passenger, no always-on workers |

---

## Getting Started

### Prerequisites

- Node.js 24+
- PostgreSQL 13+ (Supabase recommended)
- A Supabase project with Auth enabled
- A Resend account (email)
- A WhatsApp Business API account (optional, for WhatsApp notifications)

### Installation

```bash
# Clone the repository
git clone https://github.com/mike-kayode/Sellup.git
cd Sellup

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Run database migrations (in order)
psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0000_dear_otto_octavius.sql
psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0001_wide_jean_grey.sql
# ... apply all migration SQL files in order (0000 through 0045)
# Or use the helper scripts:
npm run db:phase1    # Phase 1 business migration
npm run db:storefront # Storefront template system

# Seed the database (optional)
npm run seed

# Run typecheck (required before deploy)
npm run typecheck

# Build for production
npm run build

# Start the app
npm start
# Or for cPanel:
npm run start:cpanel
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# ===== Application =====
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://sellup.ng
API_URL=https://sellup.ng
NEXT_PUBLIC_BASE_DOMAIN=sellup.ng
NEXT_PUBLIC_STORE_SUBDOMAINS=false  # Set to "true" when wildcard DNS is live

# ===== Supabase =====
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ===== Database =====
DATABASE_URL=postgresql://...

# ===== Payments =====
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
FLUTTERWAVE_SECRET_KEY=...
FLUTTERWAVE_PUBLIC_KEY=...

# ===== Email (Resend) =====
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@sellup.ng
RESEND_FROM_NAME=Sell Up

# ===== SMS =====
TERMII_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# ===== WhatsApp =====
WHATSAPP_API_URL=https://...
WHATSAPP_API_KEY=...
WHATSAPP_FROM_NUMBER=...

# ===== AI (Phase 8) =====
ENCRYPTION_MASTER_KEY=32-byte-base64-key
AI_API_KEY=sk-...
AI_API_BASE=https://api.openai.com/v1

# ===== Platform Admin =====
PLATFORM_ADMIN_EMAIL=admin@sellup.ng
PLATFORM_ADMIN_PASSWORD=...

# ===== Cron (Phase 6) =====
CRON_SECRET=your-secret-here

# ===== Cloudflare custom-hostname TLS retries =====
CLOUDFLARE_API_TOKEN=token-with-custom-hostname-edit-permission
CLOUDFLARE_ZONE_ID=your-zone-id
```

Subscription dunning does not charge stored cards: the hourly worker creates
hosted Paystack/Flutterwave renewal links and sends reminders. Staff MFA
enforcement should only be enabled after every active admin has verified an
authenticator factor.


---

## Database & Migrations

All database changes are additive, idempotent SQL files in `drizzle/00NN_name.sql`, written for PostgreSQL 13, applied with `psql -v ON_ERROR_STOP=1 --single-transaction -f`.

**Never run `drizzle-kit push` or `drizzle-kit migrate` against the live database.**

### Migration Files

| File | Description |
|------|-------------|
| `0000_dear_otto_octavius.sql` | Core tables (analytics, categories, coupons, customers, orders, products, stores, staff) |
| `0001_wide_jean_grey.sql` | API keys, audit logs, domains, webhooks, plans, subscriptions |
| `0002_tiny_emma_frost.sql` | Admin memberships |
| `0003_flippant_union_jack.sql` | Analytics events |
| `0004_order_idempotency.sql` | Idempotency key on orders |
| `0004_storefront_v1.sql` | Storefront template system |
| `0005_businesses.sql` | Renamed stores → businesses |
| `0006_add_template.sql` | Template column on businesses |
| `0007_email_verifications.sql` | Email verification codes |
| `0008_cpanel_images.sql` | Image metadata |
| `0009_add_store_id_to_audit_logs.sql` | Phase 0: store_id on audit_logs |
| `0010_rate_limit_counters.sql` | Phase 0: DB-backed rate limits |
| `0011_buyer_accounts_core.sql` | Phase 1: buyer password/sessions |
| `0012_rename_store_owner_role_to_merchant.sql` | Phase 1: role migration |
| `0013_inventory_locations.sql` | Phase 3: stock locations |
| `0014_product_variants.sql` | Phase 3: product variants |
| `0015_stock_levels.sql` | Phase 3: stock levels per location |
| `0016_stock_movements.sql` | Phase 3: append-only stock ledger |
| `0017_suppliers_purchase_orders.sql` | Phase 3: suppliers + purchase orders |
| `0018_reorder_points.sql` | Phase 3: reorder points |
| `0019_domains_cloudflare.sql` | Phase 4: Cloudflare domain fields |
| `0020_integration_connections.sql` | Phase 5: integration connections |
| `0021_api_keys_merchant.sql` | Phase 6: merchant API keys |
| `0022_webhook_deliveries.sql` | Phase 6: webhook delivery log |
| `0023_invoices.sql` | Phase 7: invoices/quotes/receipts |
| `0024_invoice_items.sql` | Phase 7: invoice line items |
| `0025_shipping.sql` | Phase 7: shipping zones/rates |
| `0026_expenses.sql` | Phase 7: expenses/P&L |
| `0027_loyalty_referrals.sql` | Phase 7: loyalty/referrals |
| `0028_ai_providers.sql` | Phase 8: AI providers/quotas/generations |
| `0029_international_readiness.sql` | Phase 9: currency/timezone/locale/tax |
| `0030_admin_overview.sql`–`0043_announcement_delivery_worker.sql` | Superadmin dashboard modules and bounded announcement delivery |
| `0044_subscription_dunning.sql` | Bounded hosted-checkout renewal reminders |
| `0045_admin_sessions.sql` | Admin session inventory and revocation |

### Schema Drift Check

Before every deploy, verify the schema matches the database:

```bash
DATABASE_URL=your-db-url npm run db:drift
```

This compares every declared column in `src/db/schema.ts` against `information_schema` and exits non-zero on any mismatch.



---

## Deployment

The app is hosted on cPanel shared hosting (CloudLinux, LiteSpeed/Passenger, Node 24, roughly 50 process/thread cap, no always-on workers) behind Cloudflare. The server skips TypeScript checking — **always run typecheck and a production build before every deploy**.

### Deploy Process

1. **Commit SQL files** in `drizzle/`
2. **Back up** with `pg_dump`
3. **Apply SQL before code**
4. **Run `./deploy.sh`**
5. **Smoke test**

```bash
# 1. Commit SQL files
git add drizzle/00NN_name.sql
git commit -m "Phase X: description"
git push

# 2. Back up the database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 3. Apply SQL migrations
psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/00NN_name.sql

# 4. Typecheck and build
npm run typecheck
npm run build

# 5. Deploy
./deploy.sh

# 6. Smoke test
curl -s -o /dev/null -w '%{http_code}' https://sellup.ng/api/health
# Expect: 200
```

### Cron Jobs

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/webhook-deliveries` | Every minute | Drain due webhook deliveries (bounded batch) |
| `/api/cron/subscription-dunning` | Hourly | Mark expired subscriptions past due and send due hosted renewal links (bounded batch) |
| *(custom)* | Every 15 min | Re-check domain DNS verification |
| *(custom)* | Daily | Abandoned cart recovery |
| *(custom)* | Weekly | AI weekly digest |

Cron endpoints require a `CRON_SECRET` header for security.


---

## Roadmap & Phases

The platform is built in 10 phases. Each phase is implemented, tested, and reviewed before moving to the next.


---

## API Reference

### Authentication

#### Merchant (Store Owner) Auth — Supabase
- `POST /api/auth/login` — Merchant login via Supabase Auth
- `POST /api/auth/register` — Merchant registration
- `POST /api/auth/verify` — Email verification code
- `POST /api/auth/resend-code` — Resend verification code
- `POST /api/auth/logout` — Logout

### Buyer (Customer) Auth — Per-Merchant
- `POST /api/customer/register` — Buyer registration (email or phone)
- `POST /api/customer/login` — Buyer login
- `POST /api/customer/logout` — Buyer logout
- `POST /api/customer/verify-email` — Email verification
- `POST /api/customer/send-whatsapp-code` — WhatsApp verification code
- `POST /api/customer/verify-whatsapp` — WhatsApp verification
- `POST /api/customer/forgot-password` — Password reset request
- `POST /api/customer/reset-password` — Password reset
- `GET /api/customer/me` — Get current buyer session

### Orders
- `POST /api/orders/create` — Create order (guest or logged-in buyer)
- `GET /api/orders` — List orders (tenant-scoped)

### Products
- `GET /api/store/[slug]/products/[productId]` — Get single active product
- `POST /api/products/list` — List products (merchant auth required)

### Developer API (Phase 6)

#### Merchant API Keys
- `POST /api/merchant/api-keys` — Create API key (returns raw key **once**)
- `GET /api/merchant/api-keys` — List API keys (no raw key exposed)
- `POST /api/merchant/api-keys/[id]` — Rotate or revoke a key

#### Webhooks
- `POST /api/merchant/webhooks` — Create webhook endpoint
- `POST /api/merchant/webhooks/[id]` — Toggle webhook active/inactive
- `POST /api/cron/webhook-deliveries` — Secret-protected cron: drain due deliveries

### Admin (Platform Staff)

#### Store/Buyer Management
- `GET /api/admin/users` — Cross-merchant users list

---

## Security

### Tenant Isolation

- Every merchant-owned row carries `store_id` referencing `businesses.id`
- Composite foreign keys ensure child rows belong to the same store as parent
- Client-supplied store IDs are **never trusted**; store is derived from session
- Every query checks ownership on both parent and child rows

### Authentication

| Role | Method | Session |
|------|--------|---------|
| Merchant | Supabase Auth (JWT) | Supabase cookie |
| Buyer | bcrypt + cookie | HttpOnly/Secure/SameSite=Lax per store |
| Platform Staff | Supabase Auth (JWT) | Admin role check |

- Buyer sessions: random token; only SHA-256 hash stored; idle (7d) + absolute (30d) expiry; revoke all on password change
- Fail-closed on any auth/lookup failure

### Rate Limiting

- Database-backed counters for auth and API endpoints
- 10 requests per 15 minutes for auth endpoints
- Falls back to in-memory only during DB outage

---

## Testing

```bash
# Typecheck (required before deploy)
npm run typecheck

# Production build
npm run build

# Schema drift check
DATABASE_URL=your-db-url npm run db:drift

# Health check
curl -s -o /dev/null -w '%{http_code}' https://sellup.ng/api/health
# Expect: 200
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # Merchant auth (Supabase)
│   │   ├── customer/          # Buyer auth
│   │   ├── orders/            # Order creation
│   │   ├── store/[slug]/      # Public storefront APIs
│   │   ├── merchant/          # Merchant dashboard APIs
│   │   ├── admin/             # Platform staff APIs
│   │   ├── ai/                # AI generation + usage
│   │   └── cron/              # Cron-triggered jobs
│   ├── [slug]/                # Public storefront pages
│   └── ...
├── components/
│   ├── storefront/            # Storefront components
│   └── store-templates/       # Storefront themes
├── db/
│   ├── schema.ts              # Drizzle schema (source of truth)
│   └── index.ts               # Database client
├── lib/
│   ├── auth.ts                # Supabase auth helpers
│   ├── merchant-auth.ts       # Merchant session auth (fail-closed)
│   ├── customer-auth.ts       # Buyer session management
│   ├── staff-rbac.ts          # Staff permission matrix
│   ├── admin-auth.ts          # Platform admin auth (fail-closed)
│   ├── admin-audit.ts         # Audit logging
│   ├── rate-limit.ts          # DB-backed rate limiting
│   ├── security.ts            # Encryption, CSRF, XSS helpers
│   ├── encryption.ts          # AES-256-GCM encryption
│   ├── whatsapp-chat.ts       # Floating WhatsApp widget
│   ├── whatsapp.ts            # WhatsApp send helper
│   ├── email.ts               # Resend email helper
│   ├── payment.ts             # Paystack/Flutterwave
│   ├── inventory.ts           # Transactional stock ledger
│   ├── dns-verification.ts    # DNS verification for domains
│   ├── custom-domains.ts      # Custom domain resolution
│   ├── ai-wrapper.ts          # Provider-agnostic AI wrapper
│   └── utils.ts               # Money formatting, slug generation
├── proxy.ts                   # Subdomain + custom domain routing
└── middleware.ts              # Next.js middleware
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Follow the phase-based development model
4. Write additive, idempotent SQL migrations for any DB changes
5. Run `npm run typecheck` and `npm run build` before committing
6. Run schema-drift check against the database (`npm run db:drift`)
7. Commit with descriptive message
8. Push and open a pull request

### Commit Convention

```
Phase N: Descriptive summary

- Details of what was changed
- SQL migrations added
- New env vars
- How to test
- Rollback steps
- Risks
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Support

- **Email:** admin@sellup.ng
- **WhatsApp:** +234XXXXXXXXXX
- **Issues:** https://github.com/mike-kayode/Sellup/issues

---

**Built with ❤️ for African entrepreneurs.**


### Tenant Isolation Tests

Automated tests must prove:

- Merchant A cannot read or change Merchant B's data through any route, API key, or webhook
- Buyer A cannot read or change Buyer B's data at a different merchant
- API keys are scoped to their store; cross-store access is denied
- Webhook deliveries are scoped to their originating store


### Webhooks

- HMAC-SHA256 signature over `timestamp + body` with per-endpoint secret
- 5-minute replay window; constant-time comparison
- Exponential backoff retries (1m, 5m, 30m, 2h, 12h)
- Automatic disable after repeated failures; manual redelivery

### Secrets

- No secrets logged or hard-coded
- All secrets in environment variables only
- AES-256-GCM with random IV and versioned key for token encryption

- `GET /api/admin/buyers` — Cross-merchant buyers list

#### AI Providers (Phase 8)
- `GET /api/admin/ai/providers` — List AI providers
- `POST /api/admin/ai/providers` — Create AI provider
- `GET/PUT/DELETE /api/admin/ai/providers/[id]` — Get/update/delete provider

#### Impersonation (Superadmin Only)
- `POST /api/admin/impersonation` — Impersonate a merchant

#### Subscriptions/Dunning
- `POST /api/admin/subscriptions/dunning` — Mark past-due subscriptions

#### Content Moderation
- `GET /api/admin/moderation` — List flagged products
- `POST /api/admin/moderation` — Flag/suspend/remove a product

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 0** | Safety net — schema drift, audit store_id, DB rate limits, fail-closed auth | ✅ Complete |
| **Phase 1** | Merchants, buyers, permissions — buyer accounts, staff RBAC | ✅ Complete |
| **Phase 2** | Premium storefront — WhatsApp widget, dark/light mode, SEO, PWA | ✅ Foundation complete |
| **Phase 3** | Advanced inventory — multi-location, ledger, purchase orders | ✅ Complete |
| **Phase 4** | Custom domains — DNS verification, Cloudflare for SaaS | ✅ Complete |
| **Phase 5** | Integrations hub — Meta, TikTok, WhatsApp, Google | ✅ Foundation complete |
| **Phase 6** | Developer platform — API keys, webhooks with retries | ✅ Complete |
| **Phase 7** | Sales operations — invoices, shipping, expenses, loyalty | ✅ Complete |
| **Phase 8** | AI features — product copy, assistant, insights | ✅ Complete |
| **Phase 9** | International readiness — currency, tax, exchange rates | ✅ Complete |
| **Phase 10** | Platform administration — impersonation, dunning, moderation | ✅ Complete |

### Phase Details

**Phase 0 — Safety Net**
- Schema-drift check script (`scripts/drift-check.cjs`) + `db:drift` npm script
- `store_id` added to `audit_logs` for per-merchant audit entries
- Database-backed rate limit counters replacing in-memory limits
- `requireAdmin` fails closed on permission lookup failure

**Phase 1 — Merchants, Buyers & Permissions**
- Store-owner role renamed to `merchant`; existing rows migrated
- Buyer accounts per merchant: register (email/phone), login, logout, email verification, forgot/reset password, optional WhatsApp verification
- Sessions: random token in HttpOnly/Secure/SameSite=Lax cookie per store; SHA-256 hash stored only; idle/absolute expiry; revoke all on password change
- Merchant staff RBAC: owner/manager/cashier/fulfilment/marketer with server-side permission matrix

**Phase 2 — Premium Storefront**
- Floating WhatsApp chat button with context-aware prefill
- Premium templates: dark/light modes, sticky mobile cart, quick view, filters, search suggestions, galleries with zoom/video, variants, reviews, wishlist, related products, announcement bar, trust badges
- SEO: unique titles/descriptions, Open Graph, JSON-LD, per-host sitemap.xml/robots.txt, canonical URLs
- PWA per store; back-in-stock alerts

**Phase 3 — Advanced Inventory**
- Multi-location stock, transfers, stock-takes with variance reports
- Suppliers and purchase orders (draft → received)
- Reorder points, low-stock alerts, checkout reservations with expiry
- Stock ledger (append-only): sale, return, purchase, adjustment, transfer, damage, reservation
- Average cost / FIFO costing, COGS, gross margin, stock valuation

**Phase 4 — Custom Domains**
- Add domain with DNS records (CNAME/A/ALIAS + TXT ownership token)
- TXT ownership verification before activation
- TLS via Cloudflare for SaaS; poll SSL status from cron
- 301 platform subdomain to primary custom domain

**Phase 5 — Integrations Hub**
- Provider interface: connect/disconnect/health/refresh/webhook intake
- Meta (FB/IG), TikTok, WhatsApp Business, Google, Mailchimp/Brevo
- Unified inbox with conversation assignment and convert-to-order

**Phase 6 — Developer Platform**
- Merchant API keys: create/rotate/revoke with scopes and expiry
- Public REST API under `/api/v1` with cursor pagination, filtering, idempotency keys
- Webhooks: event catalog, HMAC-SHA256 signatures, exponential-backoff retries, delivery log UI

**Phase 7 — Sales Operations**
- POS for phone/tablet with barcode scan and split payments
- Invoices/quotes/receipts as branded PDFs with payment links
- Coupons, discount engine, loyalty points, referrals
- Delivery zones, tracking, finance (expenses, P&L, VAT)

**Phase 8 — AI Features**
- Product copy/SEO from photo or words; background cleanup
- Storefront assistant (catalog-based Q&A with WhatsApp handoff)
- Merchant assistant (sales/stock queries in plain language)
- Restock suggestions, pricing hints, anomaly alerts, weekly digest
- Provider-agnostic wrapper with per-store quotas and cost caps

**Phase 9 — International Readiness**
- Per-store currency (ISO 4217), country, timezone, locale
- Money-formatting helper used everywhere (no hard-coded naira symbols)
- Phone numbers/addresses by country (libphonenumber)
- Gateway selection by country
- Translated UI (English first)

**Phase 10 — Platform Administration**
- Superadmin modules with smoke test on every release
- Merchant impersonation with audit trail
- Plan/billing management with subscription dunning
- Content moderation and fraud signals
- Backup/restore tools, notification centre
