import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    // The database and Redis tests share one test database and Redis; run files one at a time.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
