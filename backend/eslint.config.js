import js from '@eslint/js';
import globals from 'globals';

// Layer rules (docs/BACKEND_RUNBOOK.md, section 2.1). Files are matched by name: each module folder
// has routes.js, controller.js, service.js and repo.js, and these rules bind each one. An override
// replaces the rule for its files, so each repeats what it needs.
const banned = (message, ...patterns) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns.flat(), message }] }],
});

const DB = ['pg', 'knex', '**/db/*', '**/repo.js', '**/*.repo.js'];
const NET = ['ioredis', 'bullmq', '**/redis.js', '**/jobs/*', '**/integrations/*'];
// The backend never uses the site's code or frameworks; what both need lives in shared/ and is
// imported as @noorcom-branding/shared/... (the site's @/ and @shared/ aliases don't exist here).
const SITE = ['next', 'next/*', 'react', 'react/*', 'react-dom', '@/*', '@shared/*'];

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: false, skipComments: false }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-imports': ['error', { patterns: [{ group: SITE, message: 'Share code through shared/, not the site.' }] }],
    },
  },
  // routes: declare paths, guards and rate limits only.
  { files: ['src/**/routes.js'], rules: banned('routes.js points at controllers; it holds no logic.', DB, NET, SITE, ['**/service.js']) },
  // controllers: parse, call one service, answer. No database, integrations or queues.
  { files: ['src/**/controller.js'], rules: banned('controller.js calls services only.', DB, NET, SITE) },
  // services: business rules. They call repos and never build SQL themselves.
  { files: ['src/**/service.js', 'src/**/*.service.js'], rules: banned('service.js does not build SQL; go through repo.js.', ['pg', 'knex'], SITE) },
  // repos: SQL only. No network, Redis or queues.
  { files: ['src/**/repo.js', 'src/**/*.repo.js'], rules: banned('repo.js is SQL only.', NET, SITE) },
  // integrations talk to one outside system and never touch Postgres.
  { files: ['src/integrations/**/*.js'], rules: banned('An integration does not touch Postgres.', DB, SITE) },
  // job handlers call services, not SQL or integrations directly.
  { files: ['src/jobs/handlers/*.js'], rules: banned('Job handlers call services.', DB, ['**/integrations/*'], SITE) },
  { files: ['test/**/*.js'], rules: { 'max-lines': 'off' } },
];
