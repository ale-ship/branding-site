// @ts-check

/**
 * Migration 002: orders, their invoices, the machine time they book and the messages they send
 * (docs/BACKEND_RUNBOOK.md, step B2). The shapes are `Order` and its parts in
 * shared/contract/order-types.d.ts. Money is whole shillings in integer columns.
 *
 * What the order was agreed as (the product as ordered, the brief, the handover, the price) is
 * frozen in JSONB: read whole, never queried field by field, and never changed by a later price
 * change. What is searched or moves (status, money, the customer's email and phone, expiry) has
 * its own column. Payments, proofs and deliveries get their tables in the later steps.
 */

const STATUSES = [
  'awaiting_payment',
  'in_design',
  'awaiting_approval',
  'awaiting_balance',
  'in_production',
  'ready',
  'out_for_handover',
  'completed',
  'expired',
  'on_hold',
  'cancelled',
];

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    -- The next invoice and receipt numbers (section 7): taken inside the transaction that uses them.
    CREATE TABLE counters (
      name   text PRIMARY KEY,
      value  integer NOT NULL DEFAULT 0 CHECK (value >= 0)
    );
    INSERT INTO counters (name) VALUES ('invoice'), ('receipt');

    CREATE TABLE orders (
      id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_no        text NOT NULL UNIQUE CHECK (order_no ~ '^NB-[0-9]{6}$'),
      -- The secret link's token, as its SHA-256 hash only (section 2.1).
      token_hash      text NOT NULL,
      status          text NOT NULL CHECK (status IN (${STATUSES.map((s) => `'${s}'`).join(', ')})),
      mechanism       char(1) NOT NULL CHECK (mechanism IN ('A', 'B', 'C')),
      product_id      integer NOT NULL REFERENCES products (id),
      -- { slug, name, category } as ordered.
      product         jsonb NOT NULL,
      quantity        integer NOT NULL CHECK (quantity > 0),
      brief           jsonb NOT NULL,
      common          jsonb NOT NULL,
      needs_design    boolean NOT NULL,
      urgency         text NOT NULL,
      handover        jsonb NOT NULL,
      customer_name   text NOT NULL,
      customer_company text NOT NULL DEFAULT '',
      -- +2547XXXXXXXX: order number + phone finds the order.
      customer_phone  text NOT NULL,
      -- Lower case: an account is its email, and its orders are the ones placed with it.
      customer_email  text NOT NULL CHECK (customer_email = lower(customer_email)),
      -- The PriceEstimate the order was placed at.
      estimate        jsonb NOT NULL,
      total           integer CHECK (total >= 0),
      amount_paid     integer NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
      credit          integer NOT NULL DEFAULT 0 CHECK (credit >= 0),
      due_now         integer NOT NULL DEFAULT 0 CHECK (due_now >= 0),
      due_purpose     text CHECK (due_purpose IN ('deposit', 'full', 'survey_fee', 'balance')),
      progress        jsonb NOT NULL,
      survey          jsonb,
      sample          jsonb,
      daily_capacity  integer,
      started_on      date,
      promised_date   date,
      -- Unpaid orders expire (48 h); null once paid.
      expires_at      timestamptz,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX orders_customer_email_idx ON orders (customer_email);
    CREATE INDEX orders_customer_phone_idx ON orders (customer_phone);
    CREATE INDEX orders_unpaid_idx ON orders (expires_at) WHERE status = 'awaiting_payment';

    -- What the customer sees under "What's happened".
    CREATE TABLE order_events (
      id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id  integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      text      text NOT NULL,
      at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX order_events_order_idx ON order_events (order_id, id);

    -- One per order, issued when it is placed; its lines frozen from the order's price.
    CREATE TABLE invoices (
      id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      invoice_no  text NOT NULL UNIQUE CHECK (invoice_no ~ '^INV[0-9]{5,}$'),
      order_id    integer NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
      lines       jsonb NOT NULL,
      subtotal    integer NOT NULL CHECK (subtotal >= 0),
      total       integer CHECK (total >= 0),
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    -- Machine time an order holds (shared/rules/capacity.js): booked when it is placed, released
    -- when it expires unpaid. The calendar the price reads is the sum per machine per day.
    CREATE TABLE capacity_bookings (
      order_id  integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      machine   text NOT NULL,
      day       date NOT NULL,
      units     integer NOT NULL CHECK (units > 0),
      PRIMARY KEY (order_id, machine, day)
    );
    CREATE INDEX capacity_bookings_day_idx ON capacity_bookings (day);

    -- The outbox: written in the same transaction as the event, delivered after commit by the
    -- worker (WhatsApp and email; never SMS).
    CREATE TABLE notifications (
      id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id    integer REFERENCES orders (id) ON DELETE CASCADE,
      channel     text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
      recipient   text NOT NULL,
      template    text NOT NULL,
      payload     jsonb NOT NULL,
      status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
      attempts    integer NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now(),
      sent_at     timestamptz
    );
    CREATE INDEX notifications_pending_idx ON notifications (id) WHERE status = 'pending';
    CREATE INDEX notifications_order_idx ON notifications (order_id);
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('DROP TABLE notifications, capacity_bookings, invoices, order_events, orders, counters;');
}
