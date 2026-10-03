# Noorcom Branding website

Public website for Noorcom Branding, Nairobi. Next.js App Router, TypeScript (strict), Tailwind CSS v4, lucide-react, Vitest. Design and frontend only for now: all data comes from a typed mock. Read `RUNBOOK.md` first.

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`: all four must pass before a task is handed over
- `npm run photos`: re-downloads the placeholder photos into `public/images/placeholder` and rewrites `CREDITS.md`
- `npm run a11y`, `npm run devices`, `npm run menu`: browser checks against a running production server (`BASE=http://localhost:3100`)

## Architecture rules

- Pages and components get data only through `api` from `@/lib/api` (the `SiteApi` interface in `src/lib/api/types.ts`). Never import `src/lib/api/data/*` or `mock.ts` outside `src/lib/api/`. No Supabase, nothing from Lovable: our own backend will implement `SiteApi` later.
- Business details and navigation live in `src/lib/site.ts`, not in components.
- Colours are CSS variables in `src/app/globals.css`, mapped in `@theme inline` (`bg-paper`, `text-heading`, `bg-accent`...). Tailwind's default palette is removed, so hex values and default colour classes won't work in components (the one exception: a project's own `palette` values, shown as swatches).
- Look: white and warm `paper` pages, navy-black type, the logo's orange `accent` as fills only (orange text uses `accent-ink`), square corners, real photography, at most one `navy` section per page. Bricolage Grotesque (`font-display`) for headings, Inter for text.
- Signature details are in `components/ui/PrintMarks.tsx`: `CropMarks`, `CmykDots`, `Swatches`, `Eyebrow`. Use them; don't invent new decoration. No registration (crosshair) marks: the owner asked for them to be removed (3 Oct 2026).
- Motion: `Reveal` for scroll reveals, `Marquee`, `RotatingBadge`. Everything must stand still under `prefers-reduced-motion` and show without JavaScript.
- No people in any photo (owner, 3 Oct 2026): show the work, the products and the machines. Applies to placeholders and every new image; crop out people in the background (`rect` in the photo script).
- The shop is add-to-quote only: prices per piece, a minimum quantity, no payment. Items go into the quote list (`useQuoteList`, rules in `src/lib/quote-list.ts`); never add a cart or checkout.
- Quote rules live in `src/lib/quote.ts` (shared by the form and the server action). The server action (`src/app/quote/actions.ts`) must `coerceDraft` and validate again; never trust the browser. Pages link to the form with `serviceQuoteHref(slug)` to preselect a service.
- Sample projects carry `sample: true` and show a "Sample" tag until real work replaces them.
- The logo is a stand-in wordmark in `components/layout/Logo.tsx`; the real logo replaces it there only.
- Prefer server components; add `'use client'` only to interactive leaves.
- Don't pass `hidden` to a component whose base classes set `display` (ButtonLink is `inline-flex`): wrap it instead.
- Responsive: mobile first; check 320, 360, 390, 768, 1024, 1440 and 1920 px with no horizontal overflow; 44 px touch targets; visible focus; alt text on every content image.
- Before handing over: `lint`, `typecheck`, `test`, `build`, then `a11y`, `devices` and `menu` against a production server (`BASE=http://localhost:3100`). All must pass.
- Deploy files are in `deploy/` (VPS, port 4301); see RUNBOOK.md, "Deploying to the VPS". Never commit real env files.
