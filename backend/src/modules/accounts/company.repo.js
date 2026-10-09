// @ts-check

/**
 * Company accounts' SQL (migration 009): one company per email; owners and approvers approve the
 * members' proofs.
 *
 * @typedef {Pick<import('pg').Pool, 'query'>} Db
 * @typedef {{ email: string; name: string; role: 'owner' | 'approver' | 'member' }} Member
 * @typedef {{ id: string; name: string; kraPin: string; members: Member[] }} Company
 */

/**
 * The company the email belongs to, with every member and the email's own role there.
 * `FOR UPDATE` on the company when a transaction will change its members.
 * @param {Db} db
 * @param {string} email
 * @param {{ lock?: boolean }} [options]
 * @returns {Promise<(Company & { role: Member['role'] }) | null>}
 */
export async function companyOf(db, email, { lock = false } = {}) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.kra_pin, m.role FROM company_members m JOIN companies c ON c.id = m.company_id
     WHERE m.email = $1 ${lock ? 'FOR UPDATE OF c' : ''}`,
    [email],
  );
  const c = rows[0];
  if (!c) return null;
  return { id: c.id, name: c.name, kraPin: c.kra_pin, members: await membersOf(db, c.id), role: c.role };
}

/**
 * Owner first, then approvers, then members, each in the order they joined.
 * @param {Db} db
 * @param {string} companyId
 * @returns {Promise<Member[]>}
 */
export async function membersOf(db, companyId) {
  const { rows } = await db.query(
    `SELECT email, name, role FROM company_members WHERE company_id = $1
     ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'approver' THEN 1 ELSE 2 END, added_at, email`,
    [companyId],
  );
  return rows.map((r) => ({ email: r.email, name: r.name, role: r.role }));
}

/**
 * The company's name and the names of those who approve its proofs.
 * @param {Db} db
 * @param {string} companyId
 * @returns {Promise<{ name: string; approvers: string[] } | null>}
 */
export async function approvalOf(db, companyId) {
  const { rows } = await db.query('SELECT name FROM companies WHERE id = $1', [companyId]);
  if (!rows[0]) return null;
  const approvers = (await membersOf(db, companyId)).filter((m) => m.role !== 'member').map((m) => m.name);
  return { name: rows[0].name, approvers };
}

/**
 * Whether the email is an owner or approver of the company.
 * @param {Db} db
 * @param {string} companyId
 * @param {string} email
 */
export async function approves(db, companyId, email) {
  const { rowCount } = await db.query(`SELECT 1 FROM company_members WHERE company_id = $1 AND email = $2 AND role <> 'member'`, [companyId, email]);
  return rowCount === 1;
}

/**
 * @param {Db} db
 * @param {{ id: string; name: string; kraPin: string }} c
 * @returns {Promise<boolean>} False when the id is taken (the caller draws another).
 */
export async function insertCompany(db, { id, name, kraPin }) {
  const { rowCount } = await db.query('INSERT INTO companies (id, name, kra_pin) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [id, name, kraPin]);
  return rowCount === 1;
}

/**
 * @param {Db} db
 * @param {string} companyId
 * @param {Member} m
 * @returns {Promise<boolean>} False when the email already belongs to a company.
 */
export async function insertMember(db, companyId, { email, name, role }) {
  const { rowCount } = await db.query(
    'INSERT INTO company_members (email, company_id, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
    [email, companyId, name, role],
  );
  return rowCount === 1;
}

/**
 * @param {Db} db
 * @param {string} companyId
 * @param {string} email
 */
export async function deleteMember(db, companyId, email) {
  await db.query(`DELETE FROM company_members WHERE company_id = $1 AND email = $2 AND role <> 'owner'`, [companyId, email]);
}
