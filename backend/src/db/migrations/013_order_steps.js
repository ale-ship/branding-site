// @ts-check

/**
 * Migration 013: the rest of an order's steps (B5). Site jobs keep their firm quote and installation
 * date on the order; early (partial) deliveries are a list on the order (the whole order's delivery
 * stays in `dispatch` and `handed_over`); `order_files` holds what staff send the customer: the final
 * files of a design-only order and the photo of a pre-production sample (the `sample` column, from
 * 002, keeps its status).
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    ALTER TABLE orders ADD COLUMN site_quote jsonb;
    ALTER TABLE orders ADD COLUMN install_date date;
    ALTER TABLE orders ADD COLUMN early_deliveries jsonb NOT NULL DEFAULT '[]';

    CREATE TABLE order_files (
      id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id    integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      kind        text NOT NULL CHECK (kind IN ('final', 'sample')),
      name        text NOT NULL,
      file_key    text NOT NULL,
      size        integer NOT NULL CHECK (size >= 0),
      type        text NOT NULL,
      staff_id    integer REFERENCES staff_users (id),
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX order_files_order_idx ON order_files (order_id, kind, id);
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    DROP TABLE order_files;
    ALTER TABLE orders DROP COLUMN early_deliveries;
    ALTER TABLE orders DROP COLUMN install_date;
    ALTER TABLE orders DROP COLUMN site_quote;
  `);
}
