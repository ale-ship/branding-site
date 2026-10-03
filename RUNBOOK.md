# Noorcom Branding Website Runbook

Last updated 3 Oct 2026. This is the handover document: read it first in a new chat or on a new
machine. It records what the project is, what we found, every decision and why, and what comes
next. Update it at the end of every task.

## Where we are right now

- **Phases 1 and 2 are built** (3 Oct 2026): the home page, the Work archive and the case-study
  page. Repo: https://github.com/Noorcom-Network-NNL/noorcom-branding, branch `main`.
- **Scope for now is design and frontend only.** No backend, no Supabase, nothing from Lovable.
  Data comes from local typed content behind one data interface (`SiteApi`, mock only), so our own
  backend can plug in later without page changes.
- **Pages so far:** `/`, `/work`, `/work/[slug]`. Links to Services, Shop, About, Contact and Quote
  show the styled 404 until their phases are built.
- **Next:** Phase 3 (Services pages and the quote form).

## Start here on a new machine

1. Install Node.js 22 or newer and Git.
2. `git clone https://github.com/Noorcom-Network-NNL/noorcom-branding.git`, then `cd noorcom-branding`
   and `npm install`.
3. `npm run dev`, then open http://localhost:3000.
4. Before handing over a task: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
   (stop the dev server before building; both use `.next/`).

The placeholder photos are committed in `public/images/placeholder` (`npm run photos` re-downloads them).
Project rules for Claude are in `AGENTS.md` (loaded through `CLAUDE.md`).

## Resuming work with Claude Code

Claude does not know this file exists unless told. Start a new chat with something like:

> Read RUNBOOK.md in C:\Users\USER\Downloads\Noorcom-branding first. We are rebuilding
> noorcombranding.co.ke from scratch. Continue with the next unfinished phase, then stop for review.

When Claude finishes a task it should update this runbook (what changed, decisions, open items),
and stop so the owner can review it in the browser.

Our sister project, the **Noorcom Computers** store, lives in `C:\ne` (monorepo; storefront in
`apps/website-frontend`, its own `RUNBOOK.md`). We reuse its working method, stack and quality bar,
but **this site is a separate project and never imports from it.**

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
| 3 Services and quote | Service pages; `/quote` flow sending to email and WhatsApp | To do |
| 4 Shop | Product catalogue and product pages; quote list (drawer) that feeds `/quote` | To do |
| 5 Content and polish | About, contact, legal, 404; SEO, social images, JSON-LD; motion pass; accessibility and performance pass | To do |
| 6 Launch | Hosting, our own backend and back office (separate project, later), DNS cutover from Lovable, redirects, Google Search Console | Later |

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
| `src/components/layout/` | `Header` (sticky; full-screen menu below 1024 px, a modal with focus trap and Escape), `Footer`, `Logo` (stand-in wordmark), `WhatsAppButton` |
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
ticker now uses small orange squares); the shared address in the footer (links to Google Maps) and in
site-wide `LocalBusiness` JSON-LD; extra footer bottom space so the WhatsApp button never covers it.

**Checked:** lint, typecheck, 22 tests, build. `/`, `/work`, `/work?service=apparel` and a case study
emulated at 320, 390, 768, 1024, 1440 and 1920 px: no horizontal overflow.

## 9. Decisions log

Newest first.

| Date | Decision | Why |
| --- | --- | --- |
| 3 Oct 2026 | **The shop is "add to quote" only**: no cart payment or M-Pesa. Products go into a quote list; the quote form sends it with artwork, quantities and deadline | Owner's decision; most branding jobs need artwork and a proof first |
| 3 Oct 2026 | **Logo:** Noorcom already has a refreshed logo; the owner will share it. Until then the site uses a text wordmark ("NOORCOM / BRANDING") in one component, so the real logo drops in one place. We do not design a new logo | Owner's decision |
| 3 Oct 2026 | Prices are per piece; minimum order 50 for every product until confirmed | Owner's decision |
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
(placeholders now, real ones later); shop is add-to-quote; logo refreshed by Noorcom, file to come;
prices per piece; hosting on our VPS.
