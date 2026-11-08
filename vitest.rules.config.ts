import { defineConfig } from 'vitest/config';

// Runs against the Firestore emulator (see `npm run test:rules`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
