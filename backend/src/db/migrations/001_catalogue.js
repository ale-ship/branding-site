// @ts-check

/**
 * Migration 001: the order catalogue (docs/BACKEND_RUNBOOK.md, section 5). What can be ordered
 * online and how it is priced; the shapes are `OrderCategory` and `OrderProduct` in
 * shared/contract/order-types.d.ts. Money is whole shillings in integer columns.
 *
 * A product's brief (its questions and priced choices) is JSONB: it is read whole by the form and
 * the price rules, never queried field by field. The mechanism decides which columns must be set.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    CREATE TABLE categories (
      id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
      name        text NOT NULL,
      mechanism   char(1) NOT NULL CHECK (mechanism IN ('A', 'B', 'C')),
      summary     text NOT NULL,
      image       jsonb NOT NULL,
      service     text,
      sort_order  integer NOT NULL DEFAULT 0,
      active      boolean NOT NULL DEFAULT true,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE products (
      id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
      category_id         integer NOT NULL REFERENCES categories (id),
      mechanism           char(1) NOT NULL CHECK (mechanism IN ('A', 'B', 'C')),
      name                text NOT NULL,
      summary             text NOT NULL,
      image               jsonb NOT NULL,
      standard_lead_days  integer NOT NULL CHECK (standard_lead_days > 0),
      rush_allowed        boolean NOT NULL DEFAULT false,
      rush_max_qty        integer CHECK (rush_max_qty > 0),
      brief_schema        jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(brief_schema) = 'array'),
      -- A: quantity run
      shop_slug           text,
      min_qty             integer CHECK (min_qty > 0),
      setup_fee           integer CHECK (setup_fee >= 0),
      design_fee          integer CHECK (design_fee >= 0),
      -- B: site installation
      survey_fee          integer CHECK (survey_fee >= 0),
      stages              jsonb CHECK (stages IS NULL OR jsonb_typeof(stages) = 'array'),
      -- C: design only
      package_price       integer CHECK (package_price >= 0),
      revision_rounds     integer CHECK (revision_rounds >= 0),
      sort_order          integer NOT NULL DEFAULT 0,
      active              boolean NOT NULL DEFAULT true,
      created_at          timestamptz NOT NULL DEFAULT now(),
      updated_at          timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT products_mechanism_fields CHECK (
        (mechanism = 'A' AND min_qty IS NOT NULL AND setup_fee IS NOT NULL AND design_fee IS NOT NULL)
        OR (mechanism = 'B' AND survey_fee IS NOT NULL AND stages IS NOT NULL)
        OR (mechanism = 'C' AND package_price IS NOT NULL AND revision_rounds IS NOT NULL)
      )
    );
    CREATE INDEX products_category_idx ON products (category_id);

    -- Unit price from min_qty pieces up (mechanism A).
    CREATE TABLE price_tiers (
      product_id  integer NOT NULL REFERENCES products (id) ON DELETE CASCADE,
      min_qty     integer NOT NULL CHECK (min_qty > 0),
      unit_price  integer NOT NULL CHECK (unit_price >= 0),
      PRIMARY KEY (product_id, min_qty)
    );
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('DROP TABLE price_tiers; DROP TABLE products; DROP TABLE categories;');
}
