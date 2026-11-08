/**
 * Server configuration, validated once at startup. Secrets are only ever read
 * from the environment and never sent to the browser.
 */
export interface ServerConfig {
  port: number;
  isProduction: boolean;
  projectId: string;
  geminiApiKey: string | undefined;
  aiProvider: 'gemini' | 'mock' | 'disabled';
  authEmulatorHost: string | undefined;
  firestoreEmulatorHost: string | undefined;
  trustProxy: boolean | number;
  authDomain: string | undefined;
  models: {
    text: string;
    vision: string;
    tts: string;
  };
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || '';
  if (!projectId) {
    throw new ConfigError('FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) must be set so ID tokens can be verified.');
  }

  const authEmulatorHost = env.FIREBASE_AUTH_EMULATOR_HOST || undefined;
  const firestoreEmulatorHost = env.FIRESTORE_EMULATOR_HOST || undefined;
  if (isProduction && (authEmulatorHost || firestoreEmulatorHost)) {
    throw new ConfigError('Firebase emulator hosts must not be configured when NODE_ENV=production.');
  }

  const geminiApiKey = env.GEMINI_API_KEY?.trim() || undefined;
  let aiProvider: ServerConfig['aiProvider'];
  const requested = (env.AI_PROVIDER || '').toLowerCase();
  if (requested === 'mock') {
    if (isProduction) throw new ConfigError('AI_PROVIDER=mock is only allowed for local development and tests.');
    aiProvider = 'mock';
  } else if (geminiApiKey) {
    aiProvider = 'gemini';
  } else {
    aiProvider = 'disabled';
  }

  const trustProxyRaw = env.TRUST_PROXY;
  const trustProxy = trustProxyRaw === undefined || trustProxyRaw === ''
    ? false
    : /^\d+$/.test(trustProxyRaw) ? Number(trustProxyRaw) : trustProxyRaw === 'true';

  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new ConfigError('PORT must be a valid TCP port.');

  return {
    port,
    isProduction,
    projectId,
    geminiApiKey,
    aiProvider,
    authEmulatorHost,
    firestoreEmulatorHost,
    trustProxy,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
    models: {
      text: env.GEMINI_TEXT_MODEL || 'gemini-3-flash-preview',
      vision: env.GEMINI_VISION_MODEL || 'gemini-3.1-pro-preview',
      tts: env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts',
    },
  };
}
