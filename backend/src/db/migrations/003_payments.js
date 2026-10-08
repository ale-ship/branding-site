// @ts-check

/**
 * Migration 003: payments (docs/BACKEND_RUNBOOK.md, step B3, section 6). Money is whole shillings
 * in integer columns.
 *
 * - `payment_requests`: M-Pesa prompts (STK Push), one row per attempt, with the provider's request
 *   id (unique) and how it ended.
 * - `payments`: money that arrived, by prompt or by Paybill. The M-Pesa receipt is unique, so a
 *   repeated callback can never credit twice; every payment has Noorcom's own receipt number (RCT).
 * - `provider_callbacks`: every STK callback body exactly as received, stored before it is acted on.
 * - `c2b_confirmations`: every Paybill confirmation as received (the M-Pesa transaction id is
 *   unique), how it was routed, and what staff did with an unmatched one.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    -- Why staff should look at an order (money after it closed, a refund to make). Cleared by staff (B4).
    ALTER TABLE orders ADD COLUMN attention text;

    CREATE TABLE payment_requests (
      id                   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      -- PAY- and eight digits: what the site and the customer see.
      public_id            text NOT NULL UNIQUE,
      order_id             integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      provider             text NOT NULL CHECK (provider IN ('absa', 'daraja')),
      provider_request_id  text UNIQUE,
      purpose              text NOT NULL CHECK (purpose IN ('deposit', 'full', 'survey_fee', 'balance')),
      phone                text NOT NULL,
      amount               integer NOT NULL CHECK (amount > 0),
      status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'cancelled', 'timeout')),
      message              text,
      timeout_at           timestamptz NOT NULL,
      created_at           timestamptz NOT NULL DEFAULT now(),
      settled_at           timestamptz
    );
    CREATE INDEX payment_requests_order_idx ON payment_requests (order_id);
    -- One prompt at a time per order.
    CREATE UNIQUE INDEX payment_requests_one_pending ON payment_requests (order_id) WHERE status = 'pending';

    CREATE TABLE payments (
      id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      public_id      text NOT NULL UNIQUE,
      order_id       integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      request_id     integer UNIQUE REFERENCES payment_requests (id),
      purpose        text NOT NULL CHECK (purpose IN ('deposit', 'full', 'survey_fee', 'balance')),
      method         text NOT NULL CHECK (method IN ('stk', 'paybill')),
      phone          text,
      amount         integer NOT NULL CHECK (amount > 0),
      mpesa_receipt  text NOT NULL UNIQUE,
      receipt_no     text NOT NULL UNIQUE CHECK (receipt_no ~ '^RCT[0-9]{5,}$'),
      raw            jsonb,
      created_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX payments_order_idx ON payments (order_id);

    CREATE TABLE provider_callbacks (
      id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      kind          text NOT NULL,
      body          jsonb NOT NULL,
      result        text,
      received_at   timestamptz NOT NULL DEFAULT now(),
      processed_at  timestamptz
    );

    CREATE TABLE c2b_confirmations (
      id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      trans_id      text NOT NULL UNIQUE,
      body          jsonb NOT NULL,
      status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recorded', 'unmatched', 'assigned', 'refund')),
      routed_by     text,
      reason        text,
      order_id      integer REFERENCES orders (id),
      assigned_by   text,
      received_at   timestamptz NOT NULL DEFAULT now(),
      processed_at  timestamptz
    );
    CREATE INDEX c2b_confirmations_unmatched_idx ON c2b_confirmations (id) WHERE status = 'unmatched';
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    DROP TABLE c2b_confirmations, provider_callbacks, payments, payment_requests;
    ALTER TABLE orders DROP COLUMN attention;
  `);
}
