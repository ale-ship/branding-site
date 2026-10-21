// @ts-check
import { clients, projects } from '@noorcom-branding/shared/content/projects.js';
import { clientSlug } from './008_content.js';

/**
 * Migration 015: data only. The owner's mock-ups of real jobs (21 Oct 2026, public/images/work) as
 * projects in "Our work", ahead of the samples, which stop being featured; and the clients behind
 * them in place of the "Client 01" placeholders. A fresh database already has all this from 008
 * (it seeds from shared/content); here an existing one catches up, and nothing staff changed is
 * touched: a project is only added when its slug is free, a sample only loses "featured" while it is
 * still a sample, and only placeholder clients without a logo are removed.
 */

const real = projects.filter((p) => !p.sample);
const PLACEHOLDER = /^Client \d{2}$/;

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  const { rows } = await knex.raw("SELECT slug, position FROM content_items WHERE kind = 'project' ORDER BY position, slug");
  const have = new Set(rows.map((/** @type {{ slug: string }} */ r) => r.slug));
  const fresh = real.filter((p) => !have.has(p.slug));
  if (fresh.length) {
    // In the shipped order, ahead of everything already there.
    const top = rows.length ? Math.min(...rows.map((/** @type {{ position: number }} */ r) => r.position)) : 0;
    for (const [i, p] of fresh.entries()) {
      await knex.raw("INSERT INTO content_items (kind, slug, data, position) VALUES ('project', ?, ?::jsonb, ?) ON CONFLICT (kind, slug) DO NOTHING", [
        p.slug,
        JSON.stringify(p),
        top - fresh.length + i,
      ]);
    }
  }
  await knex.raw(
    `UPDATE content_items SET data = jsonb_set(data, '{featured}', 'false'), updated_at = now()
     WHERE kind = 'project' AND data->>'sample' = 'true' AND data->>'featured' = 'true'`,
  );

  const { rows: current } = await knex.raw("SELECT slug, data FROM content_items WHERE kind = 'client'");
  for (const c of current) {
    if (PLACEHOLDER.test(c.data.name) && !c.data.logo) await knex.raw("DELETE FROM content_items WHERE kind = 'client' AND slug = ?", [c.slug]);
  }
  for (const [i, c] of clients.entries()) {
    await knex.raw("INSERT INTO content_items (kind, slug, data, position) VALUES ('client', ?, ?::jsonb, ?) ON CONFLICT (kind, slug) DO NOTHING", [
      clientSlug(c.name),
      JSON.stringify(c),
      i,
    ]);
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw("DELETE FROM content_items WHERE kind = 'project' AND slug = ANY(?)", [real.map((p) => p.slug)]);
  for (const slug of ['sample-fleet-livery', 'sample-office-mural', 'sample-event-apparel', 'sample-billboard-campaign', 'sample-corporate-gifts', 'sample-stationery-system']) {
    await knex.raw("UPDATE content_items SET data = jsonb_set(data, '{featured}', 'true') WHERE kind = 'project' AND slug = ? AND data->>'sample' = 'true'", [slug]);
  }
  await knex.raw("DELETE FROM content_items WHERE kind = 'client' AND slug = ANY(?)", [clients.map((c) => clientSlug(c.name))]);
  for (let i = 0; i < 8; i++) {
    const name = `Client ${String(i + 1).padStart(2, '0')}`;
    await knex.raw("INSERT INTO content_items (kind, slug, data, position) VALUES ('client', ?, ?::jsonb, ?) ON CONFLICT (kind, slug) DO NOTHING", [
      clientSlug(name),
      JSON.stringify({ name, logo: null }),
      i,
    ]);
  }
}
