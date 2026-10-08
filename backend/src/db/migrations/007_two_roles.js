// @ts-check

/**
 * Migration 007: two staff roles (owner, 8 Oct 2026). The shop is the admin and the graphic
 * designers, and the designers do every other job (front desk, production, handover), so the roles
 * are admin and designer only. Anyone on an old role (sales, production, installer) becomes a
 * designer, and the role check allows only the two.
 */

const OLD = ['admin', 'sales', 'designer', 'production', 'installer'];
const list = (/** @type {string[]} */ roles) => roles.map((r) => `'${r}'`).join(', ');

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw(`
    UPDATE staff_users SET role = 'designer', updated_at = now() WHERE role NOT IN ('admin', 'designer');
    ALTER TABLE staff_users DROP CONSTRAINT staff_users_role_check;
    ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check CHECK (role IN ('admin', 'designer'));
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw(`
    ALTER TABLE staff_users DROP CONSTRAINT staff_users_role_check;
    ALTER TABLE staff_users ADD CONSTRAINT staff_users_role_check CHECK (role IN (${list(OLD)}));
  `);
}
