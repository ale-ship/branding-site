# Noorcom Branding website

Public website for Noorcom Branding, Nairobi. Next.js App Router, TypeScript (strict), Tailwind CSS v4, lucide-react, Vitest. Design and frontend only for now: all data comes from a typed mock. Read `RUNBOOK.md` first.

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`: all four must pass before a task is handed over
- `npm run photos`: re-downloads the placeholder photos into `public/images/placeholder` and rewrites `CREDITS.md`

## Architecture rules

- Pages and components get data only through `api` from `@/lib/api` (the `SiteApi` interface in `src/lib/api/types.ts`). Never import `src/lib/api/data/*` or `mock.ts` outside `src/lib/api/`. No Supabase, nothing from Lovable: our own backend will implement `SiteApi` later.
- Business details and navigation live in `src/lib/site.ts`, not in components.
- Colours are CSS variables in `src/app/globals.css`, mapped in `@theme inline` (`bg-paper`, `text-heading`, `bg-accent`...). Tailwind's default palette is removed, so hex values and default colour classes won't work in components (the one exception: a project's own `palette` values, shown as swatches).
- Look: white and warm `paper` pages, navy-black type, the logo's orange `accent` as fills only (orange text uses `accent-ink`), square corners, real photography, at most one `navy` section per page. Bricolage Grotesque (`font-display`) for headings, Inter for text.
- Signature details are in `components/ui/PrintMarks.tsx`: `CropMarks`, `RegMark`, `CmykDots`, `Swatches`, `Eyebrow`. Use them; don't invent new decoration.
- Motion: `Reveal` for scroll reveals, `Marquee`, `RotatingBadge`. Everything must stand still under `prefers-reduced-motion` and show without JavaScript.
- Photos of people show Black African people, never white people. Applies to every placeholder and any new image. Prefer photos of the work itself.
- The shop is add-to-quote only: prices per piece, a minimum quantity, no payment.
- Sample projects carry `sample: true` and show a "Sample" tag until real work replaces them.
- The logo is a stand-in wordmark in `components/layout/Logo.tsx`; the real logo replaces it there only.
- Prefer server components; add `'use client'` only to interactive leaves.
- Don't pass `hidden` to a component whose base classes set `display` (ButtonLink is `inline-flex`): wrap it instead.
- Responsive: mobile first; check 320, 360, 390, 768, 1024, 1440 and 1920 px with no horizontal overflow; 44 px touch targets; visible focus; alt text on every content image.
