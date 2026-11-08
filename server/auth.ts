import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { ServerConfig } from './config.ts';

export interface VerifiedUser {
  uid: string;
  email?: string;
}

export type TokenVerifier = (token: string) => Promise<VerifiedUser>;

export class AuthError extends Error {}

const GOOGLE_SECURETOKEN_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/**
 * Verifies Firebase Authentication ID tokens: RS256 signature against
 * Google's published keys, issuer, audience, expiry and a non-empty subject.
 * Emulator tokens (unsigned) are only accepted when the Auth emulator is
 * configured, which config.ts forbids in production.
 */
export function createFirebaseTokenVerifier(config: ServerConfig): TokenVerifier {
  const issuer = `https://securetoken.google.com/${config.projectId}`;

  if (config.authEmulatorHost) {
    return async (token: string) => {
      let claims;
      try {
        claims = decodeJwt(token);
      } catch {
        throw new AuthError('Malformed token');
      }
      if (claims.aud !== config.projectId || claims.iss !== issuer) {
        throw new AuthError(`Token is for project "${String(claims.aud)}" but this server expects "${config.projectId}"`);
      }
      if (typeof claims.sub !== 'string' || claims.sub.length === 0) throw new AuthError('Token subject missing');
      if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) throw new AuthError('Token expired');
      return { uid: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined };
    };
  }

  const jwks = createRemoteJWKSet(new URL(GOOGLE_SECURETOKEN_JWKS), { cooldownDuration: 30_000, cacheMaxAge: 6 * 60 * 60 * 1000 });
  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: config.projectId,
        algorithms: ['RS256'],
        clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
        throw new AuthError('Token subject missing');
      }
      if (typeof payload.auth_time === 'number' && payload.auth_time * 1000 > Date.now() + 5000) {
        throw new AuthError('Token auth_time in the future');
      }
      return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
    } catch (err) {
      if (err instanceof AuthError) throw err;
      const code = (err as { code?: string })?.code;
      throw new AuthError(code === 'ERR_JWT_CLAIM_VALIDATION_FAILED'
        ? `Token audience/issuer does not match FIREBASE_PROJECT_ID "${config.projectId}"`
        : 'Invalid token');
    }
  };
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header.trim());
  return match ? match[1] : null;
}
