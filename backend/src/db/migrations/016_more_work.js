// @ts-check
import { projects } from '@noorcom-branding/shared/content/projects.js';

/**
 * Migration 016: data only. The owner's call (22 Oct 2026): the four mock-ups 015 left out because
 * they show people go on the site after all. Three join the trade-fair stand (whose Karibu banner
 * dates it to 2022, so it moves down to its year), and the Jericho and Kangemi roll-ups become a project of their own, featured on
 * the home page in place of Isiolo's seal and flag. As in 015, nothing staff changed is touched: the
 * stand only changes while it still has 015's one photo and year, and the roll-ups go in only when
 * their slug is free, right after the Bahati sign.
 */

const STAND = 'nairobi-city-county-trade-fair';
const ROLL_UPS = 'jericho-kangemi-vtc-roll-ups';
const AFTER = 'bahati-vocational-training-centre-sign';
const ISIOLO = 'municipality-of-isiolo-identity';

const need = (/** @type {string} */ slug) => {
  const p = projects.find((x) => x.slug === slug);
  if (!p) throw new Error(`016: ${slug} is missing from shared/content`);
  return p;
};
const stand = need(STAND);
const rollUps = need(ROLL_UPS);
const oldApplications = stand.applications.slice(0, 1);

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  const { rows: moved } = await knex.raw(
    `UPDATE content_items SET data = data || jsonb_build_object('applications', ?::jsonb, 'year', 2022), updated_at = now()
     WHERE kind = 'project' AND slug = ? AND data->'applications' = ?::jsonb AND data->>'year' = '2026' RETURNING slug`,
    [JSON.stringify(stand.applications), STAND, JSON.stringify(oldApplications)],
  );
  if (moved.length) {
    // Newest first: the stand goes before the first project older than 2022, or last.
    const { rows: older } = await knex.raw(
      "SELECT min(position) AS p FROM content_items WHERE kind = 'project' AND slug <> ? AND (data->>'year')::int < 2022",
      [STAND],
    );
    const { rows: last } = await knex.raw("SELECT max(position) AS p FROM content_items WHERE kind = 'project'");
    const at = older[0].p ?? last[0].p + 1;
    if (older[0].p !== null) await knex.raw("UPDATE content_items SET position = position + 1 WHERE kind = 'project' AND position >= ?", [at]);
    await knex.raw("UPDATE content_items SET position = ? WHERE kind = 'project' AND slug = ?", [at, STAND]);
  }

  const { rows } = await knex.raw("SELECT position FROM content_items WHERE kind = 'project' AND slug = ?", [AFTER]);
  const { rows: taken } = await knex.raw("SELECT 1 FROM content_items WHERE kind = 'project' AND slug = ?", [ROLL_UPS]);
  if (!taken.length) {
    // Right after the Bahati sign, or first when staff removed it.
    const { rows: top } = await knex.raw("SELECT coalesce(min(position), 0) AS p FROM content_items WHERE kind = 'project'");
    const position = rows.length ? rows[0].position + 1 : top[0].p - 1;
    if (rows.length) await knex.raw("UPDATE content_items SET position = position + 1 WHERE kind = 'project' AND position >= ?", [position]);
    await knex.raw("INSERT INTO content_items (kind, slug, data, position) VALUES ('project', ?, ?::jsonb, ?)", [ROLL_UPS, JSON.stringify(rollUps), position]);
  }

  await knex.raw(
    `UPDATE content_items SET data = jsonb_set(data, '{featured}', 'false'), updated_at = now()
     WHERE kind = 'project' AND slug = ? AND data->>'featured' = 'true'`,
    [ISIOLO],
  );
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(
    `UPDATE content_items SET data = data || jsonb_build_object('applications', ?::jsonb, 'year', 2026), updated_at = now(),
       position = (SELECT min(position) - 1 FROM content_items WHERE kind = 'project')
     WHERE kind = 'project' AND slug = ? AND data->'applications' = ?::jsonb`,
    [JSON.stringify(oldApplications), STAND, JSON.stringify(stand.applications)],
  );
  await knex.raw("DELETE FROM content_items WHERE kind = 'project' AND slug = ?", [ROLL_UPS]);
  await knex.raw("UPDATE content_items SET data = jsonb_set(data, '{featured}', 'true') WHERE kind = 'project' AND slug = ?", [ISIOLO]);
}
