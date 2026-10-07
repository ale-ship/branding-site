# Noorcom Branding website

Public website for Noorcom Branding, Nairobi. Next.js App Router, TypeScript (strict), Tailwind CSS v4, lucide-react, Vitest. The site runs on a typed mock; our own backend is being built in `backend/` (with shared rules in `shared/`) and will replace it step by step. Read `docs/RUNBOOK.md` first; for online ordering and payments, also `docs/ORDER_WORKFLOW_SPEC.md`; for the backend, `docs/BACKEND_RUNBOOK.md`.

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`: all four must pass before a task is handed over
- `npm run photos`: re-downloads the placeholder photos into `public/images/placeholder` and rewrites `CREDITS.md`
- `npm run a11y`, `npm run devices`, `npm run menu`: browser checks against a running production server (`BASE=http://localhost:3100`)
- `npm run backend`: the API on http://127.0.0.1:4300; `npm run backend:check`: its lint, typecheck and tests (see docs/BACKEND_RUNBOOK.md)

## Architecture rules

- Pages and components get data only through `api` from `@/lib/api` (the `SiteApi` interface in `src/lib/api/types.ts`). Never import `src/lib/api/data/*` or `mock.ts` outside `src/lib/api/`. No Supabase, nothing from Lovable: our own backend will implement `SiteApi` later.
- Code the backend also needs lives in `shared/` (JavaScript with `// @ts-check` and JSDoc): the order contract in `shared/contract/order-types.d.ts`, the pure rules in `shared/rules/*.js`. The site imports them through `@shared/*` or the re-exports in `src/lib`; change a rule in `shared/`, never in a re-export. `shared/` imports nothing from `src/` and has no dependencies.
- `backend/` follows docs/BACKEND_RUNBOOK.md: routes → controller → service → repo (enforced by its ESLint), config only in `src/config.js`, Redis keys only `nb:*`, never the site's code.
- Business details and navigation live in `src/lib/site.ts`, not in components.
- Colours are CSS variables in `src/app/globals.css`, mapped in `@theme inline` (`bg-paper`, `text-heading`, `bg-accent`...). Tailwind's default palette is removed, so hex values and default colour classes won't work in components (the one exception: a project's own `palette` values, shown as swatches).
- Look, in the logo's colours (6 Oct 2026): white and warm `paper` pages, black type, the logo's red as the one `accent`. Text on a red fill is white (`text-on-accent`); red text on white uses `accent-ink`; `brand-red` (the logo's pure red) only for decorative bars and edges. Links are black and underlined; focus rings are red. Square corners, real photography, at most one `dark` section per page. Bricolage Grotesque (`font-display`) for headings, Inter for text.
- Signature details are in `components/ui/PrintMarks.tsx`: `CropMarks`, `CmykDots`, `Swatches`, `Eyebrow`. Use them; don't invent new decoration. No registration (crosshair) marks: the owner asked for them to be removed (3 Oct 2026).
- Motion: `Reveal` for scroll reveals (plain markup; the one `RevealObserver` in the root layout, an inline script that doesn't wait for React, does the work, so don't add a client component per section; never wrap the first thing on a page, the LCP, in `Reveal`), `Marquee`, `RotatingBadge`. Everything must stand still under `prefers-reduced-motion` and show without JavaScript.
- No people in any photo (owner, 3 Oct 2026): show the work, the products and the machines. Applies to placeholders and every new image; crop out people in the background (`rect` in the photo script).
- Online ordering with M-Pesa (docs/ORDER_WORKFLOW_SPEC.md; approved to build 5 Oct 2026, replacing the 3 Oct add-to-quote-only rule): orders, payments and accounts go only through `SiteApi` (the order and account methods in `src/lib/api/types.ts`). Payments are **mocked** until our backend exists; never call M-Pesa, Absa or Daraja from the site. An order only moves forward on a confirmed payment callback, never on the browser saying "paid". Prices come from `src/lib/pricing.ts` (pure; the form uses it for the instant price, the server recomputes and is the one that counts).
- Paybill payments are routed by `src/lib/payments/c2b.ts` (Absa C2B; the backend will reuse it): never match a payment to an order any other way. Every confirmed payment has a receipt number (RCT); invoices and receipts share `components/order/BrandDocument.tsx`.
- Accounts sign in with phone + a WhatsApp code only (`src/lib/account.ts`); the session is the httpOnly `nb-session` cookie, read only on the server. A sign-in code is never shown or returned outside mock mode.
- Deadlines come from the capacity calendar (`src/lib/capacity.ts`): price with `estimatePrice(…, calendar)` wherever dates are shown. Company orders are approved only by an owner or approver; the company on an order comes from the session, never the browser.
- The quote list (`useQuoteList`, `src/lib/quote-list.ts`) and the quote form stay for "ask us first" requests.
- Quote rules live in `src/lib/quote.ts` (shared by the form and the server action). The server action (`src/app/quote/actions.ts`) must `coerceDraft` and validate again; never trust the browser. Pages link to the form with `serviceQuoteHref(slug)` to preselect a service.
- Sample projects carry `sample: true` and show a "Sample" tag until real work replaces them.
- The logo (5 Oct 2026) is in `public/brand/`: `nb-logo.png` (full lockup) and `nb-mark.png` (the N mark). Use it only through `components/layout/Logo.tsx`.
- Hover styles use `any-hover` (the `@custom-variant hover` in `globals.css`) so touchscreen laptops get them. Overlays with `position: fixed` (the menu) must not sit inside an element with `filter`, `transform` or `backdrop-filter`, which traps them; the header has none.
- Images: the main image of a page uses `preload fetchPriority="high"` (Next 16 deprecated `priority`); everything else lazy-loads by default.
- Prefer server components; add `'use client'` only to interactive leaves.
- Don't pass `hidden` to a component whose base classes set `display` (ButtonLink is `inline-flex`): wrap it instead.
- Responsive: mobile first; check 320, 360, 390, 768, 1024, 1440 and 1920 px with no horizontal overflow; 44 px touch targets; visible focus; alt text on every content image.
- Before handing over: `lint`, `typecheck`, `test`, `build`, then `a11y`, `devices` and `menu` against a production server (`BASE=http://localhost:3100`). All must pass.
- Deploy files are in `deploy/` (VPS, port 4301); see docs/RUNBOOK.md, "Deploying to the VPS". Never commit real env files.
