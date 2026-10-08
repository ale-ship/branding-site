// @ts-check

/**
 * Migration 005: proofs (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and approval"; built in step B4 so
 * staff can run an order through). Every version is kept. The customer sees the watermarked file;
 * staff keep the original. Approving locks the artwork and records the checklist ticked.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    CREATE TABLE proofs (
      id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id       integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      version        integer NOT NULL CHECK (version > 0),
      status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested')),
      note           text NOT NULL DEFAULT '',
      -- What the customer sees (watermarked PROOF) and what staff uploaded.
      file_key       text NOT NULL,
      original_key   text NOT NULL,
      mockup_key     text,
      comments       text,
      pins           jsonb NOT NULL DEFAULT '[]',
      checklist      jsonb,
      staff_id       integer REFERENCES staff_users (id),
      uploaded_at    timestamptz NOT NULL DEFAULT now(),
      decided_at     timestamptz,
      UNIQUE (order_id, version)
    );
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('DROP TABLE proofs;');
}
