# Noorcom Branding Backend Runbook

Last updated 8 Oct 2026. The design of the backend behind the website: the stack, the file layout,
the database, the API, the payment flows and the order to build it in. **Steps B0 to B2 are built**
(section 13: the skeleton and `shared/`, the catalogue and price, orders); the rest is the plan to
build from. Read `docs/RUNBOOK.md` (the site) and `docs/ORDER_WORKFLOW_SPEC.md` (the order workflow)
first.

## 1. What the backend does

The website already works end to end against a mock (`src/lib/api/mock.ts`). The backend replaces that mock with the real thing:

- Stores catalogue, orders, payments, proofs, production logs, files and customers.
- Takes M-Pesa payments through **Absa**: STK Push for the prompt on the phone, and **Absa C2B on
  Paybill 303030** for payments made by Paybill. Daraja is the fallback provider if Absa stalls.
- Issues **invoices (INV00001…) and receipts (RCT00001…)** as numbered records and PDFs.
- Sends WhatsApp (Cloud API templates) and email; never SMS.
- Stores uploads (logos, artwork, proofs, photos) in object storage behind signed URLs.
- Serves the staff back office (order board, production logging, unmatched payments, prices).

The rules it must keep are the spec's "Rules the backend must enforce" and the site's own: the
server prices every order; an order moves only on a confirmed callback; a receipt number credits
once; printing starts only after approval and payment.

## 2. Stack

JavaScript throughout the backend (owner, 6 Oct 2026), on the same footing as Noorcom Computers so
one team can work on both.

| Need | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 22 LTS, ES modules (`"type": "module"`) | Same as the site and Noorcom Computers |
| Types without TypeScript | JSDoc annotations + `// @ts-check`, checked by `tsc --noEmit` (`checkJs`) in CI | Catches mistakes while staying JavaScript |
| HTTP | Express 5 | What Noorcom Computers uses; plain and well known |
| Validation | zod | One schema for runtime checks and for the types the site reads |
| Database | PostgreSQL (the VPS runs 17) through `pg` (node-postgres) in the repos; Knex for migrations and seeds only | Transactions and row locks for payments; the same split as Noorcom Computers |
| Redis | Redis 7 through `ioredis`, our own ACL user `nb`, every key `nb:*` (section 2.2) | Queues, rate limits, short locks, cache, the fakes' state |
| Jobs | BullMQ on that Redis (`prefix: 'nb:bull'`), a separate worker process | Callbacks are acknowledged fast; work happens after commit |
| Files | S3-compatible storage (Cloudflare R2), `@aws-sdk/client-s3` presigned URLs | Proofs and logos never public |
| PDFs | Playwright (Chromium) printing the same HTML templates the site shows | One design for screen and PDF |
| Email | nodemailer over SMTP from `info@noorcombranding.co.ke` | |
| WhatsApp | Meta WhatsApp Business Platform (Cloud API), approved templates | Spec, "Notifications" |
| Staff auth | Sessions in Postgres, httpOnly cookie, argon2 password hashes | |
| Logs | pino (JSON), request ids | |
| Tests | Vitest; supertest for HTTP; a separate test database and Redis database | |
| Lint | ESLint with an import rule for the layers (section 2.1) and `max-lines: 250` | Keeps files small and the layers honest | |

These choices follow Noorcom Computers' backend, so one team works the same way on both.

### 2.1 Code rules

**Layers.** Every module in `backend/src/modules/<name>/` has the same four files, and an ESLint
import rule enforces who may call whom:

| Layer | May | May not |
| --- | --- | --- |
| `routes.js` | Declare paths, guards and rate limits; point at controller functions | Hold logic |
| `controller.js` | Parse the request with a zod schema from `shared/contract`, call one service function, send the answer | Import the database, integrations or queues |
| `service.js` | Business rules; open transactions; call repos with the transaction; call integrations **outside** any transaction; enqueue jobs **after** commit | Build SQL |
| `repo.js` | SQL through `pg`; every function takes the client or transaction first | Call the network, Redis or queues |
| `integrations/*` | Talk to one outside system (Absa, Daraja, WhatsApp, SMTP, R2) | Touch Postgres |
| `jobs/handlers/*` | Call services | Build SQL or call integrations directly |

**Money.**
1. Amounts are whole shillings in `INTEGER` columns.
2. The server prices every order (`shared/rules/pricing.js`); a price from the browser is never used.
3. Order lines keep the price agreed; a later price change never changes an existing order, invoice or receipt.
4. Every change to an order's paid state runs in one transaction with the order row locked (`SELECT … FOR UPDATE`).
5. An M-Pesa receipt number is unique; a second callback for it changes nothing.
6. Jobs and messages that follow a payment are queued **after** the transaction commits.
7. No network call inside a transaction.

**Other rules.** Postgres `date` columns come back as `YYYY-MM-DD` strings, never JS `Date`. Times
are stored in UTC and shown in `Africa/Nairobi`. Personal data never goes in URLs, logs or error
messages; phone numbers are masked in logs. Every change a staff member makes is in the audit log
with who made it. The order's secret token is stored only as its SHA-256 hash.

### 2.2 Redis

One Redis on the VPS, shared with Noorcom Computers (`ne:*`) and Noorcom Hosting (`nn:*`): our ACL
user `nb` can only touch keys starting `nb:` (section 10). Postgres is the record of truth; nothing
in Redis is the only copy of anything that matters.

| Keys | What | Lifetime |
| --- | --- | --- |
| `nb:bull:*` | BullMQ queues and jobs (`prefix: 'nb:bull'` on every queue and worker) | Kept by BullMQ: completed jobs trimmed to the last 1,000, failed kept 7 days |
| `nb:rl:<name>:<ip>` | Rate-limit counters (section 8.1) | The limit's window |
| `nb:stk:lock:<orderNo>` | One M-Pesa prompt at a time per order (`SET NX EX 75`) | 75 s, or deleted when the callback lands |
| `nb:callback:seen:<receipt>` | Fast drop of a repeated callback before it reaches the database (the unique column stays the authority) | 24 h |
| `nb:cache:catalogue` | The catalogue answer; deleted when staff change a product, price or tier | 10 min |
| `nb:order:events:<orderNo>` | Pub/sub channel: the API publishes when an order changes, so the order page can update live (server-sent events) instead of polling every 3 s | Not stored |
| `nb:otp:<email>` | A sign-in code's hash, tries left and when it was sent (code 6 digits, 5 tries, resend after 60 s) | 10 min |
| `nb:session:<hash>` | A customer session (phone); the cookie holds the token, Redis only its hash | 30 days, sliding |
| `nb:fake:*` | The fakes' state in development and staging (section 2.3) | 1 day |

`/api/health` pings Redis and reports it. If Redis is down, the API still answers reads; anything
that needs a queue or a lock answers 503 `try_again`, and nothing is lost because the callbacks are
stored in Postgres first.

### 2.3 Integration modes: fakes until each goes live

Absa, Daraja, WhatsApp and email are built against **fakes** that behave like the real services,
keep their state in Redis (`nb:fake:*`) and fail on request. Each goes live on its own, proven with
one small real transaction on staging.

| Integration | Mode variable | Fake behaviour |
| --- | --- | --- |
| Absa STK Push and status query | `ABSA_MODE` | Accepted, then about 6 s later an Absa-shaped callback goes through the real callback route, store and ledger. Phone ending `0`: cancelled. `1`: no callback (exercises the status query). `2`: failed. Anything else: paid (the same rule as the site's mock) |
| Absa C2B | `ABSA_MODE` | `POST /api/dev/c2b` (fake mode only) posts an Absa-shaped confirmation through the real route, so routing, the unmatched queue and receipts are tested end to end |
| Daraja (fallback) | `DARAJA_MODE` | As Absa |
| WhatsApp | `WHATSAPP_MODE` | Messages written as JSON to `WHATSAPP_OUTBOX_DIR` |
| Email | `SMTP_HOST` empty | Messages written as `.eml` files to `.mail-outbox/` |
| Files (R2) | `STORAGE_MODE` | Files kept on disk under `.storage/` with the same signed-URL interface |

Each integration has `live.js`, `fake.js` and an `index.js` that picks one; services import only
`index.js`. Rules that keep fakes safe:

1. `/api/health` reports every mode, and the staff back office shows a banner when any is `fake`.
2. `config.js` refuses to start when a mode is `fake` and `PUBLIC_URL` is the live site.
3. `config.js` refuses to start when a mode is `live` and its credentials are missing.
4. Live credentials exist only on the VPS, never on a developer's machine.

## 3. Repository layout

The frontend stays exactly where it is, in `src/`; the backend gets its own `backend/` folder beside
it (owner, 6 Oct 2026), so each side is easy to find and debug on its own. The little code both need
(pricing, working days, C2B routing, the order rules, the document templates) lives once in
`shared/`, so the site and the backend can never disagree about a price or a payment.

```text
noorcom-branding/
├─ src/                         THE FRONTEND: the Next.js site, as today
│  └─ lib/api/
│     ├─ mock.ts                stays, for local work and tests
│     └─ live.ts                NEW: SiteApi over HTTP to the backend (server-side fetch to 127.0.0.1:4300)
├─ public/                      the site's images and logo
├─ backend/                     THE BACKEND: HTTP API + worker, JavaScript (section 4)
│  ├─ package.json              its own dependencies and scripts
│  ├─ src/                      the backend's code
│  └─ test/
├─ shared/                      used by both sides, JavaScript + JSDoc
│  ├─ package.json              @noorcom-branding/shared (an npm workspace)
│  ├─ rules/                    calendar, phone, format, pricing, capacity, c2b, proof, production, site-quote,
│  │                            statement, account, artwork-check (moved from src/lib at step B0)
│  ├─ contract/                 order-types.d.ts and content.d.ts (the types both sides read), errors.js
│  │                            (OrderError); the zod schemas join them as the endpoints need them (B1, B2)
│  └─ documents/                invoice, receipt and job-card HTML templates (site pages and PDFs)
├─ admin/                       the staff back office, Vite + React in JavaScript (later, step B4)
├─ deploy/                      nginx, systemd, env templates, scripts (section 10)
├─ docs/                        RUNBOOK.md, ORDER_WORKFLOW_SPEC.md, BACKEND_RUNBOOK.md
└─ package.json                 the site's; npm workspaces: backend, admin, shared
```

**Debugging each side.** `npm run dev` at the root runs the site (port 3000) against the mock, as
today. `npm run dev` in `backend/` runs the API (port 4300) and `npm run worker` the job worker.
Setting `NEXT_PUBLIC_API_MODE=live` points the site at the local API, so a problem can be narrowed
to one side at a time. Logs from the API carry a request id that the site passes along.

**Types across the line (as built at B0).** `shared/` is JavaScript with `// @ts-check` and JSDoc;
its types come from `shared/contract/order-types.d.ts`, a declarations file both sides read. The site
imports it through the path alias `@shared/*` (with `allowJs`, so the site's strict `tsc` checks
`shared/` too); the old `src/lib/pricing.ts` and friends are one-line re-exports, so no page changed.
The backend imports it as the workspace package `@noorcom-branding/shared/rules/pricing.js` and checks
it with its own `tsc -p jsconfig.json`. JSDoc type imports inside `shared/` use explicit `.js`
extensions (Node's resolution needs them; the site's accepts them). The rules' tests stay in
`src/lib/*.test.ts` and run with the site's `npm test`.

## 4. The backend (`backend/`), file by file

```text
backend/
├─ package.json            scripts: dev, start, worker, migrate, migrate:make, seed, test, check
├─ jsconfig.json           checkJs, strict
├─ knexfile.js             DATABASE_URL / TEST_DATABASE_URL
├─ .env.example            every variable in section 11, no values
├─ src/
│  ├─ server.js            entry: builds the app, listens on 127.0.0.1:4300, graceful shutdown
│  ├─ worker.js            entry: starts the BullMQ workers in src/jobs
│  ├─ app.js               Express app: middleware in order, routes mounted under /api, error handler
│  ├─ config.js            the ONLY place process.env is read; validated with zod at start-up
│  │
│  ├─ db/
│  │  ├─ pool.js           the `pg` pool, `withTransaction(pool, fn)`, `dbHealthy`; dates come back as text
│  │  ├─ migrations/       one file per change, numbered (section 5)
│  │  └─ seeds/
│  │     ├─ 01-catalogue.js       categories, products, tiers from shared/contract's catalogue
│  │     ├─ 02-settings.js        urgency tiers, delivery zones, deposit rule, Paybill details
│  │     └─ 03-owner.js           the first admin (password typed at the prompt)
│  │
│  ├─ lib/                 small, pure helpers
│  │  ├─ errors.js         AppError(code, status, message); the error handler maps them to JSON
│  │  ├─ ids.js            order numbers (NB-+6 digits, unique), secret tokens, payment ids
│  │  ├─ numbering.js      next invoice / receipt number inside a transaction (section 7)
│  │  ├─ money.js          whole shillings, formatting
│  │  ├─ phone.js          Kenyan phone normalisation (from shared/rules)
│  │  ├─ time.js           Nairobi time, working days (from shared/rules)
│  │  └─ logger.js         pino, with phone numbers masked
│  │
│  ├─ middleware/
│  │  ├─ requestId.js      x-request-id on every request and log line
│  │  ├─ rawBody.js        keeps the raw body for provider callbacks (signature checks, audit)
│  │  ├─ validate.js       zod schema per route: body, params, query
│  │  ├─ rateLimit.js      Redis-backed limits (`nb:rl:*`), section 8.1
│  │  ├─ customerAccess.js the order's secret token, order number + phone, or the session's phone
│  │  │                    (the customer's own orders, and a company approver's colleagues')
│  │  ├─ customerSession.js the `nb-session` token → customer (hash looked up in Redis)
│  │  ├─ staffAuth.js      session cookie → staff user + role; `requireRole('production')`
│  │  └─ providerGuard.js  callbacks: secret path segment, Absa IP allowlist, signature if offered
│  │
│  ├─ modules/             one folder per domain: routes.js → controller.js → service.js → repo.js (section 2.1)
│  │  ├─ catalogue/        GET /api/catalogue
│  │  ├─ pricing/          POST /api/quotes/price, using shared/rules/pricing.js
│  │  ├─ orders/
│  │  │  ├─ routes.js      POST /api/orders, GET /api/orders/:no, POST /api/orders/lookup
│  │  │  ├─ service.js     create (re-validate + re-price), read for the customer, cancel
│  │  │  ├─ status.js      the state machine: allowed moves only (spec, "Order statuses")
│  │  │  ├─ expiry.js      unpaid after 48 h → Expired (called by a job)
│  │  │  └─ repo.js
│  │  ├─ payments/
│  │  │  ├─ routes.js      POST /api/payments/stk; provider callbacks (below)
│  │  │  ├─ stk.service.js start a prompt: one pending at a time per order; store the request id
│  │  │  ├─ ledger.js      THE place money is recorded (section 6): lock order, insert payment,
│  │  │  │                 unique receipt, receipt number, amounts, status move, all in one transaction
│  │  │  ├─ c2b.service.js store the raw confirmation, route it (shared/rules/c2b.js), record or hold
│  │  │  ├─ unmatched.js   the unmatched-payments queue: list, assign to an order, refund-flag
│  │  │  ├─ repo.js
│  │  │  └─ providers/
│  │  │     ├─ absa/
│  │  │     │  ├─ client.js     OAuth token, STK Push request, STK status query
│  │  │     │  ├─ stk.js        STK callback body → { requestId, result, receipt, amount, phone }
│  │  │     │  └─ c2b.js        `fromAbsaC2B(body)` → C2BConfirmation; register URLs helper
│  │  │     └─ daraja/          the same three files, as the fallback provider
│  │  ├─ documents/
│  │  │  ├─ invoices.js    an invoice per order (INV), its lines frozen from the order's price
│  │  │  ├─ receipts.js    a receipt per confirmed payment (RCT), created by the ledger
│  │  │  └─ pdf.js         render shared/documents templates to PDF; store in R2; signed link
│  │  ├─ proofs/           upload (staff, with mockup), approve with the checklist / request changes with pins
│  │  │                    (customer), versions, the pre-production sample; company approver rule
│  │  ├─ production/       staff log pieces or stages; ETA from shared/rules/production.js
│  │  ├─ capacity/         GET /api/capacity; reserve on order, release on expiry (shared/rules/capacity.js)
│  │  ├─ surveys/          Mechanism B: book the survey, the quote builder (shared/rules/site-quote.js),
│  │  │                    accept, installation date, sign-off
│  │  ├─ deliveries/       pickup codes, rider or courier records, partial deliveries
│  │  ├─ accounts/         sign-in codes (by email), sessions in Redis, profile, brand kit, addresses,
│  │  │                    reorder, statement (shared/rules/statement.js)
│  │  ├─ companies/        company, members and roles; who may approve a company's proofs
│  │  ├─ uploads/          POST /api/uploads → presigned PUT; file records; size and type checks
│  │  ├─ notifications/
│  │  │  ├─ outbox.js      write a message row in the same transaction as the event
│  │  │  ├─ whatsapp.js    send by Meta template name + variables
│  │  │  ├─ email.js       send with nodemailer; attach the receipt or invoice PDF
│  │  │  └─ templates/     one file per event: order-placed, payment-confirmed, proof-ready, …
│  │  ├─ requests/         the existing quote form and contact messages (submitQuote, sendMessage)
│  │  ├─ staff/            sign in / out, users, roles, audit log
│  │  └─ reports/          staff: revenue by category, on-time rate, outstanding balances, machine load
│  │
│  ├─ jobs/
│  │  ├─ queues.js         queue names and options (BullMQ `prefix: 'nb:bull'`)
│  │  ├─ handlers/         one file per job below; handlers only call services
│  │  ├─ settleCallback.js apply a stored STK callback through the ledger
│  │  ├─ processC2B.js     route and record a stored C2B confirmation
│  │  ├─ stkQuery.js       no callback 60 s after a prompt → ask Absa for the status
│  │  ├─ expireUnpaid.js   every 15 min: expire unpaid orders, release capacity
│  │  ├─ sendNotification.js deliver the outbox (WhatsApp, email), retries with backoff
│  │  ├─ renderDocument.js PDFs for invoices and receipts, after commit
│  │  └─ proofReminders.js reminders at 5 working days, On hold at 14
│  │
│  ├─ redis.js             the one ioredis connection (user nb), key helper that adds `nb:`
│  │
│  └─ integrations/        thin clients only, no business rules; each: live.js, fake.js, index.js
│     ├─ absa/             STK Push, status query, C2B URL registration (fake: section 2.3)
│     ├─ daraja/           the fallback provider, same shape
│     ├─ storage/          R2 / S3: presign, head, delete (fake: local disk)
│     ├─ whatsapp/         Cloud API client (fake: JSON outbox)
│     ├─ mailer/           SMTP (fake: .eml outbox)
│     └─ chromium.js       one Playwright browser, reused
│
└─ test/
   ├─ unit/                pure modules: ledger rules, status machine, numbering, adapters
   ├─ integration/         supertest against a test database: create → pay → callback → receipt
   └─ fixtures/
      ├─ absa/             real (anonymised) STK and C2B bodies, once Absa sends samples
      └─ daraja/
```

## 5. Database (migrations, in order)

| # | Migration | Tables and key points |
| --- | --- | --- |
| 001 ✓ | catalogue (B1) | `categories`, `products` (mechanism A/B/C, brief_schema JSONB, min_qty, lead days, setup and design fees, survey fee, package price, active), `price_tiers` |
| 002 ✓ | orders (B2) | `orders` (as placed: product, brief, common brief, handover and estimate in JSONB; status, money, customer email and phone, expiry in columns; token hash), `order_events`, `invoices`, `counters`, `capacity_bookings`, `notifications` (the outbox). Built ahead of the settings and people tables below, which come with B4 and B5; the planned rows that follow keep their order but take the next free numbers |
| 002 | settings | `urgency_tiers`, `delivery_zones`, `settings` (deposit rule, expiry hours, Paybill details) |
| 003 | people | `customers` (email unique, lower case: the account; name, phone, company, credit_balance), `brand_kits` (colours, typography, fonts, logo files, notes), `addresses` (label, address, zone; 5 per customer), `companies` (name, KRA PIN), `company_members` (company, email unique, role: owner, approver, member), `staff_users` (role), `staff_sessions` |
| 004 | orders | `orders` (order_no unique, secret token hash, status, mechanism, urgency, handover JSONB, totals, amount_paid, credit, due_now, due_purpose, started_on, promised_date, expires_at, company, po_number, install_date), `order_items` (product, quantity, brief JSONB, qty_completed), `order_events`, `site_quotes` (Mechanism B: items JSONB, lines JSONB, total, deposit, valid_until, survey notes, accepted_at) |
| 005 | files | `files` (owner, kind: logo, inspiration, artwork, proof, final, photo; R2 key; size; type) |
| 006 | proofs | `proofs` (version, status, file, mockup file, decided_at, approved_by and the checklist ticked), `proof_comments` (x, y nullable for a note on the whole proof, text), `samples` (pre-production sample: photo, status, comments) |
| 007 | payments | `payment_requests` (STK attempts: provider request id **unique**, phone, amount, status, timeout_at), `payments` (purpose, method, amount, **mpesa_receipt unique**, receipt_no unique, raw callback JSONB), `c2b_confirmations` (raw body, **trans_id unique**, route result, unmatched reason, assigned_by) |
| 008 | documents | `invoices` (invoice_no unique, order, lines JSONB, totals, pdf file), `receipts` (receipt_no unique, payment, pdf file), `counters` (name, value) |
| 009 | production | `production_logs` (qty_added or stage, photo, staff), `stages` (Mechanism B), `deliveries` (batch qty, partial, status, rider, rider phone, waybill, recipient, delivered_at), `handovers` (method, detail, pickup code checked, collector name, photos) |
| 010 | operations | `machines` (code, daily units), `capacity_bookings` (machine, date, units, order: reserved at order, released on expiry), `notifications` (outbox: channel, template, payload, status, attempts), `audit_log` |
| 011 | requests | `quote_requests`, `contact_messages` (the forms the site already has) |

Money is whole shillings in `integer` columns. Every table has `created_at`; anything staff can
change has `updated_at` and an `audit_log` row.

## 6. Payments: the two flows

### STK Push (the default)

1. The site's pay panel calls `startPayment` → `POST /api/payments/stk { orderNo, phone }`.
2. `stk.service.js` checks something is due and no prompt is pending, writes a `payment_requests`
   row (pending, `timeout_at` = now + 60 s), calls Absa's STK Push, stores Absa's request id.
3. Absa calls `POST /api/payments/absa/stk/<secret>`. `providerGuard` checks it; the route stores
   the raw body and answers 200 at once, then queues `settleCallback`.
4. `settleCallback` → `ledger.record()` (below). Failed or cancelled → the request is closed with
   the reason; the order stays where it was.
5. No callback by `timeout_at` → `stkQuery` asks Absa; still nothing → `timeout`.
6. The site polls `getOrder` and shows the result (it never decides "paid" itself).

### Absa C2B on Paybill 303030 (the fallback, and anyone paying by Paybill)

Customers type the account number shown on the order page and invoice:
`2055268420#NB123456` (the Absa account, `#`, the order number; format to confirm with Absa).

1. At onboarding, register our confirmation URL with Absa:
   `https://noorcombranding.co.ke/api/payments/absa/c2b/confirm/<secret>`. If Absa offers a
   validation URL, **accept every payment** there (rejecting bounces the customer's money); routing
   happens after.
2. Absa posts the confirmation. The route stores it in `c2b_confirmations` (unique `trans_id`: a
   repeat is acknowledged and dropped), answers 200, queues `processC2B`.
3. `processC2B` turns the body into a `C2BConfirmation` (`providers/absa/c2b.js`), then
   `routeC2B()` from `shared/rules/c2b.js` (today `src/lib/payments/c2b.ts`, fully tested):
   - the order number found anywhere in the account reference → that order;
   - else the payer's phone + the exact amount due, if exactly one waiting order fits;
   - else **unmatched**, with the reason (`unknown-order`, `ambiguous`, `no-match`,
     `wrong-shortcode`).
4. Matched → `ledger.record()`. Unmatched → it waits in the **Unmatched payments** screen; a
   staff member assigns it to an order (then `ledger.record()`) or marks it for refund. Both are
   audited.

### `ledger.record()`: the one way money enters the system

In one database transaction:

1. Lock the order row (`SELECT … FOR UPDATE`).
2. Insert the `payments` row; the unique `mpesa_receipt` makes a repeated callback fail safely
   (catch the unique violation → "already recorded", no change).
3. Take the next receipt number (section 7) and insert the `receipts` row.
4. Update `amount_paid`, `due_now`, `credit`:
   - **underpaid:** the rest is still due; the status doesn't move;
   - **overpaid:** beyond the total becomes credit;
   - **order already closed** (expired, cancelled): keep it as credit and flag it for staff.
5. If the step is fully paid, move the status through `status.js` (deposit → In design; balance →
   In production) and clear `expires_at`.
6. Write `order_events` and the outbox rows (WhatsApp + email "payment received, receipt RCT…").

After commit: queue `renderDocument` (receipt PDF) and `sendNotification`. **No network call ever
happens inside the transaction.**

## 7. Numbering

| Number | Format | Rule |
| --- | --- | --- |
| Order | `NB-` + 6 random digits | Unique; also shown to customers and accepted in the Paybill reference |
| Invoice | `INV00001`, `INV00002`, … | Starts afresh on the new system (owner, 6 Oct 2026); one per order, issued when the order is placed |
| Receipt | `RCT00001`, `RCT00002`, … | One per confirmed payment, issued inside the ledger transaction |

`lib/numbering.js` takes the next value with `UPDATE counters SET value = value + 1 WHERE name = $1
RETURNING value` inside the same transaction, so numbers never repeat and never skip on a rollback.
If Noorcom is VAT-registered, eTIMS invoices become a later step (spec open question).

## 8. Endpoints, and the site method each serves

| Site (`SiteApi`) | Method and path | Notes |
| --- | --- | --- |
| `listServices`, `listProjects`, `listProducts`, `listClients` | `GET /api/content/*` | Site content; stays static in the site until the back office edits it |
| `listOrderCategories`, `listOrderProducts`, `getOrderProduct` | `GET /api/catalogue` | Cached; prices from the database |
| `priceEstimate` | `POST /api/quotes/price` | shared/rules/pricing.js |
| `createOrder` | `POST /api/orders` | Re-validates, re-prices, opens the order; returns number + secret token |
| `getOrder` | `GET /api/orders/:no` | The secret token in the `X-Order-Token` header, never in the URL |
| (order lookup) | `POST /api/orders/lookup` | Order number + phone; rate limited |
| `startPayment` | `POST /api/payments/stk` | One pending prompt per order |
| (Absa) | `POST /api/payments/absa/stk/:secret` | STK callback |
| (Absa) | `POST /api/payments/absa/c2b/confirm/:secret` | C2B confirmation |
| (Absa, optional) | `POST /api/payments/absa/c2b/validate/:secret` | Always accepts |
| `getCapacity` | `GET /api/capacity` | Units booked per machine per day, 60 days ahead; cached 1 min |
| `approveProof` | `POST /api/orders/:no/proofs/:version/approve` | Checklist all true; company orders only by an owner or approver |
| `requestChanges` | `POST /api/orders/:no/proofs/:version/changes` | Notes and pins (x, y, text), cleaned by shared/rules/proof.js |
| `reviewSample` | `POST /api/orders/:no/sample` | Approve, or changes with notes |
| `requestPartialDelivery` | `POST /api/orders/:no/deliveries` | Finished pieces only; one open early delivery |
| `bookSurvey` | `POST /api/orders/:no/survey` | After the survey fee |
| `acceptSiteQuote` | `POST /api/orders/:no/quote/accept` | Within its validity; sets the total and the deposit |
| `bookInstall` | `POST /api/orders/:no/install` | Two working days' notice, working days only |
| `requestSignInCode`, `verifySignInCode` | `POST /api/auth/code`, `/api/auth/verify` | Emailed code (owner, 8 Oct 2026); session cookie set by the site |
| `getAccount`, `updateAccount`, `signOut` | `GET`, `PATCH /api/account`; `POST /api/auth/sign-out` | Session required |
| `saveBrandKit`, `saveAddress`, `removeAddress` | `PUT /api/account/brand-kit`; `/api/account/addresses` | |
| `reorderDraft` | `GET /api/account/orders/:no/reorder` | The account's own A orders with an approved proof |
| `getStatement` | `GET /api/account/statement` (`?format=csv`) | Built by shared/rules/statement.js |
| `createCompany`, `addCompanyMember`, `removeCompanyMember` | `POST /api/account/company`, `/members`, `DELETE /members/:phone` | Owner only for members |
| (documents) | `GET /api/orders/:no/invoice.pdf`, `/receipts/:receiptNo.pdf` | Signed, short-lived links |
| (uploads) | `POST /api/uploads` | Presigned PUT to R2 |
| `submitQuote`, `sendMessage` | `POST /api/requests/quote`, `/contact` | |
| (staff) | `/api/staff/*` | Order board, production log, unmatched payments, prices; role-checked |

### 8.1 Rate limits

Per IP, 429 `rate_limited` beyond them, Redis keys `nb:rl:<name>:<ip>` (Noorcom Computers' numbers):

| Endpoint | Limit |
| --- | --- |
| `POST /api/quotes/price` | 120 per minute (the form prices as the customer types) |
| `POST /api/orders` | 20 per 10 minutes |
| `POST /api/orders/lookup` | 30 per 10 minutes |
| `GET /api/orders/:no` | 120 per minute (the order page refreshes while a payment is waiting) |
| `POST /api/payments/stk` | 10 per 10 minutes, and one pending prompt per order (`nb:stk:lock:*`) |
| `POST /api/uploads` | 30 per 10 minutes |
| `POST /api/requests/quote`, `/contact` | 5 per hour, with a hidden honeypot field |
| `POST /api/auth/code` | 5 per hour per IP and 1 per minute per email (`nb:otp:*`) |
| `POST /api/auth/verify` | 20 per 10 minutes per IP; 5 tries per code |
| Document downloads | 60 per 10 minutes |
| Absa callbacks | Not limited (Absa's few addresses; a wrong secret stores nothing) |

PDF downloads use a short-lived signed token (1 hour on the page, 7 days in a WhatsApp or email
link), never the phone number.

## 9. Security

- Secrets only in `/etc/noorcom-branding/api.env` on the VPS (mode 640); never in the repository.
- Callbacks: an unguessable path segment, Absa's IP ranges allowed in nginx, and their signature
  checked when Absa provides one. The raw body is kept for audit.
- The order's secret token is stored hashed; lookups by phone are rate limited and answer the same
  way whether or not the order exists.
- Staff: argon2 hashes, httpOnly secure cookies, roles from the spec (Admin, Sales, Designer,
  Production, Installer); every staff change in `audit_log`.
- Logs mask phone numbers and never include tokens or provider credentials.
- Files are private in R2; every download is a short-lived signed URL.

## 10. Deployment (same VPS as the site and Noorcom Computers)

The box itself (updates, firewall, fail2ban, Postgres, Redis, nginx, certbot, Node) is already set
up for Noorcom Hosting and Noorcom Computers. We add only our own pieces, the same way. The steps
for the site, the database and Redis are in `docs/VPS_BRANDING.md`; this section is what the backend
adds from B1.

| Resource | Value |
| --- | --- |
| System user | `noorcom-branding` |
| Site (Next.js) | `127.0.0.1:4301`, unit `noorcom-branding-web` (exists) |
| API | `127.0.0.1:4300`, unit `noorcom-branding-api` |
| Worker | unit `noorcom-branding-worker` |
| Postgres | role and database `noorcom_branding`; `REVOKE CONNECT … FROM PUBLIC`; `statement_timeout = '15s'`, `idle_in_transaction_session_timeout = '30s'` |
| Redis | ACL user `nb`, keys `nb:*`, BullMQ prefix `nb:bull`; check `nb:probe` OK and `ne:probe` NOPERM |
| Env files | `/etc/noorcom-branding/api.env` (API and worker), `web.env` (site), `hosts.env`; mode 640 `root:noorcom-branding` |
| Files | `/var/lib/noorcom-branding/` (R2 is the store; this is for the fakes and temporary PDFs) |
| Backups | nightly `pg_dump` to `/var/backups/noorcom-branding/` and to R2, kept 30 days; a monthly restore check |
| nginx | `/api/` to 4300, everything else to 4301; Absa's IP ranges allowed on the callback paths |

Check memory first (`free -h`): the box already runs hosting and electronics; we add an API, a
worker, a Next.js server and Chromium for PDFs. Plan on at least 2 GB free for branding.

The deploy script gains: install `backend/`, run migrations, restart the API and worker, check
`GET /api/health` (database, Redis, every integration mode, build id), roll back on failure, as it
does for the site today. The VPS is in France; Noorcom Computers measured about 0.5 s per request
from Nairobi, so put Cloudflare in front at the DNS cutover (an African edge) for both sites.

## 11. Environment (`/etc/noorcom-branding/api.env`)

`NODE_ENV`, `PORT=4300`, `PUBLIC_URL`, `DATABASE_URL`, `REDIS_URL` (user `nb`), `SESSION_SECRET`,
`ABSA_MODE`, `DARAJA_MODE`, `WHATSAPP_MODE`, `WHATSAPP_OUTBOX_DIR`, `STORAGE_MODE`,
`ABSA_BASE_URL`, `ABSA_CLIENT_ID`, `ABSA_CLIENT_SECRET`, `ABSA_STK_SHORTCODE`, `ABSA_PAYBILL=303030`,
`ABSA_ACCOUNT=2055268420`, `ABSA_CALLBACK_SECRET`, `ABSA_ALLOWED_IPS`, `DARAJA_*` (fallback),
`R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TEMPLATE_NAMESPACE`, `REVALIDATE_SECRET`. The site gains `API_INTERNAL_URL=http://127.0.0.1:4300`,
`NEXT_PUBLIC_API_MODE=live` and the same `REVALIDATE_SECRET` (section 12).

## 12. What the site itself needs

The site doesn't talk to Redis or the database; everything goes through the API. It needs:

- `src/lib/api/live.ts`: every `SiteApi` method over HTTP, server-side to `API_INTERNAL_URL`, the
  order token or phone passed along, errors turned back into `OrderError`. `index.ts` picks it when
  `NEXT_PUBLIC_API_MODE=live`, and `apiMode` then switches the demo controls off.
- `next.config.ts` rewrites `/api/*` to the API in development (nginx does it on the VPS), as
  Noorcom Computers' storefront does.
- `src/app/revalidate/route.ts`: the API POSTs here with `REVALIDATE_SECRET` when staff change the
  catalogue or content, so pages refresh at once instead of waiting.
- The order page: server-sent events from `/api/orders/:no/events` (fed by the Redis channel in
  2.2) instead of polling every 3 s; polling stays as the fallback.
- Upload fields that send files straight to R2 with the presigned URL from `POST /api/uploads`.
- Its own checks unchanged: `lint`, `typecheck`, `test`, `build`, `a11y`, `devices`, `menu`, plus
  an end-to-end run against the API with fakes before each deploy.

## 13. Build order

Each step ends with its tests passing (against the fakes), a deploy to staging and the site's checks (`a11y`,
`devices`, `menu`) still green.

| Step | What | Done when |
| --- | --- | --- |
| B0 ✓ | Folders: create `backend/` (skeleton: config with zod, health, pino with phone masking, Postgres, Redis user `nb`, the rate limiter, ESLint layer rule, Vitest with a test database) and `shared/` (move pricing, calendar, c2b and order rules out of `src/lib` into `shared/rules` as JavaScript + JSDoc; `shared/contract`); the site keeps `src/` and imports `@shared/*`; the site's `eslint.config.mjs` ignores and `tsconfig.json` excludes `backend/` and `admin/`, which have their own checks | The site builds and passes every check; `backend/` answers `/api/health` |
| B1 ✓ | Catalogue and pricing in the database; `GET /api/catalogue`, `POST /api/quotes/price`; `live.ts` for those methods | The order form prices from the API |
| B2 ✓ | Orders: create, read, lookup, expiry; invoices (INV); WhatsApp and email outbox with "order placed" | An order placed on staging appears in the database with its invoice |
| B3 | Payments: Absa STK Push and callback, `ledger.js`, receipts (RCT), STK query; Absa C2B confirmation, routing, the unmatched queue; receipt and invoice PDFs | A real KES 1 payment on staging confirms the order and sends the receipt, by both STK and Paybill |
| B4 | Staff back office (`admin/`): sign-in, order board, unmatched payments, production logger | Staff run an order through without the demo controls |
| B5 | Spec Phase 2 to 4: proofs and approval, production and deliveries, accounts and brand kits, surveys and firm quotes, capacity calendar, reports | As in the spec |

### Step B0, done 6 Oct 2026

- `shared/` holds the contract (`contract/order-types.d.ts`, `content.d.ts`, `errors.js`) and twelve
  rule modules (`rules/*.js`), moved from `src/lib`; the site's files there re-export them.
- `backend/` is an npm workspace with `src/config.js` (zod), `src/lib/logger.js` (pino, phones masked,
  secrets redacted), `src/lib/errors.js` (the `{ error, message, details? }` shape; the rules'
  OrderError becomes 404/400/409), `src/db/pool.js`, `src/redis.js` (`nb:` keys),
  `src/middleware/requestId.js` and `rateLimit.js` (Redis, fails open unless `failClosed`),
  `src/modules/health/` (routes → controller → service), `src/app.js`, `src/server.js`,
  `knexfile.js` (migrations only), `eslint.config.js` (the layer rules, `max-lines: 250`, no site
  imports), `jsconfig.json` (strict `checkJs` over `src/` and `shared/`).
- Tests: `backend/test/unit` (config, logger) and `backend/test/integration` (the app with supertest;
  Postgres and Redis for real when `TEST_DATABASE_URL` and `TEST_REDIS_URL` are set, skipped
  otherwise).
- Commands: `npm run backend` at the root (the API with `--watch`), `npm run backend:check` (lint,
  typecheck, tests), or inside `backend/`: `npm run dev | test | lint | typecheck | migrate`.
- Without `DATABASE_URL` and `REDIS_URL` the API still starts in development and `/api/health` answers
  503 `degraded` with `db: down`, `redis: down`; production refuses to start without them.

### Step B1, done 7 Oct 2026

- **The catalogue moved to `shared/catalogue/order-catalogue.js`** (JavaScript + JSDoc, unchanged
  data: 10 categories, 20 products); `src/lib/api/data/order-catalogue.ts` re-exports it, so the
  mock and the site's tests didn't change. It is now the **seed**; the database is the record.
- **Migration `001_catalogue`**: `categories`, `products` (the brief as `brief_schema` JSONB, read
  whole; a CHECK that each mechanism has its columns: A `min_qty`, `setup_fee`, `design_fee`; B
  `survey_fee`, `stages`; C `package_price`, `revision_rounds`; money in integer shillings) and
  `price_tiers` (`product_id`, `min_qty`, `unit_price`). Inactive rows are left out of the catalogue.
- **Seed `01-catalogue`** adds what is missing and never changes what is there, so a deploy can't
  undo a price staff set in the back office (B4). Reload on a development machine:
  `npm run migrate:rollback && npm run migrate && npm run seed` in `backend/`.
- **`GET /api/catalogue`** (`modules/catalogue`: repo → service → controller → routes) answers
  `{ categories, products }` in the contract's shapes; cached in Redis for 10 minutes
  (`nb:cache:catalogue`), straight from Postgres when Redis is down; 503 `unavailable` without a
  database.
- **`POST /api/quotes/price`** (`modules/pricing`, 120 a minute per IP): the body is checked with
  `priceRequestSchema` (`shared/contract/schemas.js`, zod), then priced with the same
  `estimatePrice` the order form runs in the browser, against the database's product. Unknown
  products and runs under the minimum are 400 `invalid` with a customer message. The capacity
  calendar is empty until orders book machine time (B2).
- **The site** (`src/lib/api/live.ts`): with `NEXT_PUBLIC_API_MODE=live` those four methods
  (`listOrderCategories`, `listOrderProducts`, `getOrderProduct`, `priceEstimate`) go to the API
  from the site's server (`API_INTERNAL_URL`, default `http://127.0.0.1:4300`; the catalogue is
  cached a minute), everything else stays on the mock. `apiMode` stays `mock` (orders, payments,
  accounts and the demo controls) until B2 and B3. **A live build needs the API running**: pages
  built ahead (`/order`, shop pages) read the catalogue at build time.
- **Decisions.** The deadline tiers, delivery zones and deposit rule stay in
  `shared/rules/pricing.js` until the price manager (B4) makes them editable; migration 002
  (settings) comes with it, so site and API can't disagree meanwhile. Until B2, orders are still
  placed and priced by the mock from `shared/catalogue`: **don't change prices in the database
  before orders move to the API.** The error handler recognises zod errors by name as well as
  class, because `shared/` and `backend/` can load different copies of zod (the root has zod 4
  for the site's lint tools).
- **Tests:** `backend/test/integration/catalogue.test.js` against the test database: the
  catalogue comes back exactly as `shared/catalogue` holds it; the Redis cache; inactive rows
  left out; the seed keeps edits; the API's price equals the browser's for each mechanism; a tier
  changed in the database changes the price; unknown products, short runs and malformed bodies
  are 400 with the fields; 503 without a database. `src/lib/api/live.test.ts` for the site side.
- **Run it locally:** in `backend/`, `npm run migrate && npm run seed`, then `npm run backend` at
  the root; build and start the site with `NEXT_PUBLIC_API_MODE=live`.

### Step B2, done 8 Oct 2026

- **Migration `002_orders`** (section 5). An order keeps what was agreed as JSONB (the product as
  ordered, the brief, the common brief, the handover, the full `PriceEstimate`), so a later price
  change never touches it; what is searched or moves has columns. The email is stored lower case
  (an account is its email). The secret token is stored only as its SHA-256 hash.
- **`POST /api/orders`** (`modules/orders`, 20 per 10 minutes): the body is checked with
  `orderInputSchema` (`shared/contract/schemas.js`; anything else, such as a price, is dropped), then
  `checks.js` checks it against the product (minimum run, required brief answers, a handover the
  product allows, an address for delivery or installation) and the service normalises the phone and
  email. In **one transaction**: the capacity calendar is locked (`pg_advisory_xact_lock`) and read,
  the price is worked out again with `estimatePrice` (a deadline that is no longer available is
  refused), the order gets a free `NB-` number (drawn again on a clash), its machine time goes into
  `capacity_bookings`, the next invoice number from `counters` (`lib/numbering.js`), the "Order
  placed." event and two outbox rows ("order-placed", WhatsApp and email; the words are in
  `modules/notifications/templates.js`). Answers 201 `{ ref, token }`.
- **`GET /api/orders/:no`** (120 a minute) with the token in `X-Order-Token`, and **`POST
  /api/orders/lookup`** `{ ref, phone }` (30 per 10 minutes): both answer the contract's `Order`
  (`view.js`), and the same 404 for a wrong token, a wrong phone and no such order. Payments,
  proofs, deliveries, the site quote and the company are empty until their steps (B3, B5).
  Access by a signed-in account's email comes with sessions (B5).
- **Expiry:** an unpaid order past 48 hours becomes `expired`, nothing is due, its machine time is
  released and an event says why. It happens when the order is read, and a sweep every 15 minutes in
  `server.js` catches the rest (it moves to the worker with the queues, B3).
- **`GET /api/capacity`** (`modules/capacity`) answers the calendar, and `POST /api/quotes/price` now
  prices against it, so the form only offers deadlines the workshop can still meet. The workshop's
  other work joins it when staff can enter it (B4); the site's mock still adds some made-up load.
- **The outbox isn't delivered yet:** rows wait as `pending` until the worker and the WhatsApp and
  email fakes arrive (B3). The order page shows them as sent, as the mock does.
- **The site** (`src/lib/api/live.ts`): in live mode `createOrder`, `getOrder` (token, or order number
  + phone) and `getCapacity` go to the API. The steps after placing (`startPayment`, proofs, sample,
  deliveries, survey, site quote, installation) answer "This isn't available online yet" instead of
  looking in the mock, which doesn't have the order, and the demo controls are off (`ordersOnApi` in
  `src/lib/api/index.ts`). Calls made for one visitor pass on the visitor's address (the last
  `X-Forwarded-For` entry, which nginx adds), so the API's per-visitor limits don't count the site's
  server as one visitor. **Prices now come from the database in live mode for orders too.**
- **Tests:** `backend/test/integration/orders.test.js` against the test database (placing with its
  invoice, machine time and messages and only the token's hash; invoice numbers in sequence; the
  browser's price ignored; reading by token and by phone in any format; the same 404 each way; the
  order rules; malformed bodies; expiry on read and by the sweep; the calendar and the price against
  it; 503 without a database). `src/lib/api/live.test.ts` for the site side.
- **Checked end to end:** the API on 4300 against the local database, the site built with
  `NEXT_PUBLIC_API_MODE=live` on 3200, and an order placed through the form: it opened on its page
  and its invoice, and was in `orders` with `INV00001`, its event and two pending messages.

### Setting up Postgres and Redis on a development machine

Most of the database work happens on the VPS (section 10). A local copy is only for running the
backend and its tests on this machine. Once per machine: the office machine
(`C:\noorcom-branding`) has PostgreSQL 18 as a Windows service with `psql` on the PATH, and Redis
runs as **Memurai** (Redis 7 compatible, a Windows service; no Docker).

On Windows, `scripts\setup-dev-db.ps1` does the Postgres part and writes the two database lines
into `backend\.env`; it asks for the postgres password and makes the role's password itself
(`powershell -ExecutionPolicy Bypass -File scripts\setup-dev-db.ps1`, safe to run again). By hand:

```bash
# Postgres: a role and two databases (psql asks for the postgres password)
psql -U postgres -h 127.0.0.1 -c "CREATE ROLE noorcom_branding LOGIN PASSWORD '<choose one>'"
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE noorcom_branding OWNER noorcom_branding"
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE noorcom_branding_test OWNER noorcom_branding"

# Memurai: the ACL user nb, allowed only keys nb:*; the default user gets a password,
# and CONFIG REWRITE saves both to memurai.conf so they survive a restart
memurai-cli ACL SETUSER nb on '><choose one>' '~nb:*' '&*' '+@all' '-@dangerous' '+info' '+flushdb'
memurai-cli ACL SETUSER default on '><admin password>'
memurai-cli --pass '<admin password>' CONFIG REWRITE

# Check: OK for nb:probe, NOPERM for ne:probe
memurai-cli --user nb --pass '<nb password>' SET nb:probe ok
memurai-cli --user nb --pass '<nb password>' SET ne:probe ok
```

Install Memurai with `winget install Memurai.MemuraiDeveloper` from your own terminal, as
Administrator. (From Claude's sandbox the installer fails with 1603: its custom actions can't
create a temp folder.) It runs as the `Memurai` Windows service on 6379; the CLI is
`C:\Program Files\Memurai\memurai-cli.exe` (add `--no-auth-warning` to quiet the password
warning). The steps above were run as written on the office machine on 8 Oct 2026: `nb:probe` OK,
`ne:probe` NOPERM, no access without a password, and both users saved in `memurai.conf`. There
the passwords are random and kept only in `backend\.env` (`REDIS_URL`, `TEST_REDIS_URL`, and
`MEMURAI_ADMIN_PASSWORD` for the default user, which the API doesn't read).

Then copy `backend/.env.example` to `backend/.env` (never committed) and fill in `DATABASE_URL`,
`TEST_DATABASE_URL`, `REDIS_URL` (database 0) and `TEST_REDIS_URL` (database 15). `npm run backend:check`
then runs the Postgres and Redis tests too, and `/api/health` answers 200 `ok`.

## 14. What to get from Absa before B3

- STK Push API documentation, sandbox credentials and the shortcode it will use.
- C2B: how to register the confirmation (and validation) URL, the exact body they send, a sample
  for `test/fixtures/absa/`, their IP ranges, and whether callbacks are signed.
- **The account-number format on Paybill 303030 that carries our order number to the C2B
  confirmation** (the site shows `2055268420#NB123456`; one line in `src/lib/site.ts` changes it).
- Settlement and reconciliation report format, for a nightly check that every receipt is recorded.
