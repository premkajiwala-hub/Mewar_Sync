import helmet from 'helmet';
import type { ServerConfig } from './config.ts';

/**
 * Security headers for the SPA and API. The CSP allow-list is limited to the
 * services the app actually talks to: Firebase (Auth + Firestore), Cloudinary
 * (image upload/delivery), OpenStreetMap (tiles + address search) and
 * Unsplash (curated heritage-site photos).
 */
export function securityHeaders(config: ServerConfig) {
  const emulatorOrigins: string[] = [];
  for (const host of [config.authEmulatorHost, config.firestoreEmulatorHost]) {
    if (host) emulatorOrigins.push(`http://${host}`, `ws://${host}`);
  }

  const frameSrc = ["'self'"];
  if (config.authDomain) frameSrc.push(`https://${config.authDomain}`);

  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://images.unsplash.com', 'https://*.tile.openstreetmap.org'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://api.cloudinary.com',
          // Product photos are fetched (CORS) for the authenticity check.
          'https://res.cloudinary.com',
          'https://nominatim.openstreetmap.org',
          ...emulatorOrigins,
        ],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        workerSrc: ["'self'", 'blob:'],
        frameSrc,
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });
}

/** Microphone/camera are needed for voice entries and photographing crafts. */
export const PERMISSIONS_POLICY = 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()';
