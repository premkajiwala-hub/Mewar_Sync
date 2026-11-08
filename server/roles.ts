import type { ServerConfig } from './config.ts';
import type { UserRole } from '../types.ts';

export type RoleLookup = (uid: string, idToken: string) => Promise<UserRole | null>;

const VALID_ROLES: UserRole[] = ['SHOPKEEPER', 'VISITOR', 'ADMIN'];
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Reads the caller's role from their own Firestore profile using the
 * Firestore REST API *with the caller's ID token*, so Firestore security
 * rules still apply and no service-account credential is needed. Results are
 * cached briefly per uid.
 */
export function createFirestoreRoleLookup(config: ServerConfig, fetchImpl: typeof fetch = fetch): RoleLookup {
  const cache = new Map<string, { role: UserRole | null; expires: number }>();
  const base = config.firestoreEmulatorHost
    ? `http://${config.firestoreEmulatorHost}/v1`
    : 'https://firestore.googleapis.com/v1';

  return async (uid: string, idToken: string) => {
    const cached = cache.get(uid);
    if (cached && cached.expires > Date.now()) return cached.role;

    const url = `${base}/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/profiles/${encodeURIComponent(uid)}?mask.fieldPaths=role`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${idToken}` },
        signal: controller.signal,
      });
      if (res.status === 404) {
        cache.set(uid, { role: null, expires: Date.now() + 15_000 });
        return null;
      }
      if (!res.ok) throw new Error(`Role lookup failed with status ${res.status}`);
      const body = (await res.json()) as { fields?: { role?: { stringValue?: string } } };
      const raw = body.fields?.role?.stringValue;
      const role = VALID_ROLES.includes(raw as UserRole) ? (raw as UserRole) : null;
      cache.set(uid, { role, expires: Date.now() + CACHE_TTL_MS });
      return role;
    } finally {
      clearTimeout(timer);
    }
  };
}
