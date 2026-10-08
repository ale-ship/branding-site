// @ts-check
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { parseConfig } from '../config.js';
import { createPool } from '../db/pool.js';
import { ROLES, addStaff } from '../modules/staff/service.js';

/**
 * Adds a staff account from the command line; how the first admin is made (after that, admins add
 * staff in the back office):
 *
 *   npm run staff:add -- --email you@noorcombranding.co.ke --name "Your Name" --role admin
 *
 * The password is asked for without echoing it (or read from STAFF_PASSWORD, for scripts).
 */

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string', default: 'admin' } } });
const role = /** @type {import('../modules/staff/service.js').Role} */ (values.role);
if (!values.email || !values.name || !ROLES.includes(role)) {
  console.error(`Usage: npm run staff:add -- --email <email> --name "<name>" --role <${ROLES.join('|')}>`);
  process.exit(1);
}

/** @param {string} question */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Show the question, then nothing of what is typed.
    process.stdout.write(question);
    /** @type {any} */ (rl)._writeToOutput = () => {};
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const config = parseConfig();
if (!config.databaseUrl) {
  console.error('DATABASE_URL is not set (backend/.env).');
  process.exit(1);
}
const password = process.env.STAFF_PASSWORD ?? (await askHidden('Password (12+ characters): '));
const pool = createPool(config.databaseUrl);
try {
  const staff = await addStaff({ pool, redis: null }, null, { email: values.email, name: values.name, role, password });
  console.log(`Added ${staff.name} <${staff.email}> as ${staff.role}.`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
