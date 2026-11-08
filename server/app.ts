import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import type { ServerConfig } from './config.ts';
import { AuthError, extractBearerToken, type TokenVerifier, type VerifiedUser } from './auth.ts';
import type { RoleLookup } from './roles.ts';
import { AiUnavailableError, AiUpstreamError, type AiProvider } from './ai/provider.ts';
import { logger } from './logger.ts';
import { PERMISSIONS_POLICY, securityHeaders } from './security.ts';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  authenticityOutput,
  chatRequest,
  heritageOutput,
  heritageRequest,
  imageRequest,
  parseLedgerRequest,
  productAnalysisOutput,
  profileDescriptionRequest,
  translateRequest,
  ttsRequest,
} from './schemas.ts';
import { sanitizeVoiceAction } from '../lib/voice.ts';
import { stripMarkdownEmphasis } from '../lib/text.ts';
import { LOCATIONS } from '../src/constants.ts';
import type { UserRole } from '../types.ts';

export interface AppDeps {
  config: ServerConfig;
  verifyToken: TokenVerifier;
  lookupRole: RoleLookup;
  ai: AiProvider | null;
  /** Directory with the built SPA (`dist`). Omitted in tests/dev. */
  staticDir?: string;
  timeouts?: { text: number; vision: number };
}

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const HERITAGE_PLACES = new Set(LOCATIONS.filter(l => l.type === 'HERITAGE').map(l => l.name));

function locals(res: Response) {
  return res.locals as { requestId: string; user?: VerifiedUser; role?: UserRole };
}

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'body';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new HttpError(400, 'invalid_request', 'The request was not valid.', fields);
  }
  return result.data;
}

/** Checks magic bytes so the declared MIME type matches the actual image data. */
function assertImage(base64: string, mimeType: (typeof IMAGE_MIME_TYPES)[number]) {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, 'image_too_large', 'Image must be smaller than 4 MB.');
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const ok = (mimeType === 'image/jpeg' && isJpeg) || (mimeType === 'image/png' && isPng) || (mimeType === 'image/webp' && isWebp);
  if (!ok) throw new HttpError(415, 'unsupported_image', 'Only JPEG, PNG or WebP photos are supported.');
}

export function createApp(deps: AppDeps) {
  const { config, verifyToken, lookupRole, ai } = deps;
  const timeouts = deps.timeouts ?? { text: 30_000, vision: 60_000 };
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use((req, res, next) => {
    const requestId = randomUUID();
    locals(res).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const started = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api/')) {
        logger.info('request', {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - started,
          uid: locals(res).user?.uid,
        });
      }
    });
    next();
  });

  app.use(securityHeaders(config));
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });

  /* ------------------------------- API ------------------------------- */
  const api = express.Router();

  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  api.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment.', requestId: locals(res).requestId } }),
  }));

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', ai: ai ? 'available' : 'not_configured' });
  });

  const requireUser = async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) return next(new HttpError(401, 'unauthenticated', 'Please sign in again.'));
    try {
      const user = await verifyToken(token);
      const role = await lookupRole(user.uid, token);
      if (!role) return next(new HttpError(403, 'no_profile', 'Your account profile is incomplete.'));
      locals(res).user = user;
      locals(res).role = role;
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        // Logged without the token itself; helps diagnose a server configured for the wrong Firebase project.
        logger.warn('auth_rejected', { requestId: locals(res).requestId, reason: err.message });
        return next(new HttpError(401, 'unauthenticated', 'Please sign in again.'));
      }
      next(err);
    }
  };

  const requireRole = (...roles: UserRole[]) => (_req: Request, res: Response, next: NextFunction) => {
    const role = locals(res).role;
    if (!role || !roles.includes(role)) return next(new HttpError(403, 'forbidden', 'This feature is not available for your account.'));
    next();
  };

  const userLimiter = (limit: number) => rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `uid:${locals(res).user?.uid ?? 'anon'}`,
    handler: (_req, res) => res.status(429).json({ error: { code: 'rate_limited', message: 'You are sending requests too quickly. Please wait a minute.', requestId: locals(res).requestId } }),
  });

  const requireJson = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.is('application/json')) return next(new HttpError(415, 'unsupported_media_type', 'Requests must be JSON.'));
    next();
  };

  const smallJson = express.json({ limit: '32kb', strict: true });
  const imageJson = express.json({ limit: '6mb', strict: true });

  const requireAi = (_req: Request, _res: Response, next: NextFunction) => {
    if (!ai) return next(new AiUnavailableError('AI features are not configured on this server.'));
    next();
  };

  /** Runs an AI call with a timeout that also aborts if the client disconnects. */
  async function runAi<T>(res: Response, ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const onClose = () => {
      if (!res.writableFinished) controller.abort();
    };
    res.on('close', onClose);
    try {
      return await fn(controller.signal);
    } catch (err) {
      if (controller.signal.aborted) throw new AiUpstreamError('AI request timed out', true);
      throw err;
    } finally {
      clearTimeout(timer);
      res.off('close', onClose);
    }
  }

  const ai$ = express.Router();
  ai$.use(requireUser, requireAi, userLimiter(30));

  ai$.post('/parse-ledger', requireRole('SHOPKEEPER'), requireJson, smallJson, async (req, res) => {
    const { transcript } = parseBody(parseLedgerRequest, req.body);
    const raw = await runAi(res, timeouts.text, signal => ai!.parseLedger(transcript, signal));
    res.json({ action: sanitizeVoiceAction(raw, transcript) });
  });

  ai$.post('/analyze-product', requireRole('SHOPKEEPER'), userLimiter(8), requireJson, imageJson, async (req, res) => {
    const body = parseBody(imageRequest, req.body);
    assertImage(body.image, body.mimeType);
    const raw = await runAi(res, timeouts.vision, signal => ai!.analyzeProduct({ data: body.image, mimeType: body.mimeType }, signal));
    const out = productAnalysisOutput.parse(raw ?? {});
    res.json({
      title: out.title || 'Untitled piece',
      story: stripMarkdownEmphasis(out.story),
      price: out.price !== undefined ? Math.round(out.price) : null,
      style: out.style || 'Handicraft',
    });
  });

  ai$.post('/check-authenticity', userLimiter(8), requireJson, imageJson, async (req, res) => {
    const body = parseBody(imageRequest, req.body);
    assertImage(body.image, body.mimeType);
    const raw = await runAi(res, timeouts.vision, signal => ai!.checkAuthenticity({ data: body.image, mimeType: body.mimeType }, signal));
    const out = authenticityOutput.parse(raw ?? {});
    res.json({
      isHandmade: out.isHandmade,
      confidence: Math.round(out.confidence ?? 0),
      reasoning: stripMarkdownEmphasis(out.reasoning) || 'No explanation was provided.',
      indicators: out.indicators,
    });
  });

  ai$.post('/translate', requireJson, smallJson, async (req, res) => {
    const { text, targetLanguage } = parseBody(translateRequest, req.body);
    const translation = await runAi(res, timeouts.text, signal => ai!.translate(text, targetLanguage, signal));
    if (!translation) throw new AiUpstreamError('Empty translation', true);
    res.json({ translation: translation.slice(0, 3000) });
  });

  ai$.post('/tts', userLimiter(10), requireJson, smallJson, async (req, res) => {
    const { text, language } = parseBody(ttsRequest, req.body);
    const audio = await runAi(res, timeouts.text, signal => ai!.textToSpeech(text, language, signal));
    if (audio && (!/^[A-Za-z0-9+/]+={0,2}$/.test(audio) || audio.length > 12_000_000)) throw new AiUpstreamError('Invalid audio', false);
    res.json({ audio: audio ?? null, sampleRate: 24000 });
  });

  ai$.post('/chat', requireJson, smallJson, async (req, res) => {
    const { message, history } = parseBody(chatRequest, req.body);
    const reply = await runAi(res, timeouts.text, signal => ai!.chat(message, locals(res).role!, history, signal));
    res.json({ reply: stripMarkdownEmphasis(reply).slice(0, 4000) || 'Sorry, I could not answer that just now.' });
  });

  ai$.post('/heritage-activities', requireJson, smallJson, async (req, res) => {
    const { placeName } = parseBody(heritageRequest, req.body);
    if (!HERITAGE_PLACES.has(placeName)) throw new HttpError(400, 'unknown_place', 'Unknown heritage site.');
    const raw = await runAi(res, timeouts.text, signal => ai!.heritageActivities(placeName, signal));
    res.json(heritageOutput.parse(raw ?? {}));
  });

  ai$.post('/profile-description', requireRole('SHOPKEEPER'), requireJson, smallJson, async (req, res) => {
    const { name, category } = parseBody(profileDescriptionRequest, req.body);
    const text = await runAi(res, timeouts.text, signal => ai!.profileDescription(name, category, signal));
    res.json({ description: stripMarkdownEmphasis(text).slice(0, 1200) });
  });

  api.use('/ai', ai$);
  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'Not found.')));
  app.use('/api', api);

  /* ------------------------------ SPA ------------------------------- */
  if (deps.staticDir && fs.existsSync(deps.staticDir)) {
    const staticDir = deps.staticDir;
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y', index: false, fallthrough: false }));
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    const indexHtml = path.join(staticDir, 'index.html');
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  /* ---------------------------- Errors ------------------------------ */
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestId = locals(res).requestId;
    let status = 500;
    let code = 'internal_error';
    let message = 'Something went wrong. Please try again.';
    let details: unknown;

    const bodyErr = err as { type?: string; status?: number };
    if (err instanceof HttpError) {
      status = err.status;
      code = err.code;
      message = err.message;
      details = err.details;
    } else if (bodyErr?.type === 'entity.too.large') {
      status = 413; code = 'payload_too_large'; message = 'The request is too large.';
    } else if (bodyErr?.type === 'entity.parse.failed') {
      status = 400; code = 'invalid_json'; message = 'The request body is not valid JSON.';
    } else if (err instanceof AiUnavailableError) {
      status = 503; code = 'ai_not_configured'; message = 'AI features are not available right now. You can still enter records manually.';
    } else if (err instanceof AiUpstreamError) {
      status = err.retryable ? 503 : 502; code = 'ai_unavailable'; message = 'The AI service did not respond. Please try again, or enter the record manually.';
    } else if (err instanceof z.ZodError) {
      status = 502; code = 'ai_bad_output'; message = 'The AI returned an unexpected answer. Please try again.';
    }

    if (status >= 500) {
      logger.error('request_failed', { requestId, code, error: err instanceof Error ? err.message : String(err) });
    }
    if (res.headersSent) return;
    res.status(status).json({ error: { code, message, requestId, ...(details ? { fields: details } : {}) } });
  });

  return app;
}
