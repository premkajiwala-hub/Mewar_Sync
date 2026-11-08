import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

/*
 * Firebase web configuration is read from VITE_FIREBASE_* variables (see
 * .env.example). These values identify the project and are not secrets;
 * access control is enforced by Firestore security rules (firestore.rules).
 */
const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const REQUIRED: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missing = REQUIRED.filter(key => !firebaseConfig[key]);
if (missing.length > 0) {
  throw new Error(
    `Mewar Sync is missing Firebase configuration (${missing.map(k => `VITE_FIREBASE_${k.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()}`).join(', ')}). Copy .env.example to .env and fill it in.`
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const usingEmulators = env.VITE_USE_FIREBASE_EMULATORS === 'true';
if (usingEmulators) {
  connectAuthEmulator(auth, env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', { disableWarnings: true });
  const [host, port] = (env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
  connectFirestoreEmulator(db, host, Number(port));
}
