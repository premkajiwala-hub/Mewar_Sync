import type { UserRole } from '../../types.ts';

export interface ImageInput {
  data: string;
  mimeType: string;
}

export interface ChatTurn {
  sender: 'user' | 'bot';
  text: string;
}

/**
 * The AI capabilities the app uses. Providers return *raw* model output; the
 * HTTP layer validates and bounds everything before it reaches the client.
 */
export interface AiProvider {
  readonly name: string;
  parseLedger(transcript: string, signal: AbortSignal): Promise<unknown>;
  analyzeProduct(image: ImageInput, signal: AbortSignal): Promise<unknown>;
  checkAuthenticity(image: ImageInput, signal: AbortSignal): Promise<unknown>;
  translate(text: string, targetLanguage: string, signal: AbortSignal): Promise<string>;
  textToSpeech(text: string, language: string, signal: AbortSignal): Promise<string | null>;
  chat(message: string, role: UserRole, history: ChatTurn[], signal: AbortSignal): Promise<string>;
  heritageActivities(placeName: string, signal: AbortSignal): Promise<unknown>;
  profileDescription(name: string, category: string, signal: AbortSignal): Promise<string>;
}

export class AiUnavailableError extends Error {}
export class AiUpstreamError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}
