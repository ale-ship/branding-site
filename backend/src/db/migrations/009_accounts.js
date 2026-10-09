// @ts-check

/**
 * Migration 009: customer accounts (docs/ORDER_WORKFLOW_SPEC.md, "Accounts"; step B5). An account is
 * its verified email: orders join it by the email they were placed with, so nothing links them here.
 * Sign-in is a six-digit code emailed to the customer; only the code's and the session's hashes are
 * kept. Company accounts: one company per email, owners and approvers approve the members' proofs.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    -- What the customer keeps between orders. Created on the first sign-in.
    CREATE TABLE customer_profiles (
      email       text PRIMARY KEY CHECK (email = lower(email)),
      name        text NOT NULL DEFAULT '',
      phone       text NOT NULL DEFAULT '',
      company     text NOT NULL DEFAULT '',
      brand_kit   jsonb,
      addresses   jsonb NOT NULL DEFAULT '[]',
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );

    -- The one code waiting for each email (a new one replaces it).
    CREATE TABLE sign_in_codes (
      email       text PRIMARY KEY,
      code_hash   text NOT NULL,
      tries       integer NOT NULL DEFAULT 0,
      sent_at     timestamptz NOT NULL,
      expires_at  timestamptz NOT NULL
    );

    CREATE TABLE customer_sessions (
      token_hash  text PRIMARY KEY,
      email       text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      expires_at  timestamptz NOT NULL
    );
    CREATE INDEX customer_sessions_email_idx ON customer_sessions (email);

    CREATE TABLE companies (
      id          text PRIMARY KEY CHECK (id ~ '^CO-[0-9]{6}$'),
      name        text NOT NULL,
      kra_pin     text NOT NULL DEFAULT '',
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    -- One company per email.
    CREATE TABLE company_members (
      email       text PRIMARY KEY CHECK (email = lower(email)),
      company_id  text NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
      name        text NOT NULL,
      role        text NOT NULL CHECK (role IN ('owner', 'approver', 'member')),
      added_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX company_members_company_idx ON company_members (company_id);

    -- A company order: set only from a signed-in member's session, never from the request.
    ALTER TABLE orders ADD COLUMN company_id text REFERENCES companies (id);
    ALTER TABLE orders ADD COLUMN company_po text NOT NULL DEFAULT '';
    CREATE INDEX orders_company_idx ON orders (company_id) WHERE company_id IS NOT NULL;
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    ALTER TABLE orders DROP COLUMN company_po;
    ALTER TABLE orders DROP COLUMN company_id;
    DROP TABLE company_members, companies, customer_sessions, sign_in_codes, customer_profiles;
  `);
}
