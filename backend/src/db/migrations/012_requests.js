// @ts-check

/**
 * Migration 012: requests (B5). What the site's quote form ("ask us first") and contact form send,
 * kept for staff in the back office's inbox: NQ- for quote requests, NM- for messages (never NB-,
 * which is an order number and a Paybill reference). The whole request is kept as sent; who it is
 * from and where it stands have columns.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    CREATE TABLE requests (
      id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ref                text NOT NULL UNIQUE CHECK (ref ~ '^N[QM]-[0-9]{6}$'),
      kind               text NOT NULL CHECK (kind IN ('quote', 'message')),
      status             text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
      name               text NOT NULL,
      company            text NOT NULL DEFAULT '',
      phone              text NOT NULL DEFAULT '',
      email              text NOT NULL DEFAULT '',
      preferred_contact  text NOT NULL DEFAULT 'whatsapp',
      data               jsonb NOT NULL,
      staff_note         text NOT NULL DEFAULT '',
      handled_by         integer REFERENCES staff_users (id),
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX requests_status_idx ON requests (status, created_at DESC);
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('DROP TABLE requests;');
}
