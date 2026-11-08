import { z } from 'zod';
import { MAX_TRANSCRIPT_LENGTH } from '../lib/voice.ts';

export const SUPPORTED_LANGUAGES = ['English', 'Hindi', 'Marwari', 'Mewari'] as const;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Decoded image size limit for AI analysis (images are downscaled client-side first). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const trimmed = (max: number) => z.string().trim().min(1).max(max);

export const parseLedgerRequest = z.object({
  transcript: trimmed(MAX_TRANSCRIPT_LENGTH),
}).strict();

export const imageRequest = z.object({
  image: z.string().min(16).max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Image must be base64 encoded'),
  mimeType: z.enum(IMAGE_MIME_TYPES),
}).strict();

export const translateRequest = z.object({
  text: trimmed(1000),
  targetLanguage: z.enum(SUPPORTED_LANGUAGES),
}).strict();

export const ttsRequest = z.object({
  text: trimmed(1500),
  language: z.enum(SUPPORTED_LANGUAGES).default('Hindi'),
}).strict();

export const chatRequest = z.object({
  message: trimmed(800),
  history: z.array(z.object({
    sender: z.enum(['user', 'bot']),
    text: z.string().max(2000),
  }).strict()).max(10).default([]),
}).strict();

export const heritageRequest = z.object({
  placeName: trimmed(80),
}).strict();

export const profileDescriptionRequest = z.object({
  name: trimmed(80),
  category: trimmed(60),
}).strict();

/* ---------- Model output schemas (untrusted → bounded) ---------- */

const boundedText = (max: number) => z.preprocess(v => (typeof v === 'string' ? v.trim().slice(0, max) : ''), z.string());
const boundedNumber = (min: number, max: number) =>
  z.preprocess(v => {
    const n = typeof v === 'string' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
    return Math.min(Math.max(n, min), max);
  }, z.number().optional());

export const productAnalysisOutput = z.object({
  title: boundedText(140),
  story: boundedText(5000),
  price: boundedNumber(0, 10_000_000),
  style: boundedText(80),
});

export const authenticityOutput = z.object({
  isHandmade: z.preprocess(v => v === true, z.boolean()),
  confidence: boundedNumber(0, 100),
  reasoning: boundedText(3000),
  indicators: z.preprocess(
    v => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 10).map(x => (x as string).trim().slice(0, 200)) : []),
    z.array(z.string())
  ),
});

const timeText = z.preprocess(v => (typeof v === 'string' ? v.trim().slice(0, 24) : undefined), z.string().optional());

export const heritageOutput = z.object({
  description: boundedText(300),
  entry_fee_indian: boundedNumber(0, 100_000),
  entry_fee_foreigner: boundedNumber(0, 100_000),
  camera_fee: boundedNumber(0, 100_000),
  timings: z.preprocess(
    v => (v && typeof v === 'object' ? v : undefined),
    z.object({ open: timeText, close: timeText, timing_note: z.preprocess(v => (typeof v === 'string' ? v.trim().slice(0, 200) : undefined), z.string().optional()) }).optional()
  ),
  activities: z.preprocess(
    v => (Array.isArray(v) ? v.slice(0, 15) : []),
    z.array(z.object({
      name: boundedText(120),
      cost: z.preprocess(v => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1_000_000) : 0), z.number()),
      note: z.preprocess(v => (typeof v === 'string' ? v.trim().slice(0, 200) : undefined), z.string().optional()),
    })).transform(list => list.filter(a => a.name.length > 0))
  ),
  must_do: boundedText(500),
});
