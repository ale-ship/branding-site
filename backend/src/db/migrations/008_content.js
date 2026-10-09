// @ts-check
import { pages } from '@noorcom-branding/shared/content/pages.js';
import { products } from '@noorcom-branding/shared/content/products.js';
import { clients, projects } from '@noorcom-branding/shared/content/projects.js';
import { services } from '@noorcom-branding/shared/content/services.js';

/**
 * Migration 008: the website's content, which staff edit in the back office (owner, 8 Oct 2026:
 * "so we don't need to come to the code every time"), and the photos they upload.
 *
 * - `content_items`: one row per service, project (our work), shop product, client and page, its
 *   fields as JSONB in the contract's shapes (shared/contract/content.d.ts), checked by the API's
 *   schemas on every save. `position` orders a list; `published` hides a draft from the site.
 * - `media`: uploaded photos, resized and cleaned (no location or camera data) by the API, kept in
 *   storage under `media/`, served publicly at /api/media/<name>.
 *
 * The rows start as the content the site shipped with (shared/content), inserted once: a later run
 * never overwrites what staff changed.
 */

/** @param {string} name */
export const clientSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';

/**
 * The shipped content as rows, in the site's order.
 * @returns {{ kind: string; slug: string; data: unknown; position: number }[]}
 */
export function defaultRows() {
  return [
    ...services.map((s, i) => ({ kind: 'service', slug: s.slug, data: s, position: i })),
    ...projects.map((p, i) => ({ kind: 'project', slug: p.slug, data: p, position: i })),
    ...products.map((p, i) => ({ kind: 'product', slug: p.slug, data: p, position: i })),
    ...clients.map((c, i) => ({ kind: 'client', slug: clientSlug(c.name), data: c, position: i })),
    { kind: 'page', slug: 'home', data: pages.home, position: 0 },
    { kind: 'page', slug: 'about', data: pages.about, position: 1 },
  ];
}

/**
 * Inserts the shipped content where a row doesn't exist yet.
 * @param {import('knex').Knex} knex
 */
export async function seedContent(knex) {
  for (const r of defaultRows()) {
    await knex.raw('INSERT INTO content_items (kind, slug, data, position) VALUES (?, ?, ?::jsonb, ?) ON CONFLICT (kind, slug) DO NOTHING', [
      r.kind,
      r.slug,
      JSON.stringify(r.data),
      r.position,
    ]);
  }
}

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    CREATE TABLE media (
      id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      -- The stored file, media/<random>.<ext>; its thumbnail is media/<random>-thumb.webp.
      key           text NOT NULL UNIQUE CHECK (key ~ '^media/[a-z0-9]{16,40}\\.(jpg|png)$'),
      filename      text NOT NULL,
      content_type  text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
      bytes         integer NOT NULL CHECK (bytes > 0),
      width         integer NOT NULL CHECK (width > 0),
      height        integer NOT NULL CHECK (height > 0),
      alt           text NOT NULL DEFAULT '',
      uploaded_by   integer REFERENCES staff_users (id) ON DELETE SET NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE content_items (
      kind        text NOT NULL CHECK (kind IN ('service', 'project', 'product', 'client', 'page')),
      slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
      data        jsonb NOT NULL,
      position    integer NOT NULL DEFAULT 0,
      published   boolean NOT NULL DEFAULT true,
      updated_at  timestamptz NOT NULL DEFAULT now(),
      updated_by  integer REFERENCES staff_users (id) ON DELETE SET NULL,
      PRIMARY KEY (kind, slug)
    );
    CREATE INDEX content_items_list_idx ON content_items (kind, position, slug);
  `);
  await seedContent(knex);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('DROP TABLE content_items, media;');
}
