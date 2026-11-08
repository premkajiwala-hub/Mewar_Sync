import { auth } from './firebase';

/** Error returned by the Mewar Sync API, with a message safe to show users. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly requestId?: string;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

async function send(path: string, body: unknown, token: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(0, 'timeout', 'This is taking too long. Check your connection and try again.');
    }
    throw new ApiError(0, 'network', navigator.onLine === false ? 'You appear to be offline.' : 'Could not reach Mewar Sync. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POSTs JSON to the API with the signed-in user's Firebase ID token. The AI
 * provider key lives only on the server; the browser never sees it.
 */
export async function apiPost<T>(path: string, body: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'unauthenticated', 'Please sign in again.');
  const timeoutMs = opts.timeoutMs ?? 35_000;

  let res = await send(path, body, await user.getIdToken(), timeoutMs);
  if (res.status === 401) {
    // The cached token may have just expired; refresh once.
    res = await send(path, body, await user.getIdToken(true), timeoutMs);
  }

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; fields?: Record<string, string>; requestId?: string } } = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error page */
    }
    const e = payload.error || {};
    const fallback = res.status === 429
      ? 'Too many requests. Please wait a moment.'
      : res.status >= 500 ? 'The service is temporarily unavailable.' : 'The request could not be completed.';
    throw new ApiError(res.status, e.code || 'http_error', e.message || fallback, e.fields, e.requestId);
  }
  return (await res.json()) as T;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message && !/firebase|firestore|internal|\bat\b.*\.ts/i.test(err.message)) return err.message;
  return fallback;
}
