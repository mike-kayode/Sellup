# Sell Up Storefront Template: System Design

**By Nefxbie Tech. Version 1.0.**

## 1. Goal

One mobile storefront template that every Sell Up merchant uses, whether they sell fashion, food, groceries, perfumes or anything else. The customer-facing result must match the approved reference design (the green "Bella's Store" screen) exactly. Merchants change content and brand color only. They never change the layout.

## 2. Design fidelity spec (locked)

These values define the look and are not merchant-editable.

- **Frame**: mobile-first, designed at 390px wide, fluid from 320px to 480px. On larger screens the store stays centered in a phone-width column.
- **Header**: circular logo (46px), business name in bold with a verified badge, tagline below in small muted text, search icon and cart icon on the right. The cart shows a count badge.
- **Hero**: soft brand-tint gradient banner, about 176px tall. Bold two-line title on the left, short subtitle, pill "Shop Now" button. Product imagery sits on the right.
- **Category chips**: four round chips (All plus three categories), 56px circles. The active chip uses the soft brand tint and brand-colored icon and label.
- **Featured Products**: section title on the left, "See All" on the right. Two-column grid with 14px side padding and 12px gaps. Each card has a rounded image area (14px radius), product name, bold Naira price and a round add-to-cart button in the soft brand tint.
- **Bottom menu**: Home, Categories, Orders, Account. The active item uses the brand color and a filled icon. Inactive items are slate grey.
- **Type**: one rounded geometric sans family. Page titles 22px/800, section titles 17px/800, body 13–15px, labels 12px.
- **Shape**: 14–16px card radius, pill buttons, no heavy shadows.

## 3. Powered by Sell Up footer mark

A small "Powered by Sell Up" line sits inside the bottom menu bar, below the four items.

- **Style**: uppercase, 8.5px, bold, wide letter spacing, centered.
- **Engraved effect**: text color at about 20% opacity, a 1px white highlight below the text and a faint dark edge above it.
- **Never clickable, never selectable**, ignores touch (`pointer-events: none`).
- **Always present** on every page. Merchants cannot remove or restyle it. Only a future white-label plan could hide it (server-side flag).
- Reserve 24px of extra space at the bottom of the menu bar so the mark never overlaps labels.

## 4. Architecture fit

The template is added to the existing merchant system as a rendering layer, not a new product.

1. **Template registry**: one `store_templates` table (`template_id`, `version`, `status`). Version 1 is this design.
2. **Store config**: one record per merchant (draft and published copies).
3. **Renderer**: a single `render(config, theme)` component used by the live storefront and the setup preview, so the preview can never drift from the real store.
4. **Existing services reused**: catalog, orders, customers and payments stay as they are.
5. **Hosting**: published configs are cacheable at the edge. Images are resized on upload.

## 5. Store config schema

```json
{
  "template": "storefront-v1",
  "vertical": "fashion|food|grocery|perfume|general",
  "brand": { "name": "", "logo": "", "tagline": "", "color": "#16A34A", "verified": true },
  "hero": { "title": "", "subtitle": "", "cta_label": "Shop Now", "cta_target": "category|product|url", "images": [] },
  "categories": [{ "id": "", "name": "", "icon": "preset-key|upload" }],
  "contact": { "whatsapp": "", "phone": "", "address": "", "hours": "" },
  "delivery": { "zones": [{ "name": "", "fee": 0 }], "pickup": true },
  "payments": { "paystack": true, "flutterwave": false, "transfer": true, "cod": true },
  "order_statuses": ["Pending", "Confirmed", "Out for delivery", "Delivered"]
}
```

Products live in the existing catalog (`category_id`, `price` integer naira, `images`, `stock`). Prices are formatted as ₦ on the client.

## 6. Theming engine

The merchant picks one hex color. The system derives every other color.

| Token | How it is derived | Used for |
| --- | --- | --- |
| `--brand` | merchant color | buttons, active nav, links |
| `--brand-soft` | same hue, ~92% lightness | active chip, add-to-cart, hero tint |
| `--brand-deep` | same hue, ~16% lightness | headings, icons, logo letter |
| `--on-brand` | white or dark, whichever is readable | text on brand buttons |

If the chosen color fails 4.5:1 contrast against its button text, the text color flips automatically. Very pale colors are rejected with a message asking the merchant to pick a darker shade.

## 7. Screens

Home, Categories, Product detail, Cart & checkout, Orders (four-step progress from `order_statuses`), Account. All share the same header tokens, 16px page padding, 48px touch targets, skeleton loaders and friendly empty states.

## 8. Vertical presets

Fashion / Food / Groceries / Perfumes / General. A preset only changes default labels, category icons, hero copy and the suggested brand color. The layout never changes. Chosen at onboarding; everything stays editable.

| Vertical | Default categories | Card extras |
| --- | --- | --- |
| Fashion | Fashion, Beauty, Home | size, color |
| Food and restaurants | Meals, Drinks, Snacks | prep time, add-ons, open/closed badge |
| Groceries | Fresh, Pantry, Drinks | unit (kg, pack), quantity stepper |
| Perfumes | Men, Women, Unisex | size (ml), scent notes |

## 9. Merchant setup and setup preview

- **Live phone preview** renders the real storefront component from the unsaved draft.
- **"Preview on my phone"** opens a private tokenized link (`/preview/{token}`), 24h expiry, noindex.
- **Publishing** copies the draft to the live config. The last 10 published versions are kept (`store_config_revisions`) for one-tap rollback.
- Validation at upload: logo square (min 256px), hero image 16:9 or 2:1, files under 2 MB.

## 10. API surface

- `GET /api/store/{slug}/config` — published config + derived theme (cacheable).
- `GET/PUT /api/merchant/store-config` — draft (auth + ownership).
- `POST /api/merchant/store-config/publish` — draft → live + revision.
- `POST /api/merchant/store-config/preview-token` — 24h private link.

## 11. Performance and quality

First load under 2s on Nigerian 4G; offline-tolerant device cart; visible focus and labelled icon buttons; contrast checked on every brand color; customer data private per store.

## 12. Rollout

1. Renderer + theming engine behind the `storefront_v1` feature flag (default ON; an explicit disabled row turns it off everywhere and falls back to legacy templates).
2. Migrate five pilot merchants, one per vertical.
3. Setup wizard + preview links.
4. Open to all merchants; collect preset feedback.
5. Extra templates later without changing the registry or config model.

---

## Implementation map (code)

| Piece | Location |
| --- | --- |
| Tables | `store_templates`, `store_configs`, `store_config_revisions`, `store_preview_tokens` in `src/db/schema.ts` |
| Migration | `drizzle/0004_storefront_v1.sql`, runner `scripts/apply-storefront-v1.cjs` (`npm run db:storefront`) |
| Config types + zod + defaults | `src/lib/storefront/config.ts` |
| Theming engine | `src/lib/storefront/theme.ts` |
| Vertical presets | `src/lib/storefront/presets.ts` |
| DB helpers + feature flag | `src/lib/storefront/store.ts` |
| Renderer | `src/components/store-templates/storefront-v1/` |
| Live storefront wiring | `src/app/[slug]/page.tsx` |
| Public config API | `src/app/api/store/[slug]/config/route.ts` |
| Merchant setup API | `src/app/api/merchant/store-config/` |
| Setup wizard | `/dashboard/store-design` |
| Phone preview link | `/preview/[token]` |