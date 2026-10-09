# Noorcom Branding Website Runbook

Last updated 8 Oct 2026. This is the handover document: read it first in a new chat or on a new
machine. It records what the project is, what we found, every decision and why, and what comes
next. Update it at the end of every task.

## Where we are right now

- **All six phases are done** (3 Oct 2026). The whole site is built; Phase 6 prepared the launch
  (VPS deploy files, redirects from the old site, checklist) but **nothing is deployed to the VPS
  and DNS still points at Lovable**. The launch waits for the VPS and the "Launch checklist" below. Repo: https://github.com/Noorcom-Network-NNL/noorcom-branding, branch `main`.
- **Online ordering, Phase 1 is built (5 Oct 2026), mocked, and waiting for review**: order catalogue, the
  4-step order form with a live price, M-Pesa STK Push and Paybill (simulated), the order page and the
  invoice. See "Online ordering, Phase 1" below and `docs/ORDER_WORKFLOW_SPEC.md`.
- **6 Oct 2026:** the site now uses the logo's red and black; payments get numbered receipts (RCT); Paybill
  payments route through Absa C2B (built and tested against the mock, ready for Absa's details); invoices
  start afresh at INV00001. The backend is designed in `docs/BACKEND_RUNBOOK.md`.
- **The site still runs on the mock.** Every page and form works, but no payment, message or upload
  is real yet. Data comes through one interface (`SiteApi`); our own backend, in `backend/` in this
  repo, will implement it step by step (B0 to B5) without page changes. No Supabase, nothing from
  Lovable.
- **Pages:** `/`, `/work`, `/work/[slug]`, `/services`, `/services/[slug]`, `/shop`, `/shop/[slug]`,
  `/quote`, `/order`, `/order/new`, `/order/[ref]`, `/order/[ref]/invoice`, `/order/[ref]/receipt/[no]`,
  `/account`, `/account/statement` (+ `.csv`), `/about`, `/contact`,
  `/privacy`, `/terms`, plus the 404 and error pages,
  `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, icons.
- **6 Oct 2026, online ordering Phase 2 (proofs and production) built**, mocked: proof review with
  pinned notes and an approval checklist, every version kept, the pre-production sample, the
  production log with a calculated ETA, pickup codes, deliveries and early (partial) deliveries.
- **6 Oct 2026, online ordering Phase 3 (accounts and site jobs) built**, mocked: sign-in with a
  code (by email since 8 Oct), `/account` with every order, brand kit, saved addresses and "Order again"; site jobs
  run survey booking → firm quote → deposit → design → installation date → sign-off → balance.
- **6 Oct 2026, online ordering Phase 4 (polish) built**, mocked: the capacity calendar drives the
  deadlines offered, proofs show a mockup on the item, print-ready files are checked in the browser
  (resolution, RGB, bleed), accounts get a statement (page and CSV), and company accounts (members,
  approvers, PO numbers on invoices). **All four spec phases are now on the site.**
- **6 Oct 2026, backend step B0 done** (`docs/BACKEND_RUNBOOK.md`, "Step B0"): `shared/` holds the
  order contract and the pure rules (the site re-exports them), and `backend/` is an Express API
  skeleton with config, logging, Postgres, Redis, rate limits and `/api/health`.
- **7 Oct 2026, menu, hover and speed fixes** ("7 Oct 2026: menu, hover and speed" below): the phone
  menu opens full screen again, touchscreen laptops get hover effects, and the top of every page
  shows without waiting for React (Lighthouse on the home page, desktop 87 → 95–99).
- **7 Oct 2026, new machine:** the project now lives in `C:\noorcom-branding` on the office machine;
  `npm install` and every check (lint, typecheck, 203 tests, build, `a11y`, `devices`, `menu`) pass
  there. PostgreSQL 18 is installed and `psql` is on the PATH; Redis will be Memurai.
- **7 Oct 2026, the VPS plan:** `docs/VPS_BRANDING.md` puts the site on the shared Contabo box
  beside Noorcom Computers, the same way, at `staging.noorcombranding.co.ke` first. The deploy files
  took electronics' lessons from the box (see "7 Oct 2026: the VPS plan" below). Nothing is on the
  box yet.
- **7 Oct 2026, backend step B1 done** (`docs/BACKEND_RUNBOOK.md`, "Step B1"): the order catalogue
  is in Postgres (migration and seed from `shared/catalogue`), the API serves `GET /api/catalogue`
  and `POST /api/quotes/price`, and with `NEXT_PUBLIC_API_MODE=live` the site's order pages read
  the catalogue and prices from it (`src/lib/api/live.ts`; a price changed in the database reached
  the order page within a minute). Orders, payments and accounts stay on the mock until B2 and B3.
  The local database comes from `scripts\setup-dev-db.ps1`.
- **8 Oct 2026, accounts sign in with an emailed code** instead of WhatsApp (decisions log).
- **8 Oct 2026, backend step B2 done** (`docs/BACKEND_RUNBOOK.md`, "Step B2"): orders are placed
  and read on the API (`POST /api/orders`, `GET /api/orders/:no`, `POST /api/orders/lookup`), with
  their invoice number (INV), the machine time they hold (`GET /api/capacity`), an "order placed"
  WhatsApp and email in the outbox, and expiry after 48 hours unpaid. With `NEXT_PUBLIC_API_MODE=live`
  the site places and reads orders there; paying, proofs and accounts stay on the mock until B3 and B5
  (in live mode those steps say they aren't online yet). Orders placed through the live site's form
  were in the local database with INV00001 to INV00004.
- **8 Oct 2026, Memurai (local Redis) is installed** with the ACL user `nb` (`docs/BACKEND_RUNBOOK.md`,
  "Setting up Postgres and Redis"); `/api/health` answers `ok` and all 37 backend tests run.
- **8 Oct 2026, backend step B3 done against the fakes** (`docs/BACKEND_RUNBOOK.md`, "Step B3"):
  M-Pesa prompts (STK Push) and Paybill payments (Absa C2B) go through the ledger, which gives each
  payment its receipt (RCT), moves the order on and queues a "payment received" WhatsApp and email;
  unmatched Paybill payments wait for staff. A worker (`npm run backend:worker`) settles callbacks,
  routes Paybill payments, sends the messages and expires unpaid orders. With
  `NEXT_PUBLIC_API_MODE=live` the site's pay panel uses it; proofs and accounts stay on the mock until
  B5. Absa's real API waits for its documentation (B3b, with the PDFs).
- **8 Oct 2026, backend step B4 done** (`docs/BACKEND_RUNBOOK.md`, "Step B4"): the staff back
  office in `admin/` (`npm run admin`, http://localhost:3300/admin/): sign-in by role, the order
  board, each order with the step for your role (log pieces, mark ready, send out, hand over,
  cancel), proof uploads, unmatched Paybill payments and staff accounts. Proofs moved forward
  from B5: the customer approves or asks for changes on the site's order page, and sees the proof
  with PROOF across it. An order was run from placing to handover in browsers without the demo
  controls. The first admin: `npm run staff:add` in `backend/`.
- **8 Oct 2026, the minimum run is 10 pieces** (was 50) across the shop, the order form and the
  service pages; admins set a product's own minimum in the back office (Products).
- **Next (owner, 7 Oct 2026: the VPS waits):** step B5 (accounts on the API, the sample, partial
  deliveries, site jobs, the price manager and reports), or B3b once Absa's documentation arrives.
  Later, on the box: `docs/VPS_BRANDING.md` sections 1.1 to 5 (staging DNS record, deploy key,
  first deploy) and section 8 (Postgres and Redis), plus the API and worker units and nginx's
  `/admin/`. Ask Absa for the items in its section 14. Then the launch checklist.

## Start here on a new machine

1. Install Node.js 22 or newer and Git.
2. `git clone https://github.com/Noorcom-Network-NNL/noorcom-branding.git`, then `cd noorcom-branding`
   and `npm install`.
3. `npm run dev`, then open http://localhost:3000.
4. Before handing over a task: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
   (stop the dev server before building; both use `.next/`). Then, against a production server
   (`npx next start -p 3100`, with `BASE=http://localhost:3100` before each command):
   - `npm run a11y`: axe (WCAG 2.2 AA) on every route and state at 390, 768 and 1440 px, plus one h1,
     skip link, no sideways scroll, 44 px targets, and motion stopping under reduced motion.
   - `npm run devices`: every route on 11 devices (phones, landscape, tablets, laptop, desktops):
     sideways scroll, JavaScript errors, failed requests, broken images, sections that never appear.
   - `npm run menu`: the header and full-screen menu at 8 widths with real key presses, including that
     the open menu covers the whole screen.

The placeholder photos are committed in `public/images/placeholder` (`npm run photos` re-downloads them).

**Contour lines (9 Oct 2026):** the back office's topographic lines are on the site too
(`Contours` in `components/ui/PrintMarks.tsx`): faint with a red hill on the dark "How a job runs"
band, white on the red call to action, faded to the right of inner page headers, and faint in the
footer. They are two SVG drawings in `public/contours` (`npm run contours` redraws them) used as
CSS masks, so their colour is a token, they cost nothing per page once cached, and they show
without JavaScript; they are hidden in print and in forced-colours mode.

**Changing the site's content (8 Oct 2026):** projects, services, the shop, clients and the words and
photos of the home and About pages are edited in the back office (**Website**), with photos uploaded
to its media library, once the site runs in live mode (`docs/BACKEND_RUNBOOK.md`, "The website
editor"). Their starting values are in `shared/content/`; the mock (Vercel today) serves those as
they are.
Project rules for Claude are in `AGENTS.md` (loaded through `CLAUDE.md`).

## Resuming work with Claude Code

Claude does not know this file exists unless told. This runbook and the order workflow spec (`docs/ORDER_WORKFLOW_SPEC.md`) live in `docs/`. Start a new chat with something like:

> Read docs\RUNBOOK.md in C:\noorcom-branding first. We are rebuilding noorcombranding.co.ke
> from scratch. Continue with the next unfinished step, then stop for review.

When Claude finishes a task it should update this runbook (what changed, decisions, open items),
and stop so the owner can review it in the browser.

---

## 1. The business

- **Noorcom Branding**, Nairobi, Kenya. Printing and branding: indoor and outdoor branding,
  signage, stationery, corporate gifts, apparel printing.
- **Contact (from the live site):** +254 722 530 301 (also WhatsApp, `wa.me/254722530301`),
  info@noorcombranding.co.ke.
- **Address:** Chuka Elimu Plaza, 1st Floor, Loita Street, Nairobi: the same premises as Noorcom
  Computers (owner, 3 Oct 2026). Opening hours and social links: **to confirm**.
- **Products and services named on the live site:**
  - Categories: Branding, Printing, Outdoor Signs, Indoor Signs, Corporate Gifts.
  - Products: Business Cards, A5 Posters, Brochures, Booklet Printing, A4 Notebooks, Water Bottle
    Branding, Mug Branding, Umbrella Branding, Hoodie Branding, T-Shirt Printing, Branded Gift Bags,
    Banner Stands.
  - Service blocks: Indoor Branding, Outdoor Branding, Stationery Printing (business cards,
    letterheads, envelopes, logo design).
- **Prices on the live site** (owner's screenshot, 3 Oct 2026, "Featured Products"). Prices are
  **per piece** (owner: a business card is KES 18 each). Minimum order quantities are not known;
  **we use 50 for every product** until the owner confirms real ones.

  | Product | KES |
  | --- | ---: |
  | Business Cards | 18 |
  | A5 Posters | 28 |
  | Brochures | 50 |
  | Booklet Printing | 700 |
  | A4 Notebooks | 1,200 |
  | Water Bottle Branding | 800 |
  | Mug Branding | 450 |
  | Umbrella Branding | 1,500 |
  | Hoodie Branding | 2,500 |
  | T-Shirt Printing | 650 |
  | Branded Gift Bags | 430 |
  | Banner Stands | 3,500 |

  The live product cards use emoji on a gradient instead of photos; ours use real product photos.

## 2. Audit of the live site (noorcombranding.co.ke, 3 Oct 2026)

**How it is built:** a Lovable export. React and Vite single-page app, shadcn/ui, Tailwind v3,
Supabase (tables `products`, `orders`, `order_items`, `customers`, `user_roles`). The HTML
the server sends is empty (`<div id="root">`); everything is drawn by JavaScript.

**Routes:** `/` (home), `/checkout`, `/order-confirmation`, `/auth`, `/admin` with
`/admin/pos`, `/admin/products`, `/admin/orders`, `/admin/customers`, `/admin/settings`.

**Home page, top to bottom:** header (Home, Categories, Our Products, Services, Admin, search,
cart) → hero slider with 3 slides ("Elevate Your Brand with Printing and Expert Design",
"Professional Branding Services", "Premium Printing Solutions") → Our Services (5 category cards)
→ Featured Products → Indoor / Outdoor Branding blocks → Stationery block → Our Clients → footer
(navy, logo, quick links, contact, WhatsApp button).

**Shop and admin:** cart drawer; checkout with Cash on Delivery, M-Pesa or Bank Transfer (no real
M-Pesa prompt, staff call the customer back); an admin with dashboard, POS, products (with cost
price), orders and customers.

**Theme tokens:** text navy `#001F3D`, primary teal `#006080`, secondary orange `#FF851A`, accent
cyan, radius 12 px, system font, many blue-to-teal gradients, emoji used as icons.

**Problems to fix in the rebuild:**

| Problem | Why it matters |
| --- | --- |
| **No portfolio or case studies** | For a branding company the work is the product. Today nothing shows a single real job |
| "Our Clients" shows five 🏢 emoji, not logos | Reads as unfinished; damages trust |
| Emoji as icons (📦 🏢 🪧) and "Designed with ❤️" | Looks like a template, not a design studio |
| Empty HTML, Lovable's social image and `@lovable_dev` Twitter card | Google and WhatsApp/Facebook link previews see almost nothing, and show Lovable's branding |
| "Stationary" (should be **Stationery**), © 2025 | Spelling on a print company's site is noticed |
| Site teal `#006080` does not match the logo's navy, blue and orange | Brand inconsistency on a branding site |
| Copy is generic ("bring your brand to life") | Says nothing about materials, turnaround, minimum quantities or process |
| Admin and POS sit inside the public site, cost price in the same app | Mixes public site and back office; a security and maintenance risk |
| The logo is a detailed 3D illustration with ink splashes, shadows and a grey backdrop | Does not shrink to a favicon or header size, and has no flat/one-colour version. **Owner decides** whether to refresh it (see Open questions) |

## 3. Inspiration: what we take from each

| Site | What to take | What not to take |
| --- | --- | --- |
| **Agrumea Farm** (agrumeafarm.it/en) | The premium feel: big confident photography, lots of white space, restrained type, a "scroll to discover" hero, an overlay full-screen menu, rotating circular text badge, slow reveals as you scroll | Its sparse information; we still need clear services and prices |
| **Mindsparkle**, El Puente case study | **The case-study template:** story → concept → colours and type → applications (signage, packaging, apparel, cups) → "Behind the scenes" → credits. Big full-width images, short text between them | Their single-project magazine voice on our listing pages |
| **BP&O** (bpando.org) | The work archive: a clean grid of project cards (big image, short opinionated caption), sections Latest / Collections / Logos | Its density of text |
| **Brand New** (underconsideration.com) | **Before / After** presentation for rebrand jobs; tags by industry and project type | Comments, membership |
| **Branding Style Guides** | **Filters** on the work archive (service, industry, year) and a small metadata line on each card (client · year · services) | Its directory-like look |
| **The Dieline** | Editorial grid with mixed card sizes, category tags on each card; the idea of a "Notes / Journal" section later | Ads, heavy navigation |
| **World Brand Design Society** | Project pages that lead with one hero image and a credit line (studio, client, country) | |
| **Awwwards** | The bar for interaction quality: smooth scroll, magnetic buttons, cursor and hover states, page transitions, large display type | Heavy WebGL or effects that slow phones on Kenyan mobile data |

## 4. Proposed direction (to confirm)

**"A studio with a print shop", not "a shop with a few services".** The site leads with work,
then services, then the shop and a quote. It should look like the best job Noorcom has ever printed.

- **Look:** white and warm-off-white pages, near-black / navy type, **one strong accent** (the
  logo's orange) used sparingly, the logo's blue for links and small details. Full-bleed
  photography of real jobs (installed signage, vehicles, apparel, gifts) and of the workshop
  (machines, ink, cutting). **No people in photos.**
- **Type:** a characterful display face for big headlines plus a clean sans for text. Proposal:
  **Bricolage Grotesque** (display) + **Inter** (text), both free on Google Fonts and self-hosted
  with `next/font`. Alternatives to show the owner: Clash Display + General Sans (Fontshare, free),
  or an editorial serif such as Instrument Serif for headlines.
- **Shapes:** square or near-square corners (radius 0–4 px), hairline rules, a 12-column grid.
  No gradients, no emoji.
- **Motion (Awwwards-level, but light):** smooth scroll, text and images revealed on scroll, image
  hover zoom on project cards, a marquee of client logos, a circular rotating "Get a quote" badge
  (Agrumea), page transitions. Everything off under `prefers-reduced-motion`. Phones on mobile data
  must stay fast (Lighthouse performance 90+).
- **Signature idea:** use print-production details as the design language: crop marks in the
  corners of big images, CMYK dots, colour-swatch chips for each project's palette, paper/stock
  names in captions. It says "we print" without saying it. **No registration (crosshair) marks:**
  the owner asked for them to be removed (3 Oct 2026).

## 5. Proposed sitemap

| Route | What it shows |
| --- | --- |
| `/` | Latest / Discover split of real work (BP&O) → what we do (services index) → clients logo marquee → process (Brief → Design → Proof → Print → Install) → shop teaser → quote call to action |
| `/work` | All projects, filterable by service (indoor, outdoor, vehicle, apparel, gifts, stationery, identity), industry and year |
| `/work/[slug]` | Case study: cover image, metadata (client, industry, year, services, location), the brief, the idea, palette and type, applications, **behind the scenes** (production photos), before/after when it is a rebrand, result, next project |
| `/services` and `/services/[slug]` | Each service: what is included, materials and finishes, sizes, turnaround, minimum quantities, gallery from `/work`, FAQ, request a quote |
| `/shop` and `/shop/[slug]` | Branded products (business cards, mugs, bottles, tees, hoodies, umbrellas, gift bags, banner stands, notebooks...): price per piece, minimum order, options, **Add to quote** (no payment) |
| `/quote` | Step-by-step quote request: what, how many, sizes/options, artwork upload, deadline, delivery, contact; sends to email and WhatsApp |
| `/about` | Story, the team, the workshop and machines, numbers (years, jobs, clients) |
| `/contact` | Phone, WhatsApp, email, address, map, hours, form |
| `/journal` (later) | Short posts: new jobs, material guides ("Which banner material for outdoors?") — good for SEO |
| `/privacy`, `/terms`, 404 | Standard |

**Back office** (products, orders, quotes, work entries) will be **our own**, built later and kept
separate from the public site. Not in scope now (owner, 3 Oct 2026). Forms (quote, contact) and
checkout run against the mock until then.

## 6. Proposed stack (same as Noorcom Computers, so one way of working)

- Next.js (App Router) + TypeScript strict + Tailwind CSS v4 with design tokens as CSS variables in
  `globals.css`; `next/font`, `next/image`, lucide-react icons. Motion: the `motion` library (Framer
  Motion) and Lenis for smooth scroll, both lazy and reduced-motion aware.
- Pages render on the server, so Google and WhatsApp/Facebook previews get real text, with
  per-page metadata, Open Graph images, sitemap, JSON-LD (`LocalBusiness`, `CreativeWork` for
  projects).
- Content (projects, services, products) starts as typed files in `src/content/`, behind one data
  interface (`SiteApi`, mock implementation only for now), so our own API can replace it later
  without changing pages. Pages and components never import content files directly. No Supabase,
  no Lovable code or services.
- **Placeholder photos** until the owner sends real job photos: free-licence images (Unsplash,
  Pexels) saved locally in `public/images/placeholder/`, each listed with its source and licence
  in `public/images/placeholder/CREDITS.md`. **No people in any photo** (owner, 3 Oct 2026): show the work, the
  products and the machines.
  Replace them as real photos arrive.
- Hosting: our VPS with nginx, like the rest of our projects. DNS moves from Lovable at cutover.
- Quality bar (carried over): mobile first; checked at 390, 768 and 1440 px; keyboard accessible,
  visible focus, 44 px targets, alt text, WCAG AA contrast; `npm run build`, `lint`, `typecheck`,
  `test`, `a11y` pass before each push.

## 7. Phases

Each phase: build, run the checks, update this runbook, commit, stop for review.

| Phase | What | Status |
| --- | --- | --- |
| 0 Research | Audit the live site, review inspiration, propose direction, sitemap, stack; write this runbook | **Done 3 Oct 2026** |
| 1 Foundation | Owner's answers recorded; Next.js app; mock data interface; placeholder photos; tokens, fonts, grid; header (overlay menu), footer; home page with placeholder work | **Done 3 Oct 2026** |
| 2 Work | `/work` archive with filters; case-study template (sample content); real case studies when Noorcom sends them | **Built 3 Oct 2026**; real case studies to come |
| 3 Services and quote | Service pages; `/quote` form (mock: the request is checked and given a reference; sending to email and WhatsApp needs our backend) | **Built 3 Oct 2026** |
| 4 Shop | Product catalogue and product pages; quote list that feeds `/quote` | **Built 3 Oct 2026** |
| 5 Content and polish | About, contact, legal, 404; SEO, social images, JSON-LD; motion pass; accessibility and performance pass | **Done 3 Oct 2026** |
| 6 Launch | VPS deploy files, redirects from the old site, launch checklist | **Prepared 3 Oct 2026**; deploy and DNS cutover still to do. The backend and back office: `backend/` and `admin/` in this repo, steps B0 to B5 in `docs/BACKEND_RUNBOOK.md` |

## 8. Assets we need from Noorcom

- [ ] The refreshed logo files (SVG preferred; owner will share).
- [x] The git repository: https://github.com/Noorcom-Network-NNL/noorcom-branding
- [ ] **Photos of real jobs** (the most important item; owner will provide, placeholders until then): installed signage, shop fronts, vehicle
      branding, apparel, gifts, stationery. Before/after where possible. Highest resolution available.
- [ ] Photos of the workshop, machines and team.
- [ ] Client logos, and permission to show them.
- [ ] For 3 flagship jobs: client, year, what was asked, what was done, materials, outcome.
- [x] Prices for the 12 featured products (section 1).
- [ ] Real minimum quantities (50 is a stand-in) and turnaround times.
- [x] Street address: same as Noorcom Computers.
- [ ] Opening hours, social media links, KRA PIN if invoices are shown.

## Phase 1: what was built (3 Oct 2026)

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4 (tokens in
`src/app/globals.css`), lucide-react, Vitest. Fonts self-hosted by `next/font`: Bricolage Grotesque
(display) and Inter (text).

**Files worth knowing:**

| Path | What |
| --- | --- |
| `src/lib/site.ts` | Business details and navigation |
| `src/lib/api/` | `SiteApi` contract (`types.ts`), the mock (`mock.ts`), content (`data/services.ts`, `products.ts`, `projects.ts`) |
| `src/components/ui/PrintMarks.tsx` | The signature details: crop marks, CMYK dots, swatches, eyebrow labels |
| `src/components/ui/` | `ButtonLink`, `Container`, `Reveal` (scroll reveal), `Marquee`, `RotatingBadge` |
| `src/components/layout/` | `Header` (sticky and solid; full-screen menu below 1024 px, a modal with focus trap and Escape, rendered next to `<header>`, not inside it), `Footer`, `Logo` (the N mark and name), `WhatsAppButton` |
| `src/components/home/` | The home page sections, in page order below |
| `scripts/fetch-placeholder-photos.mjs` | Downloads the placeholder photos and writes `CREDITS.md` |

**Home page, top to bottom:** Latest / Discover split (BP&O: the newest project large on the left
with the rotating "Get a quote" badge, the next four in a 2×2 grid on the right, Sample tags; the
page's h1 is visually hidden) → service ticker → workshop band (the wide-format printer photo,
full width with crop marks, three facts under it) → What we do (numbered service index; photo opens on
hover on desktop) → Behind the scenes (workshop photos) → How a job runs (the one navy section, 5
steps) → Clients (placeholder tiles on a ticker) → Shop teaser (4 products, price per piece, min 50)
→ Quote call to action (orange block) → footer.

**Placeholder photos:** 30 Unsplash photos, each checked by eye; none show people.
Credits in `public/images/placeholder/CREDITS.md`.

**Checked:** lint, typecheck, 9 tests, production build. Responsive check by emulating 320, 360, 390,
414, 768, 1024, 1280, 1440 and 1920 px in Chrome: no horizontal overflow at any width. Fixed during
the check: the hero badge sat in the page flow, the header quote button showed on phones, the 5th
process step was orphaned at tablet width, and the footer email broke mid-word at 1024 px.

**Not yet:** an automated accessibility (axe) check like Noorcom Computers' `npm run a11y`; add it in
Phase 5. Real logo, photos, client logos and confirmed wording (`TODO(business)` in the code).

## Phase 2: what was built (3 Oct 2026)

**Routes:**

| Route | What it shows | Notes |
| --- | --- | --- |
| `/work` | Every project in a 3-column grid with filter rows for service, industry and year (Branding Style Guides) | Filters live in the URL (`?service=&industry=&year=`), are plain links (work without JavaScript), show how many results each option gives, and a second click clears an option. Filtered views are `noindex`; canonical is `/work`. Rows scroll sideways on phones |
| `/work/[slug]` | A case study (Mindsparkle's order): back link, title, summary and credits (client, industry, year, location, services), cover with crop marks, The brief, The idea, big numbers, colours (swatches with hex) beside materials and finishes, The work (gallery with captions), Behind the scenes (production photos on paper), Before and after (rebrands only), The result, Next project, quote call to action | Static for every project. `CreativeWork` JSON-LD. Sample projects are `noindex` |

**Data:** `Project` gained `brief`, `idea`, `result`, `facts`, `materials`, `applications`,
`behindTheScenes` and `beforeAfter` (null unless it's a rebrand); `SiteApi.getProject(slug)` was
added. There are now 8 sample projects, all marked `sample: true`, with invented wording. The filter
logic is pure functions in `src/lib/work.ts` with tests in `work.test.ts`. The project card is shared
(`components/work/ProjectCard.tsx`) by the home page and the archive.

**Also on 3 Oct 2026:** the workshop printer photo is back on the home page as a full-width band
after the service ticker, with the three facts under it; registration marks removed everywhere (the
ticker now uses small orange circles); the shared address in the footer (links to Google Maps) and in
site-wide `LocalBusiness` JSON-LD; extra footer bottom space so the WhatsApp button never covers it.

**Checked:** lint, typecheck, 22 tests, build. `/`, `/work`, `/work?service=apparel` and a case study
emulated at 320, 390, 768, 1024, 1440 and 1920 px: no horizontal overflow.

## Phase 3: what was built (3 Oct 2026)

**Routes:**

| Route | What it shows | Notes |
| --- | --- | --- |
| `/services` | The seven services as large numbered cards (photo, name, summary, what's included), then How a job runs and the quote block | Static |
| `/services/[slug]` | Back link, "Service 0X", name, intro, Get a quote (service preselected) and WhatsApp; photo with crop marks; turnaround, smallest job, coverage; What we make beside Materials and finishes; related work (links to `/work?service=`); How a job runs; matching shop items; FAQ (native `details`, keyboard friendly); quote block with the service preselected | Static for every service. `Service` and `FAQPage` JSON-LD |
| `/quote` | The quote form in three steps (The job → Artwork and timing → Your details), with "What happens next" and contact options beside it | `?service=<slug>` preselects the service; unknown values are ignored |

**The quote form** (`components/quote/QuoteForm.tsx`, client):
- Step 1: service (radio cards), quantity, description. Step 2: artwork files (choose or drag and
  drop; PDF, AI, EPS, SVG, PSD, CDR, PNG, JPG, TIFF, ZIP; up to 5 files of 25 MB), "I need you to
  design it", deadline (optional, not in the past, Nairobi date), collect / deliver / install, and
  where (required for deliver and install). Step 3: name, company (optional), Kenyan phone, email
  (required only if email is the preferred reply), preferred reply (WhatsApp, phone, email).
- Each step is checked before Next. Errors sit under their field, focus moves to the first one, and a
  live region says how many need attention. On success the form becomes a confirmation with the
  reference (`NB-` and six digits), focus moves to it, and "Continue on WhatsApp" opens a chat
  that quotes the reference.
- **Rules live in `src/lib/quote.ts`** (pure, tested in `quote.test.ts`): Kenyan phone
  normalisation to `+254…`, field checks per step, artwork checks, and `coerceDraft`, which rebuilds
  a clean draft from whatever the browser sent.
- **Submitting** goes through a server action (`src/app/quote/actions.ts`) that coerces and checks
  everything again, drops unknown product slugs and calls `api.submitQuote`. The mock keeps requests
  in memory (`receivedQuotes`) for as long as the server runs.
- **Not yet (needs our backend):** storing requests, emailing Noorcom and the customer, WhatsApp
  notifications and uploading the artwork files. Until then only the file names and sizes travel;
  the confirmation asks the customer to send the files on WhatsApp or by email with the reference.

**Data:** `Service` gained `intro`, `materials`, `turnaround`, `minimum`, `productCategories` and
`faqs` (all draft wording, `TODO(business)`); `SiteApi` gained `getService` and `submitQuote`. The
product card is shared (`components/shop/ProductCard.tsx`); `ShopTeaser` and `QuoteCta` take
optional props for service pages.

**Checked:** lint, typecheck, 53 tests, build. `/services`, two service pages and `/quote` emulated at
320 to 1920 px with no horizontal overflow. The form driven end to end in Chrome at 390 and 1440 px:
empty fields, a missing install location, a past date and a bad phone number are each caught with
focus on the field; a valid request returns a reference and focus moves to the confirmation.

## Phase 4: what was built (3 Oct 2026)

**Routes:**

| Route | What it shows | Notes |
| --- | --- | --- |
| `/shop` | The 12 products in a 2/3/4-column grid with category chips (Stationery, Print, Apparel, Gifts, Display, with counts), "prices per piece" note, a "Need something that isn't here?" link to Services, the quote block | `?category=` in the URL; filtered views `noindex` |
| `/shop/[slug]` | Photo with crop marks (sticky on desktop); category, name, price per piece and minimum; description; **Add to quote** panel; "Ask about this on WhatsApp" (prefilled); price, minimum, turnaround (from the product's service), proof, collection or delivery; link to the service; "You might also need"; quote block | Static for every product. `Product` JSON-LD with a per-piece `UnitPriceSpecification` and the minimum as `eligibleQuantity` |

**Add to quote** (`components/shop/AddToQuote.tsx`): option chips (first value is the default), a
quantity stepper that starts at the minimum (steps of 10 when the minimum is 50 or more) and refuses
less, a live estimate ("About KES 2,160 before design and delivery…"), then a confirmation with
"Review and send". Adding the same product with the same options again updates its quantity.

**The quote list** is kept in the browser's localStorage (`noorcom-branding.quote-list.v1`), shared
across tabs (`components/shop/useQuoteList.ts`). If storage is blocked it lasts for the page view.
Rules are pure functions in `src/lib/quote-list.ts` (merge by product and options, at most 20 lines,
safe parsing of what was stored, estimates). The header shows the count: "Your quote" with a badge
from 640 px, a clipboard icon with a badge on phones.

**In `/quote`**, step 1 starts with "From the shop": each line with photo, options, price, an
editable quantity and Remove, plus the total pieces and an estimate. With items in the list, the
service, quantity and description become optional; each item must meet its minimum (checked in the
form and again in the server action against the real catalogue). After sending, the list is emptied.

**Data:** `Product` gained `service`, `description` and `options`; `QuoteRequest.products` is now a
list of `{ slug, quantity, options }`, `service` may be empty and `quantity` is 0 for shop-only
requests. `validateQuote` takes a context (`{ services, products }`). Catalogue helpers are in
`src/lib/shop.ts`.

**Checked:** lint, typecheck, 72 tests, build. `/shop`, `/shop?category=gifts` and two product pages
emulated at 320 to 1920 px with no horizontal overflow. The journey driven in Chrome: below-minimum
quantity refused, estimate shown, two items added (header count 1 then 2), a quantity under the
minimum caught in `/quote` with focus on it, sent without choosing a service, list emptied and the
header reset.

## Phase 5: what was built (3 Oct 2026)

**Pages:**

| Route | What it shows |
| --- | --- |
| `/about` | Header, workshop photo with crop marks, Our story (draft), three principles (one team, proof first, made to last), the workshop's machines, How a job runs, clients, quote block |
| `/contact` | WhatsApp, call and email as large links; the address with a lazy Google map and "Open in Google Maps"; a "Looking for a price?" link to the quote form; a message form (name, phone or email, message) that returns an `NM-` reference |
| `/privacy`, `/terms` | Numbered sections with an "On this page" list and a visible **Draft for legal review** notice (Kenya Data Protection Act, 2019; quote validity, proofs, deposit, turnaround, changes, faults) |
| `error.tsx` | "This page jammed in the press": Try again, WhatsApp us, and the error reference |

The footer links to Privacy and Terms. The contact form follows the quote form's pattern: rules in
`src/lib/contact.ts` (tested), a server action that checks again (`src/app/contact/actions.ts`), and
`SiteApi.sendMessage` (the mock keeps messages in memory; delivering them needs the backend).

**Search and sharing:** `sitemap.xml` (every page, service and product; sample projects left out),
`robots.txt`, a default 1200×630 link-preview image (`app/opengraph-image.tsx`: paper background,
crop marks, "We make brands impossible to miss."), an Apple home-screen icon, and JSON-LD:
`LocalBusiness` site-wide, `CreativeWork` on case studies, `Service` and `FAQPage` on service pages,
`Product` on product pages. All URLs come from `NEXT_PUBLIC_SITE_URL`.

**Accessibility pass** (`npm run a11y`, adapted from Noorcom Computers): no axe violations on any of
20 routes and states (forms with errors, menu open, quote list loaded, product added) at 390, 768 and
1440 px. Fixed on the way: the floating WhatsApp button now sits in a labelled region; 44 px targets
for the skip link, logo, desktop menu links, "Start a job", "Clear all filters", the case-study
service links and "Add more". Animations (tickers, the rotating badge) stand still under reduced
motion.

**Devices pass** (`npm run devices`, new): every route on 11 devices from a 320 px phone to a
1920 px desktop, portrait and landscape, with touch on phones and tablets. **Menu pass** (`npm run
menu`, new): at 320 to 1920 px the right navigation shows; Enter opens the menu with focus inside and
the page locked; Tab and Shift+Tab stay inside; Escape closes it and returns focus; a link navigates
and closes it; the current page is marked; the header stays at the top; the quote badge counts.

**Robustness:** a section the visitor has already scrolled past (for example after Back restores a
position mid-page) now shows at once instead of waiting to be scrolled past again.

**Performance pass** (Lighthouse 12, phone emulation, slow 4G, against the standalone build):
- Accessibility, best practices and SEO: **100** on the home and product pages.
- Every scroll reveal used to be its own client component (36 on the home page). They are now plain
  markup with **one shared observer** (`components/ui/RevealObserver.tsx`, in the root layout).
  Home page blocked time fell from 3,360 ms to 1,180 ms; performance from 49 to 59.
- Remaining: LCP about 3.7 s (the first project photo, 29 KB, shares the emulated 1.6 Mbps link
  with two fonts of 89 KB and the scripts); layout shift 0. This machine is slow for Lighthouse
  (benchmark index about 600, against 1,000 to 1,500 that its 4× CPU slowdown assumes); with 2×
  the home page scores 70. Re-measure on the VPS at launch, and with real photos.
- Updated 7 Oct 2026: the reveal observer is now an inline script and the home LCP is faster; see
  "7 Oct 2026: menu, hover and speed".
- On Windows Git Bash, prefix `MSYS_NO_PATHCONV=1` when passing paths to the checks
  (`ONLY=/shop`), or Git Bash turns them into Windows paths.

**Motion:** kept to what's there (reveals, tickers, the rotating badge, hover zooms), all honouring
reduced motion. The smooth-scroll library and page transitions considered in section 4 were left
out: they add weight on phones on mobile data for little gain.

## Phase 6: launch preparation (3 Oct 2026)

**Built:**
- `next.config.ts`: `output: 'standalone'` (a self-contained server for the VPS) and redirects from
  the old Lovable site: `/checkout` and `/order-confirmation` → `/quote` (permanent); `/auth` and
  `/admin/*` → `/` (temporary, until our own back office exists).
- `deploy/`: the nginx site (`nginx/noorcom-branding.conf`: HTTPS, www → bare domain, HSTS, gzip, a
  year's cache for `/_next/static`), the systemd service (`systemd/noorcom-branding-web.service`,
  port **4301**, clear of Noorcom Computers' 4200 and 4201), env templates (`env/`), the deploy
  script (`scripts/deploy-branding.sh`: build first, switch one link, roll back automatically if the
  new release doesn't answer within 30 s, keep 5 releases; `--install` the first time, `--rollback`
  to go back) and a smoke test (`scripts/smoke-branding.sh`).
- `.env.example` with `NEXT_PUBLIC_SITE_URL`; `.gitattributes` keeps server files with LF endings.

### Deploying to the VPS

**The full steps are in `docs/VPS_BRANDING.md`** (7 Oct 2026): the box (Contabo, 144.91.76.57,
shared with Noorcom Hosting and Noorcom Computers), the staging name
`staging.noorcombranding.co.ke`, the read-only deploy key, the first deploy (certificate before the
nginx site), every later deploy, Postgres and Redis for B1, the cutover and the gate. In short, as
root on the box: `bash /var/www/noorcom-branding/repo/deploy/scripts/deploy-branding.sh`, then
`smoke-branding.sh https://<host>`; `--rollback` goes back one release.

### Launch checklist

Content (the site says "Sample" and "Draft" until this is done):
- [ ] Real job photos replace the placeholders; the 8 sample projects replaced by real case studies
      (`src/lib/api/data/projects.ts`), or the Work section trimmed to the real ones.
- [ ] The refreshed logo in `components/layout/Logo.tsx`, `app/icon.svg`, `app/apple-icon.tsx` and
      `app/opengraph-image.tsx`.
- [ ] Real client logos with permission (`clients` in `projects.ts`), or the Clients strip removed.
- [ ] Every `TODO(business)` in the code confirmed: service wording, turnaround times, minimum
      quantities per product, product options, opening hours, social links, the About story.
- [ ] Privacy and Terms reviewed by a lawyer; then remove the draft notice in
      `components/legal/LegalPage.tsx`.

Backend (`backend/`, `docs/BACKEND_RUNBOOK.md`; until then the forms work but nothing is delivered):
- [ ] Our own API implementing `SiteApi` (`submitQuote`, `sendMessage`): storing requests, emailing
      Noorcom and the customer, artwork upload. Swap it in at `src/lib/api/index.ts`.
- [ ] Then a strict Content-Security-Policy (see the TODO in `next.config.ts`).

Switching over:
- [ ] Deployed on the VPS under a staging name and checked: `smoke-branding.sh`, plus `npm run a11y`,
      `npm run devices` and `npm run menu` with `BASE=https://<staging host>`.
- [ ] `web.env` and `hosts.env` changed to `noorcombranding.co.ke`; `--install` again, the
      certificate for the real names, deploy, smoke test.
- [ ] DNS for `noorcombranding.co.ke` and `www` moved from Lovable to the VPS (lower the TTL a day
      before). Keep the Lovable project until the new site has run for a week.
- [ ] The old site's admin and POS (Supabase) stop being reachable at the switch: make sure nobody at
      Noorcom still needs them, or export their data first.
- [ ] Google Search Console: verify the domain and submit `https://noorcombranding.co.ke/sitemap.xml`.
- [ ] Google Business Profile: the same address, phone and website.
- [ ] Share a link on WhatsApp to check the preview image and text.

## Online ordering, Phase 1: core ordering (5 Oct 2026)

Built from `docs/ORDER_WORKFLOW_SPEC.md`, Phase 1, **with every payment and message mocked**: no
money moves and nothing is sent. Stopped here for review.

**What a customer can do now**

| Route | What it does |
| --- | --- |
| `/order` | The order catalogue: 10 categories, 20 products, each tagged by mechanism (A "Priced instantly", B "Survey first", C "Design files"), with "from" prices; "Find your order" (order number + phone) |
| `/order/new?product=<slug>` | The order form in 4 steps: **What you need** (quantity with price tiers, then the product's own brief), **Your brief** (artwork status, logo and assets, brand colours with a picker, fonts, exact wording, style tags, inspiration images and links, notes), **Deadline and delivery** (Economy, Standard, Express, Rush, each with its ready date and total; pickup or delivery by zone), **Your details and payment** (name, company, phone, email, Terms). The price updates live beside the form (folded at the top on phones). `?qty=` and `?opt=Name:Value` prefill from a shop page |
| `/order/NB-123456?t=<token>` | The order page: pay panel (M-Pesa STK Push with "Check your phone", a 60 s countdown and live status; Paybill as the fallback), progress along the order's track, pieces / stages / revision rounds, survey dates for site jobs, payments with receipts, the order in plain words, history, messages sent (WhatsApp and email), the price agreed, the invoice and "Ask about this order" on WhatsApp. Without the token it asks for the order number and phone |
| `/order/NB-123456/invoice` | The invoice, laid out after Noorcom's template (INV00870): print or save as PDF |

Ways in: "Order" in the main navigation; **Order now** on shop product pages (carrying the options
and quantity; Add to quote stays beside it); **Book a site survey** on the indoor, outdoor and
vehicle service pages, **Order online** on the others. The old site's `/order-confirmation` now
redirects to `/order`.

**How it works**

- **Three mechanisms** (A quantity run, B site installation, C design only), set per product. The
  mechanism decides the form, the price, what's paid now, the tracker and the handover.
- **The catalogue** is data: `src/lib/api/data/order-catalogue.ts`. Each product carries its brief
  questions (`select`, `multiselect`, `number`, `text`, `textarea`, `sizes`, `dimensions`, `dates`,
  `yesno`), and priced choices carry per-piece or once-per-order amounts. `BriefFields` draws any of
  them, so a new product needs no new code. Products also in the shop keep the shop's price and
  minimum as their first tier (a test checks this).
- **Pricing** is pure (`src/lib/pricing.ts`, tests in `pricing.test.ts`): unit price by quantity tier
  + setup + design + priced choices, × the deadline multiplier, + delivery. Under KES 5,000 is paid in
  full, above it a 50% deposit; design-only in full; site jobs pay the survey fee. Ready dates count
  Monday to Saturday, skipping Kenyan public holidays (`src/lib/calendar.ts`), from the day after
  the order (when the proof is assumed approved). The form uses it for the live price; the server
  prices the order again when it is placed, and only that price counts.
- **Form rules** (`src/lib/order.ts`, tests in `order.test.ts`): each step checked before Next
  (sizes must add up to the quantity, survey dates from the next working day, colours as HEX or
  Pantone, print-ready artwork must be attached), focus on the first problem, errors announced. The
  server action (`src/app/order/actions.ts`) rebuilds the draft against the product's own brief
  (`coerceOrderDraft`) and checks everything again.
- **The data contract** gained `listOrderCategories`, `listOrderProducts`, `getOrderProduct`,
  `priceEstimate`, `createOrder`, `startPayment`, `getOrder`, `approveProof`, `requestChanges` and
  `bookSurvey` (types in `src/lib/api/order-types.ts`). All are mocked.
- **The mock order system** (`src/lib/api/mock-orders.ts`, tests in `mock-orders.test.ts`) enforces
  the spec's payment rules: an order moves only on a confirmed callback; a receipt number credits
  once; underpayment keeps the order waiting with the rest due; overpayment becomes credit; unpaid
  orders expire after 48 hours; one prompt at a time; the balance is asked for after proof approval,
  and production can't start before it is paid. STK outcomes by the phone's last digit: **0
  cancelled, 1 no answer (60 s), 2 failed, anything else paid after about 6 s**. Callbacks are applied
  when the order is next read, so no background timers are needed.
- **Access:** a guest opens the order with the secret link (`?t=`) or by order number + phone; a
  cookie remembers it in that browser for 90 days.
- **Demo controls** (mock only, at the foot of the order page): Paybill payment (full or part), skip
  the phone wait, repeat the last callback (to show it can't credit twice), and the staff side:
  upload a proof, approve or ask for changes, log production, hand over. `apiMode` in
  `src/lib/api/index.ts` switches them off when a real backend is in.

**The logo** is in: `public/brand/nb-logo.png` (full) and `nb-mark.png` (the N). The header shows the
mark with "Noorcom **Branding**" and the tagline as live text; the footer and invoice show the full
lockup; the favicon, Apple icon and link preview use the mark. New tokens `brand-red` (the logo's
#FF0001, logo and brand documents only) and `brand-red-ink` (#C8000F, for any ordinary red text).

**Checked:** lint, typecheck, 137 tests, build. The whole journey driven in Chrome at 390 and
1440 px: shop page → Order now (quantity and finish carried over) → minimum and Terms checks → order
placed → M-Pesa prompt → paid with a receipt → repeated callback ignored → proof → approved →
production 120 of 120 → handed over → completed → invoice with balance KES 0.00 and the amount in
words; a cancelled prompt shows its message and keeps the order waiting. No JavaScript errors, no
sideways scroll. `npm run a11y`, `menu` and `devices` include the new pages.

**Not in Phase 1** (later phases of the spec, or the backend):
- Real M-Pesa (Absa STK Push and C2B, or Daraja), real WhatsApp and email, real uploads, storage:
  the backend. **The mock keeps orders in server memory**: they vanish on a restart, and on the Vercel
  preview separate server instances don't share them, so an order can occasionally "disappear" there.
- Customers approving proofs and asking for changes on the order page, pinned comments, the balance
  payment request messages, production logging, pickup codes, delivery records: spec Phase 2. (The
  methods exist and are tested; the demo controls use them.)
- Accounts, brand kits, reorder, survey booking by the customer, the firm-quote builder and sign-off:
  spec Phase 3. Capacity calendar, mockups, artwork file checks, reports: Phase 4.
- The **staff order board**: the spec's Phase 1 lists it, but it belongs to the back office, which
  stays out of the public site. It comes with the backend.
- Cart for several items in one order: one item per order for now. The quote list stays for "ask
  us first" requests.

## Online ordering, Phase 4: polish (6 Oct 2026)

Still mocked. With this the order workflow spec's four phases are all on the site.

- **Capacity calendar** (`src/lib/capacity.ts`): each quantity run goes through one machine
  (`machineFor`: screen press, DTF, embroidery, sublimation, engraving, digital press, binding,
  wide-format), each with pieces a day (`MACHINES`, TODO(business)). `allocate` fills free capacity
  day by day. `estimatePrice(…, calendar)` switches off express and rush when the workshop can't
  finish in time ("Fully booked: the earliest we can finish is …") and moves economy and standard
  dates later. The order form gets the calendar from `api.getCapacity()`; the API prices against it
  again, refuses a deadline that has filled up, and reserves the order's slot (released when an
  unpaid order expires). The mock seeds four busy days on the presses so the effect shows. The
  production ETA uses the same machine figures.
- **Mockups:** each proof can carry `mockup`, the design on the item (a tee, a mug, cards, a banner
  stand, a page), shown under the flat proof. The mock draws them (`mockupImage` in `mock-art.ts`); the
  backend will store the designer's.
- **Artwork file check** (`src/lib/artwork-check.ts`): when "print-ready artwork" is chosen, each
  picked file is read in the browser (first 4 MB) and checked against the product's finished size
  (`PRINT_SIZES`, TODO(business)): under 150 dpi, RGB (PNG, JPEG channels, PDF colour spaces) and no
  bleed (image proportions, PDF BleedBox). Warnings never block the order. The backend runs the same
  check on the real upload.
- **Reports for customers:** `/account/statement`, a printable statement of account (invoices as
  debits, confirmed payments as credits, running balance, `src/lib/statement.ts`), and
  `/account/statement.csv` (signed-in only, formula-safe CSV). Staff reports belong to the back office.
- **Company accounts** (`/account`, "Ordering for a company?"): the owner sets up the company (name,
  KRA PIN), adds colleagues by phone as "orders" or "orders and approves proofs" and removes them.
  Members' orders carry the company and a PO or LPO number (asked on the order form; the server takes
  the company from the session, never from the browser) and print them on the invoice. Proofs on a
  company order are approved only by the owner or an approver, who see colleagues' orders in their
  account and open them without the link. `approveProofAction` tries the signed-in account first.
- **Mock state** lives on `globalThis` (`mock-store.ts`), because Next.js bundles route handlers apart
  from pages and each bundle would otherwise keep its own maps.
- **New SiteApi methods:** `getCapacity`, `getStatement`, `createCompany`, `addCompanyMember`,
  `removeCompanyMember`; `estimatePrice` takes the calendar; `OrderInput.company`, `Order.company`.
- Checks: 203 tests.

## Online ordering, Phase 3: accounts and site jobs (6 Oct 2026)

Still mocked (`src/lib/api/mock-accounts.ts`, `mock-orders.ts`).

- **Sign-in** (`/account`, `components/account/SignInForm.tsx`): email, then a six-digit code sent
  there; no passwords. (Built with a WhatsApp code on 6 Oct; switched to email on 8 Oct because
  Meta charges about US$0.004 for every WhatsApp authentication message in Kenya, and email is
  free.) Codes last 10 minutes, allow 5 tries and can be resent after a minute; the session is an
  httpOnly cookie (`nb-session`) for 30 days (`src/lib/account.ts`: `normaliseEmail`, `maskEmail`).
  The mock shows the code on the page ("Demo: …"); the server action passes it on only in mock mode,
  and the backend must never return it.
- **The account is its verified email** (lower case): every order placed with that email is listed,
  guest orders included, so there is nothing to claim. Its orders also open without the secret link
  (`loadOrder` and `resolveAccess` fall back to the session, as `{ email }` access, which is only
  ever built from a session). The phone is a detail on the account, for M-Pesa and delivery; it and
  the name start from the latest order. Guests still find an order with its number and phone.
- **Company members** are added and recognised by email; a member's order is a company order when
  they order with their own email, and proofs are approved by an owner or approver signed in.
- **Brand kit** (colours, fonts, logo file names, notes) and up to five **delivery addresses**. A new
  order starts with the account's details, brand kit and first address (`startingDraft` in
  `src/app/order/new/page.tsx`; the server still checks and prices everything).
- **Order again**: quantity runs with an approved proof show "Order again", which opens the form with
  the past order's choices and the approved artwork (`artwork: print-ready`, so no design fee) and a
  note naming the order (`reorderDraft`, `draftBriefFrom`).
- **Site jobs (Mechanism B)**, end to end on the order page (`components/order/SiteJobPanels.tsx`):
  survey fee → choose the survey date (preferred dates are one tap) → staff send the **firm quote**
  from the quote builder (`src/lib/site-quote.ts`: price per m² per material with a minimum per item,
  fitting by area, extras such as a county permit; valid 14 days) → the customer accepts and pays
  half → design proof → **installation date** (two working days' notice, working days only) →
  stages logged → signed off on site → balance (the survey fee comes off it) → completed. The
  tracker follows the quote, not just the status (`orderTrackIndex`). The invoice lists the quote's
  lines once accepted.
- **New SiteApi methods:** `acceptSiteQuote`, `bookInstall`, `requestSignInCode`, `verifySignInCode`,
  `getAccount`, `updateAccount`, `saveBrandKit`, `saveAddress`, `removeAddress`, `reorderDraft`,
  `signOut`. Demo control: "survey done, send the firm quote".
- Links: "Your account" in the footer and on `/order`. Checks: 188 tests; `npm run a11y` signs in.

## Online ordering, Phase 2: proofs and production (6 Oct 2026)

Still mocked (`src/lib/api/mock-orders.ts`); the contract in `src/lib/api/order-types.ts` grew so the
backend can serve the same shapes.

- **Proof review** (`components/order/ProofReview.tsx`, on `/order/[ref]` while a proof waits): the
  proof is watermarked PROOF; tapping it pins a numbered note there (keyboard: Enter pins the
  middle; "Add a note about the whole proof" pins none). Approving needs every checklist item
  ticked, including "printed colours may vary"; it is refused while notes are pinned. Sending
  changes needs a note or a pin and uses a revision round. The server action and the API both
  check again (`src/lib/proof.ts`: `coerceChecklist`, `coercePins`, `changeRequestError`).
- **Every version is kept** with its pins and notes ("Earlier versions" / "Proofs", `ProofFigure.tsx`).
  The mock draws proofs as SVG from the brief (`mock-art.ts`: colours, company, words; no people);
  the backend will return signed links to the designer's files.
- **Balance gate:** approval asks for the balance; production starts only on its confirmed callback.
  The promised date counts from that day (`production.startedOn`, `promisedBy`).
- **Pre-production sample** for runs of 200 pieces or more (`SAMPLE_THRESHOLD`): staff photograph
  one piece, the customer approves it or asks for a new one; production can't be logged before.
- **Production log and ETA** (`src/lib/production.ts`): each log is "N printed"; the ETA divides the
  pieces left by the recent rate (once logs span two working days) or the product's daily capacity
  (`DAILY_CAPACITY`, TODO(business)), and the order shows "On track" or "At risk".
- **Handover:** pickup orders get a six-digit pickup code when ready; the order completes only when
  staff enter the matching code (the collector's name is recorded). Delivery orders get a delivery
  record with the rider and phone (or a courier waybill countrywide) and the recipient. While
  printing, a delivery customer can ask for finished pieces early: each early batch is its own
  delivery record (`partialDeliveryError` sets the limits).
- **New SiteApi methods:** `approveProof(ref, access, version, checklist)`,
  `requestChanges(ref, access, version, comments, pins)`, `reviewSample`, `requestPartialDelivery`.
- **Demo controls** add "photograph a sample" and "move the early delivery on"; "hand over" now
  gives the pickup code, then checks it.
- Checks: 172 tests; `npm run a11y` has a "proof review" state.

### 6 Oct 2026: colours, receipts, Absa C2B

- **The logo's colours across the site.** The accent is now the logo's red (#D7000F, a shade deeper
  than the logo's pure red so white text on it passes AA); text on red is white (`text-on-accent`);
  red text uses `accent-ink` (#C8000F). Type is the logo's black (#111111). The one dark section is
  black (`dark`, renamed from `navy`). Links are black and underlined; focus rings are red. The
  link-preview image follows.
- **Receipts.** Every confirmed payment gets a receipt number (RCT00001…), shown in the payments
  table with a link to `/order/[ref]/receipt/[no]`: a printable receipt in the invoice's frame
  (received from, M-Pesa reference, against which invoice, paid to date, balance remaining, amount
  in words, PAID). Invoices and receipts share `components/order/BrandDocument.tsx`.
- **Invoices start afresh** at INV00001 (INV00870 was one of Noorcom's old invoices, not a sequence
  to continue).
- **Absa C2B routing** (`src/lib/payments/c2b.ts`, 18 tests): adapts a Daraja-style confirmation,
  finds the order number anywhere in the account reference, else matches by phone and the exact
  amount when exactly one waiting order fits, else holds the payment as unmatched with a reason. The
  mock now routes every Paybill payment through it; payments to closed orders become flagged credit.
  The site tells customers to type `2055268420#NB123456` (`invoiceIssuer.paybillAccount` in
  `src/lib/site.ts`; format to confirm with Absa). New demo control: "Paybill without the order number".
- **The backend design** is in `docs/BACKEND_RUNBOOK.md`: JavaScript (Node 22, Express, Knex,
  PostgreSQL, BullMQ), the site staying in `src/`, the backend in its own `backend/` folder (file
  by file), code both use in `shared/`, the database migrations, the STK and C2B flows and the
  ledger, numbering, endpoints, security, deployment and build steps B0 to B5. It follows Noorcom
  Computers' backend: the four code layers and money rules, **Redis** (our own user `nb`, keys `nb:*`:
  BullMQ queues, rate limits, the one-prompt-per-order lock, catalogue cache, live order updates),
  fakes for Absa, WhatsApp, email and storage until each goes live, rate limits per endpoint, and the
  VPS pieces (Postgres role, Redis ACL, units, backups, Cloudflare at cutover). Its section 12 lists
  what the site itself gains (`live.ts`, `/revalidate`, live order updates).

### 7 Oct 2026: menu, hover and speed

- **Phone menu.** Tapping Menu seemed to do nothing: the menu opened, but only 72 px tall. The
  header's `backdrop-blur` made the header the containing block for the menu's `position: fixed`,
  so `inset-0` filled the header, not the screen. The menu is now rendered next to `<header>`, not
  inside it, and the header is solid (`bg-bg`, no blur). Any `filter`, `transform` or
  `backdrop-filter` on an ancestor does the same to a fixed overlay, so keep overlays outside such
  elements. `npm run menu` now checks the open menu covers the whole screen (it passed before only
  because it checked the menu had *some* size).
- **Hover on touchscreen laptops.** Tailwind v4 wraps every `hover:` in `@media (hover: hover)`,
  which asks about the *primary* pointer. Windows touchscreen laptops report touch, even with the
  touchscreen switched off, so every hover effect disappeared. `globals.css` redefines the variant
  with `@custom-variant hover` on `(any-hover: hover)`: on whenever a trackpad or mouse exists,
  still off on phones (no sticky hover after a tap). `group-hover:` follows it.
- **Speed.** The scroll reveals hid content until React had loaded and hydrated (seconds on a phone),
  including the home hero. Now:
  - `components/ui/RevealObserver.tsx` renders a plain inline script at the end of `<body>`: it
    runs as soon as the HTML is parsed, shows anything already on screen at once, and watches the
    DOM for later sections. `Reveal` has `suppressHydrationWarning` because the script may set
    `data-visible` before React hydrates. The `js` class (which hides reveals) is only set when
    `IntersectionObserver` exists.
  - The home hero's first column (heading and the big photo, the page's largest paint) isn't
    wrapped in `Reveal`. Don't wrap the first thing on a page in `Reveal`.
  - Next 16 deprecated `<Image priority>`, which no longer raised the fetch priority. The main image
    on each page uses `preload fetchPriority="high"`; the logo uses `loading="eager"`.
  - Lighthouse 12 on the home page: desktop **87 → 95–99**; phone (simulated) 48 → 61–71, page mostly
    drawn by 2–4.6 s instead of 6.3 s. What remains on phones is React starting up; the HTML is
    20 KB compressed and the images are already sized and AVIF/WebP. Phone scores swing by 10 points
    between runs on this machine: never run Lighthouse while `npm run devices` is running, and
    re-measure on the VPS at launch.
- **`npm run a11y` flake.** "proof review @ 390" sometimes failed with a missing `<title>`: the demo
  buttons refresh the page through a server action, which swaps the `<head>` for a moment, and axe
  could land in between. The check now also waits for the title before running axe.
- On the office machine `npm run devices` takes about 25 minutes; `a11y` and `menu` a few each.

### 7 Oct 2026: the VPS plan

`docs/VPS_BRANDING.md`, modelled on Noorcom Computers' own VPS document for the same box. The deploy
files changed to match what electronics learned there on 1 Oct 2026:

- `deploy-branding.sh` fetches `origin/main` and runs that version of itself from a private copy
  (the newest deploy logic, never a file changed underneath bash); builds in `/var/tmp`; loads
  `web.env` for the build; refuses a release missing `server.js`, `.next/static` or `public`;
  releases are `root:noorcom-branding` and read only to the service except `.next/cache`.
- `--install` gets the certificate before enabling the nginx site, and if `nginx -t` fails it puts
  the previous site back: on a shared box a broken site stops every project's nginx reload.
- `hosts.env`: `WWW_HOST` only on the live site (staging has no www name), and `NOINDEX=yes` on
  staging adds `X-Robots-Tag: noindex, nofollow`. The examples carry the staging name.
- nginx repeats HSTS in the `/_next/static` location (a location's own `add_header` drops the
  server's).
- The standalone build was started locally and answers 200 on `/`, `/robots.txt`, `/order` and a
  shop page; the nginx template renders correctly for staging and for live.

## 9. Decisions log

Newest first.

| Date | Decision | Why |
| --- | --- | --- |
| 8 Oct 2026 | **The minimum run is 10 pieces** (was a stand-in 50), on the shop, the order form and the service pages; the first price tier starts at 10 at the old 50-piece price; staff set a product's own minimum in the back office (Products, admins only) | Owner's decision |
| 8 Oct 2026 | Backend B4: the back office is its own app (`admin/`, Vite + React) on the same origin under `/admin/`, with a staff cookie scoped to `/api/staff`; staff passwords use scrypt from Node itself; proofs were built now rather than in B5 and are watermarked as an SVG around the image; every staff step is audited with who did it | "Staff run an order through" needs proofs; same-origin keeps the cookie strict and CSRF simple; no native modules to build on the VPS |
| 8 Oct 2026 | Backend B3: every payment goes through one ledger function in one transaction (order locked, M-Pesa receipt unique, RCT number, status move, messages in the outbox); callbacks are stored before they are acted on and settled by a separate worker (BullMQ under `nb:bull`); Absa's bodies are read as Daraja's until Absa's samples arrive; receipt PDFs move to a step B3b with the live Absa client | Money can't be counted twice or lost if a process dies mid-way; Absa always gets a fast answer; nothing waits on Absa's paperwork that doesn't have to |
| 8 Oct 2026 | Backend B2: an order is stored as placed (product, brief, handover and price frozen in JSONB; status, money, email and phone in columns); its token is kept only as a SHA-256 hash and travels in a header, never a URL; placing it is one transaction with the capacity calendar locked; the outbox is written in that transaction and sent by the worker after commit (B3); the site passes the visitor's address on, so per-visitor limits count visitors | Only the server's price counts; two orders can't take the same machine time; no message goes out for an order that rolled back; otherwise the site's server would count as one visitor for every limit |
| 8 Oct 2026 | **Accounts sign in with an emailed code, not WhatsApp**: an account is its verified email; orders join it by the email they were placed with; company members are added by email; the phone stays a detail for M-Pesa and delivery; guests still find an order by its number and phone | Owner's decision: Meta charges per WhatsApp authentication message (about US$0.004 each in Kenya); email from our own mailbox is free |
| 7 Oct 2026 | Backend B1: the order catalogue lives in Postgres, seeded from `shared/catalogue` (the seed adds what's missing and never overwrites, so staff edits survive deploys); the deadline tiers, delivery zones and deposit rule stay in `shared/rules/pricing.js` until the price manager (B4); the site moves to the API method by method with `NEXT_PUBLIC_API_MODE=live` | The site and the API price with the same code from the same data; a deploy can never undo a staff price |
| 7 Oct 2026 | **The site goes on the shared Contabo VPS like Noorcom Computers** (`docs/VPS_BRANDING.md`): staging at `staging.noorcombranding.co.ke` (one A record; the live name stays on Lovable until cutover), cloned with a read-only deploy key, port 4301; the database and Redis on the box | Owner's request: same arrangement as electronics |
| 7 Oct 2026 | Work moves to the office machine (`C:\noorcom-branding`). Development Redis on Windows is **Memurai** (no Docker); the database work is done mostly on the VPS, with a local Postgres 18 and Memurai for the tests | Owner's decision |
| 7 Oct 2026 | Speed and fixes: the scroll reveal is a plain inline script (not a React effect), the home hero's first column doesn't fade in, images use `preload` + `fetchPriority` (Next 16 deprecated `priority`), the header has no backdrop-blur and the menu sits outside it, hover styles use `any-hover` | The hero was invisible until React hydrated (seconds on a phone); the blur trapped the phone menu at 72px; touchscreen laptops lost every hover. Lighthouse desktop 87 → 95–99 |
| 6 Oct 2026 | Backend B0: the shared code is JavaScript + JSDoc in `shared/` (npm workspace), its types in a `.d.ts` both sides read; the site keeps its imports through re-exports | One copy of every rule, checked by both type checkers |
| 6 Oct 2026 | Company orders are approved only by the company's owner or an approver; PO numbers print on invoices | Spec "company accounts" |
| 6 Oct 2026 | Deadlines offered come from the capacity calendar; a tier the workshop can't meet is switched off, not sold | Spec "capacity calendar" |
| 6 Oct 2026 | Accounts sign in with the phone and a WhatsApp code only; an account is its verified phone, so guest orders join it without claiming. **Replaced 8 Oct: email** | Spec "Accounts"; no passwords to leak |
| 6 Oct 2026 | **Paybill payments go through Absa C2B on 303030**; the order number travels in the account reference (`2055268420#NB123456`, format to confirm) and is matched automatically, with phone + amount as the fallback and an unmatched queue for staff | Owner's decision |
| 6 Oct 2026 | Invoices and receipts use the main number and info@ (confirmed) and **start afresh**: INV00001, RCT00001; a receipt for every confirmed payment | Owner's decision |
| 6 Oct 2026 | **The site's colours follow the logo**: red accent with white text on it, black type, a black dark section, black underlined links | Owner's decision |
| 6 Oct 2026 | The backend is JavaScript, designed in `docs/BACKEND_RUNBOOK.md` before any code, in its own `backend/` folder; `src/` stays the frontend; code both use goes in `shared/` | Owner's decision: each side easy to debug |
| 5 Oct 2026 | **Online ordering with M-Pesa is approved to build** (docs/ORDER_WORKFLOW_SPEC.md): self-serve orders with a live price, a deposit by M-Pesa STK Push or Paybill, and an order tracker. Payments are mocked until our backend exists. This replaces the 3 Oct "add to quote only" decision for orders; the quote form and quote list stay for "ask us first" requests | Owner's instruction to start Phase 1 of the spec |
| 5 Oct 2026 | The real logo is in (`public/brand/nb-logo.png`, `nb-mark.png`), replacing the stand-in wordmark | Owner supplied it |
| 3 Oct 2026 | **The shop is "add to quote" only**: no cart payment or M-Pesa. Products go into a quote list; the quote form sends it with artwork, quantities and deadline | Owner's decision; most branding jobs need artwork and a proof first |
| 3 Oct 2026 | **Logo:** Noorcom already has a refreshed logo; the owner will share it. Until then the site uses a text wordmark ("NOORCOM / BRANDING") in one component, so the real logo drops in one place. We do not design a new logo | Owner's decision |
| 3 Oct 2026 | Prices are per piece; minimum order 50 for every product until confirmed | Owner's decision |
| 3 Oct 2026 | Deploy on our VPS beside Noorcom Computers, same layout, port 4301; old Lovable checkout and order pages redirect to `/quote`, its admin and sign-in to the home page | Owner's decision (VPS like the other projects) |
| 3 Oct 2026 | Scroll reveals use one shared observer instead of a client component each | Phone start-up time: blocked time on the home page cut by two thirds |
| 3 Oct 2026 | No smooth-scroll library or page transitions | Weight on phones on mobile data; the site already has motion that respects reduced motion |
| 3 Oct 2026 | Shop quantities: the minimum (50 for now) is enforced on the product page, in the quote form and on the server; prices shown are estimates "before design and delivery", confirmed in the quote | Prices per piece with a minimum, owner's decision |
| 3 Oct 2026 | The service ticker's separators are small orange circles | Owner's request |
| 3 Oct 2026 | Quote requests: artwork file names travel with the request, the files themselves go by WhatsApp or email until our backend takes uploads | No backend in scope yet |
| 3 Oct 2026 | **Address:** Chuka Elimu Plaza, 1st Floor, Loita Street, Nairobi, the same premises as Noorcom Computers | Owner's decision |
| 3 Oct 2026 | **No registration (crosshair) marks** anywhere on the site | Owner's request |
| 3 Oct 2026 | The workshop printer photo stays on the home page, as a full-width band after the service ticker | Owner's request |
| 3 Oct 2026 | **No people in any photo** on the site; the photos with people were replaced and the van photo cropped | Owner's decision (replaces the earlier rule that people shown be Black African) |
| 3 Oct 2026 | **The home page opens on the work, not a slogan**: a BP&O-style split, "Latest" (newest project, large) beside "Discover" (next four, 2×2), with a thin divider. The headline hero and the Selected work section were removed | Owner's request, from bpando.org |
| 3 Oct 2026 | Placeholder photos from the internet (free licence) until real job photos arrive | Owner's decision |
| 3 Oct 2026 | Repo: https://github.com/Noorcom-Network-NNL/noorcom-branding, branch `main` | Owner's decision |
| 3 Oct 2026 | **Design and frontend first; no backend now.** When there is one it is entirely our own: no Supabase, nothing from Lovable. Data goes through a mock behind one interface | Owner's decision |
| 3 Oct 2026 | Rebuild from scratch in this folder; do not reuse the Lovable code | The live site is a template SPA with empty HTML, mixed admin, and no portfolio |
| 3 Oct 2026 | Reuse the Noorcom Computers stack and working method | One way of working across both company sites |

## 10. Open questions for the owner

1. **Direction:** happy with "studio with a print shop" (work first), or should the shop lead?
2. **Fonts:** Bricolage Grotesque + Inter (in use by default), or one of the alternatives?
3. **Real minimum quantities** per product (50 is a stand-in).

Answered: back office (our own, later, no Supabase); git repo (given 3 Oct 2026); photos
(placeholders now, real ones later); shop is add-to-quote (replaced 5 Oct by online ordering);
prices per piece; hosting on our VPS; the logo arrived (5 Oct 2026); online payment approved to build (5 Oct 2026).

Online ordering (5 Oct 2026; the full list is in `docs/ORDER_WORKFLOW_SPEC.md`, "Open questions"):

4. Every price tier, fee, lead time, deposit rule, delivery zone and survey fee is a proposal
   (`TODO(business)` in `order-catalogue.ts`, `pricing.ts`, `calendar.ts`).
5. From Absa: the items in `docs/BACKEND_RUNBOOK.md`, section 14, above all the Paybill account
   format that carries the order number.
6. Production: the sample threshold (200 pieces proposed), pieces a day per machine
   (`DAILY_CAPACITY` in `src/lib/production.ts`), and whether an early (partial) delivery costs
   an extra delivery fee (the site says we confirm it on WhatsApp first).
7. Site jobs: the rates per m² per material, the fitting rate and minimum, the county permit
   estimate and how long a firm quote stays valid (`src/lib/site-quote.ts`, all TODO(business)).
8. The workshop: pieces a day per machine (`MACHINES` in `src/lib/capacity.ts`) and the finished
   size of each product's artwork (`PRINT_SIZES` in `src/lib/artwork-check.ts`).
9. Company accounts: whether companies get invoice terms (pay within 30 days against an LPO)
   instead of paying up front; today they pay like everyone else.

Answered 6 Oct 2026: accent colour (the logo's red), Paybill (Absa C2B on 303030), invoice contacts
(main number and info@), invoice numbers (start afresh at INV00001; receipts RCT00001).
