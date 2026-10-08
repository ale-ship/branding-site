// @ts-check

/**
 * Migration 004: the staff side (docs/BACKEND_RUNBOOK.md, step B4; docs/ORDER_WORKFLOW_SPEC.md,
 * "Staff dashboard"). Staff accounts with a role, their sessions, the audit log every staff change
 * writes to, the production log, and how an order was handed over.
 */

const ROLES = ['admin', 'sales', 'designer', 'production', 'installer'];

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    CREATE TABLE staff_users (
      id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email          text NOT NULL UNIQUE CHECK (email = lower(email)),
      name           text NOT NULL,
      role           text NOT NULL CHECK (role IN (${ROLES.map((r) => `'${r}'`).join(', ')})),
      -- scrypt (node:crypto): "scrypt$N$r$p$salt$hash", all hex.
      password_hash  text NOT NULL,
      active         boolean NOT NULL DEFAULT true,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );

    -- The cookie holds the token; only its SHA-256 hash is stored.
    CREATE TABLE staff_sessions (
      token_hash  text PRIMARY KEY,
      staff_id    integer NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      last_seen   timestamptz NOT NULL DEFAULT now(),
      expires_at  timestamptz NOT NULL
    );
    CREATE INDEX staff_sessions_staff_idx ON staff_sessions (staff_id);

    -- Every change a staff member makes, with who made it (section 2.1).
    CREATE TABLE audit_log (
      id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      staff_id  integer REFERENCES staff_users (id),
      action    text NOT NULL,
      order_id  integer REFERENCES orders (id) ON DELETE SET NULL,
      detail    jsonb NOT NULL DEFAULT '{}',
      at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_log_order_idx ON audit_log (order_id);

    -- "120 printed": one row per entry from the floor (Mechanism A pieces; B stages come with B5).
    CREATE TABLE production_logs (
      id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id  integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      pieces    integer NOT NULL CHECK (pieces > 0),
      note      text NOT NULL DEFAULT '',
      staff_id  integer REFERENCES staff_users (id),
      at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX production_logs_order_idx ON production_logs (order_id, id);

    ALTER TABLE orders
      -- Six digits, given when a pickup order is ready; checked at the counter.
      ADD COLUMN pickup_code text CHECK (pickup_code ~ '^[0-9]{6}$'),
      -- Rider or courier while the order is out: { rider, riderPhone, waybill }.
      ADD COLUMN dispatch jsonb,
      -- How it was finally handed over: { at, method, detail }.
      ADD COLUMN handed_over jsonb;
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    ALTER TABLE orders DROP COLUMN pickup_code, DROP COLUMN dispatch, DROP COLUMN handed_over;
    DROP TABLE production_logs, audit_log, staff_sessions, staff_users;
  `);
}
