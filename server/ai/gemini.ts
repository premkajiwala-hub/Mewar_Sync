import { GoogleGenAI, Modality, Type } from '@google/genai';
import type { ServerConfig } from '../config.ts';
import type { UserRole } from '../../types.ts';
import { AiUpstreamError, type AiProvider, type ChatTurn, type ImageInput } from './provider.ts';
import {
  AUTHENTICITY_SYSTEM,
  HERITAGE_SYSTEM,
  LEDGER_SYSTEM,
  PRODUCT_SYSTEM,
  PROFILE_SYSTEM,
  chatSystem,
  heritageUserContent,
  ledgerUserContent,
  profileUserContent,
  translateSystem,
  translateUserContent,
  ttsPrompt,
} from './prompts.ts';

function parseJson(text: string | undefined): unknown {
  if (!text) return {};
  const cleaned = text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

function classify(err: unknown): AiUpstreamError {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && err.name === 'AbortError') return new AiUpstreamError('AI request timed out', true);
  const retryable = /\b(429|500|502|503|504)\b|quota|overloaded|unavailable|ECONNRESET|fetch failed/i.test(message);
  return new AiUpstreamError(retryable ? 'AI service is busy' : 'AI request failed', retryable);
}

/** One retry with backoff for transient upstream errors. AI reads are idempotent. */
async function withRetry<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const classified = classify(err);
    if (!classified.retryable || signal.aborted) throw classified;
    await new Promise(r => setTimeout(r, 1200));
    if (signal.aborted) throw classified;
    try {
      return await fn();
    } catch (err2) {
      throw classify(err2);
    }
  }
}

export function createGeminiProvider(config: ServerConfig): AiProvider {
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey! });
  const { text: textModel, vision: visionModel, tts: ttsModel } = config.models;

  return {
    name: 'gemini',

    parseLedger(transcript, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: textModel,
          contents: ledgerUserContent(transcript),
          config: {
            abortSignal: signal,
            systemInstruction: LEDGER_SYSTEM,
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING, enum: ['transaction', 'expense', 'other_expense', 'personal_received', 'personal_paid', 'inventory', 'none'] },
                category: { type: Type.STRING, enum: ['BUSINESS', 'PERSONAL'] },
                item: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                price: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                payment_status: { type: Type.STRING, enum: ['PAID', 'PENDING'] },
                customer_name: { type: Type.STRING },
                is_purchased: { type: Type.BOOLEAN },
              },
              required: ['action', 'category'],
            },
          },
        });
        return parseJson(res.text);
      }, signal);
    },

    analyzeProduct(image: ImageInput, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: visionModel,
          contents: { parts: [{ inlineData: { data: image.data, mimeType: image.mimeType } }, { text: 'Analyse this craft piece.' }] },
          config: {
            abortSignal: signal,
            systemInstruction: PRODUCT_SYSTEM,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                story: { type: Type.STRING },
                price: { type: Type.NUMBER },
                style: { type: Type.STRING },
              },
              required: ['title', 'story', 'price', 'style'],
            },
          },
        });
        return parseJson(res.text);
      }, signal);
    },

    checkAuthenticity(image: ImageInput, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: visionModel,
          contents: { parts: [{ inlineData: { data: image.data, mimeType: image.mimeType } }, { text: 'Assess this piece.' }] },
          config: {
            abortSignal: signal,
            systemInstruction: AUTHENTICITY_SYSTEM,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isHandmade: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER },
                reasoning: { type: Type.STRING },
                indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['isHandmade', 'confidence', 'reasoning', 'indicators'],
            },
          },
        });
        return parseJson(res.text);
      }, signal);
    },

    translate(text, targetLanguage, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: textModel,
          contents: translateUserContent(text),
          config: { abortSignal: signal, systemInstruction: translateSystem(targetLanguage), maxOutputTokens: 600, temperature: 0.2 },
        });
        return (res.text || '').trim();
      }, signal);
    },

    textToSpeech(text, language, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: ttsModel,
          contents: [{ parts: [{ text: ttsPrompt(text, language) }] }],
          config: {
            abortSignal: signal,
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        });
        return res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
      }, signal);
    },

    chat(message: string, role: UserRole, history: ChatTurn[], signal) {
      return withRetry(async () => {
        const contents = [
          ...history.map(turn => ({ role: turn.sender === 'user' ? 'user' : 'model', parts: [{ text: turn.text }] })),
          { role: 'user', parts: [{ text: message }] },
        ];
        const res = await ai.models.generateContent({
          model: textModel,
          contents,
          config: { abortSignal: signal, systemInstruction: chatSystem(role), maxOutputTokens: 700, temperature: 0.6 },
        });
        return (res.text || '').trim();
      }, signal);
    },

    heritageActivities(placeName, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: textModel,
          contents: heritageUserContent(placeName),
          config: {
            abortSignal: signal,
            systemInstruction: HERITAGE_SYSTEM,
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
          },
        });
        return parseJson(res.text);
      }, signal);
    },

    profileDescription(name, category, signal) {
      return withRetry(async () => {
        const res = await ai.models.generateContent({
          model: textModel,
          contents: profileUserContent(name, category),
          config: { abortSignal: signal, systemInstruction: PROFILE_SYSTEM, maxOutputTokens: 300, temperature: 0.7 },
        });
        return (res.text || '').trim();
      }, signal);
    },
  };
}
