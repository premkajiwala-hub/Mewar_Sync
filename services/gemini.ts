import type { VoiceAction } from '../types';
import { apiPost } from './api';
import { sanitizeVoiceAction } from '../lib/voice';
import { prepareImageForAI } from '../lib/image';

/*
 * Client for the AI features. All calls go through the Mewar Sync API, which
 * authenticates the user, enforces roles and rate limits, holds the Gemini
 * key server-side, and validates model output. Results are still treated as
 * untrusted suggestions by the UI.
 */

export interface ProductAnalysis {
  title: string;
  story: string;
  price: number | null;
  style: string;
}

export interface AuthenticityReport {
  isHandmade: boolean;
  confidence: number;
  reasoning: string;
  indicators: string[];
}

export interface HeritageInfo {
  description: string;
  entry_fee_indian?: number;
  entry_fee_foreigner?: number;
  camera_fee?: number;
  timings?: { open?: string; close?: string; timing_note?: string };
  activities: { name: string; cost: number; note?: string }[];
  must_do: string;
}

export interface ChatHistoryTurn {
  sender: 'user' | 'bot';
  text: string;
}

export const geminiService = {
  async parseLedgerVoice(transcript: string): Promise<VoiceAction> {
    const { action } = await apiPost<{ action: unknown }>('/ai/parse-ledger', { transcript: transcript.trim().slice(0, 500) });
    // Defence in depth: sanitise again on the client.
    return sanitizeVoiceAction(action, transcript);
  },

  async analyzeProduct(file: File | Blob): Promise<ProductAnalysis> {
    const payload = await prepareImageForAI(file);
    return apiPost<ProductAnalysis>('/ai/analyze-product', payload, { timeoutMs: 75_000 });
  },

  async checkAuthenticity(file: File | Blob): Promise<AuthenticityReport> {
    const payload = await prepareImageForAI(file);
    return apiPost<AuthenticityReport>('/ai/check-authenticity', payload, { timeoutMs: 75_000 });
  },

  async translateMessage(text: string, targetLanguage: string): Promise<string> {
    const { translation } = await apiPost<{ translation: string }>('/ai/translate', { text: text.slice(0, 1000), targetLanguage });
    return translation;
  },

  async generateHeritageAudio(text: string, language = 'Hindi'): Promise<string | null> {
    if (!text || text.trim().length < 2) return null;
    const { audio } = await apiPost<{ audio: string | null }>('/ai/tts', { text: text.slice(0, 1500), language });
    return audio;
  },

  async chat(message: string, history: ChatHistoryTurn[] = []): Promise<string> {
    const trimmedHistory = history.slice(-8).map(t => ({ sender: t.sender, text: t.text.slice(0, 2000) }));
    const { reply } = await apiPost<{ reply: string }>('/ai/chat', { message: message.slice(0, 800), history: trimmedHistory });
    return reply;
  },

  async getHeritageActivities(placeName: string): Promise<HeritageInfo> {
    return apiPost<HeritageInfo>('/ai/heritage-activities', { placeName }, { timeoutMs: 45_000 });
  },

  async generateProfileDescription(name: string, category: string): Promise<string> {
    const { description } = await apiPost<{ description: string }>('/ai/profile-description', { name: name.slice(0, 80), category: category.slice(0, 60) });
    return description;
  },
};
