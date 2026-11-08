import type { AiProvider } from './provider.ts';

/*
 * Deterministic stand-in for Gemini, used ONLY for local development without
 * an API key and for automated tests (config.ts refuses it in production).
 * Its output is clearly marked so it can never be mistaken for real analysis.
 */

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
};

function numberAfter(text: string, pattern: RegExp): number | undefined {
  const m = pattern.exec(text);
  if (!m) return undefined;
  const raw = m[1];
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return WORD_NUMBERS[raw];
}

export function mockParseLedger(transcript: string): Record<string, unknown> {
  const t = transcript.toLowerCase();
  let action = 'none';
  if (/\b(sold|becha|bechi|bika|beche)\b/.test(t)) action = 'transaction';
  else if (/\b(bought|purchased|kharide|kharida|kharidi)\b/.test(t)) action = 'expense';
  else if (/\b(wages|labour|labor|mazduri|rent|bill)\b/.test(t)) action = 'other_expense';
  else if (/\b(ko diye|gave|given to|paid to)\b/.test(t)) action = 'personal_paid';
  else if (/\b(se liye|received from|got from)\b/.test(t)) action = 'personal_received';
  if (action === 'none') return { action: 'none', category: 'BUSINESS' };

  const quantity = numberAfter(t, /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|chaar|char|paanch|panch)\s+(?!rupees|rs|₹)[a-z]/);
  const price = numberAfter(t, /(?:for|rs\.?|₹|rupees|mein|me)\s*(\d+(?:\.\d+)?)/) ?? numberAfter(t, /(\d+(?:\.\d+)?)\s*(?:rupees|rs|rupaye)/);
  const pending = /\b(udhaar|udhar|credit|baaki|baki|pending|baad me)\b/.test(t);
  const customer = /\b(?:to|customer|from)\s+([a-z]+)\b/.exec(t)?.[1];

  let item: string | undefined;
  const itemMatch = /\b(?:sold|bought|purchased|becha|bechi|kharide)\s+(?:\d+|one|two|three|four|five|ek|do|teen)?\s*([a-z][a-z ]{1,40}?)(?=\s+(?:for|to|from|on|at|rs|₹|\d)|$)/.exec(t);
  if (itemMatch) item = itemMatch[1].trim();
  if (action === 'other_expense') item = /(wages|labour|rent|bill)/.exec(t)?.[1];
  if (action === 'personal_paid' || action === 'personal_received') item = /\b([a-z]+)\s+(?:ko|se)\b/.exec(t)?.[1] ?? customer;

  return {
    action,
    category: action.startsWith('personal') ? 'PERSONAL' : 'BUSINESS',
    item: item ? item.replace(/\b\w/g, c => c.toUpperCase()) : undefined,
    quantity,
    price,
    payment_status: pending ? 'PENDING' : 'PAID',
    customer_name: pending && customer ? customer.replace(/\b\w/g, c => c.toUpperCase()) : undefined,
    is_purchased: action === 'expense' ? true : undefined,
  };
}

export function createMockProvider(): AiProvider {
  return {
    name: 'mock',
    async parseLedger(transcript) {
      return mockParseLedger(transcript);
    },
    async analyzeProduct() {
      return { title: '[Demo AI] Hand-painted piece', story: '[Demo AI] Local development placeholder. Configure GEMINI_API_KEY for real analysis.', price: 1500, style: 'Miniature' };
    },
    async checkAuthenticity() {
      return { isHandmade: true, confidence: 50, reasoning: '[Demo AI] Local development placeholder — no real analysis was performed.', indicators: ['Demo mode'] };
    },
    async translate(text, targetLanguage) {
      return `[${targetLanguage}] ${text}`;
    },
    async textToSpeech() {
      return null;
    },
    async chat(message) {
      return `[Demo AI] You asked: "${message.slice(0, 120)}". Configure GEMINI_API_KEY for real answers.`;
    },
    async heritageActivities() {
      return { description: '', activities: [], must_do: '' };
    },
    async profileDescription(name, category) {
      return `[Demo AI] ${name} works in ${category} in Udaipur.`;
    },
  };
}
