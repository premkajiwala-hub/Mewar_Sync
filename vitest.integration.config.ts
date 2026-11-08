import { defineConfig } from 'vitest/config';

// Runs the real client data layer against the Auth + Firestore emulators
// (see `npm run test:integration`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-mewar-sync.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-mewar-sync',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:demo',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
      VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085',
    },
  },
});
