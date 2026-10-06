// @ts-check
import 'dotenv/config';

/**
 * Knex is used for migrations only (docs/BACKEND_RUNBOOK.md, section 2); the code talks to Postgres
 * through `pg`. `npm run migrate` uses DATABASE_URL, or TEST_DATABASE_URL under NODE_ENV=test.
 */
const connection = process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

export default {
  client: 'pg',
  connection,
  migrations: { directory: './src/db/migrations', tableName: 'knex_migrations', loadExtensions: ['.js'] },
};
