// @ts-check

/**
 * Invoice and receipt numbers (docs/BACKEND_RUNBOOK.md, section 7): INV00001, RCT00001, … The next
 * value is taken inside the caller's transaction, so a number never repeats and a rollback never
 * leaves a gap.
 */

const PREFIX = /** @type {const} */ ({ invoice: 'INV', receipt: 'RCT' });

/**
 * @param {Pick<import('pg').PoolClient, 'query'>} trx A client inside a transaction.
 * @param {'invoice' | 'receipt'} name
 * @returns {Promise<string>}
 */
export async function nextNumber(trx, name) {
  const { rows } = await trx.query('UPDATE counters SET value = value + 1 WHERE name = $1 RETURNING value', [name]);
  if (!rows[0]) throw new Error(`No counter named ${name}`);
  return `${PREFIX[name]}${String(rows[0].value).padStart(5, '0')}`;
}
