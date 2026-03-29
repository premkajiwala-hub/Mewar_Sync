
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VoiceAction } from "../types";

const RETRY_DELAY = 1500;
const MAX_RETRIES = 2;

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = error.message?.includes("429") || error.message?.includes("quota");
      const isFetchError = error.message?.includes("fetch") || error.message?.includes("NetworkError");
      
      if (isQuotaError && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return this.withRetry(fn, retries - 1);
      }
      
      if (isFetchError) {
        throw new Error("Heritage AI is currently unreachable. Please check your internet connection.");
      }
      
      throw error;
    }
  }

  private safeParseJson(text: string | undefined, defaultValue: any): any {
    if (!text) return defaultValue;
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          let candidate = jsonMatch[0];
          const opens = (candidate.match(/\{/g) || []).length;
          const closes = (candidate.match(/\}/g) || []).length;
          for (let i = 0; i < (opens - closes); i++) candidate += "}";
          return JSON.parse(candidate);
        } catch {
          return defaultValue;
        }
      }
      return defaultValue;
    }
  }

  private getAI() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is missing. Please set VITE_GEMINI_API_KEY in your environment.");
    }
    return new GoogleGenAI({ apiKey });
  }

  async parseLedgerVoice(transcript: string): Promise<VoiceAction> {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a Rajasthani Bahi-Khata expert. Extract structured data from this mixed-language transcript (English, Hindi, Mewari, Marwari).
        
        Transcript: "${transcript}"
        
        CRITICAL CATEGORIZATION RULES:
        1. BOUGHT / PURCHASED / LIYE / KHAREEDE / STOCK AAYA: Action: "expense" (Increases stock).
        2. SOLD / BIKA / DIYE (sale context) / BECHA / CUSTOMER NE LIYA: Action: "transaction" (Decreases stock).
        3. LABOUR / MAZDOOR / MAZDURI / WAGES: Action: "other_expense", Category: "BUSINESS".
        4. GIVEN TO PERSON (e.g., "Rajesh ko diye"): Action: "personal_paid".
        5. RECEIVED FROM PERSON (e.g., "Sunil se liye"): Action: "personal_received".
        6. UDHAAR / CREDIT / BAAD ME DEGA / KHATA / BAAKI / PENDING: Set payment_status to "PENDING".
        7. TRANSLATION RULE: The "item" field MUST ALWAYS be in English, even if the transcript is in Hindi, Mewari, or Marwari. Translate it accurately to its English equivalent (e.g., "Sona" -> "Gold", "Chandi" -> "Silver", "Murtiyan" -> "Statues").
        
        Extract customer_name if mentioned (e.g., "Rajesh ne udhaar liya" -> customer_name: "Rajesh").
        If "baaki" or "udhaar" is mentioned, ensure payment_status is "PENDING".
        
        If the user says they BOUGHT/PURCHASED (kharidi, liye for stock), set is_purchased to true.
        If the user says they MADE/PRODUCED (banayi, taiyaar kari), set is_purchased to false.
        Default is_purchased to false if not clear.
        
        Context: Artisan workshop in Udaipur. Handle mixed dialects flawlessly.
        Return JSON: { action, category (BUSINESS/PERSONAL), item, quantity, price (total), unitPrice, payment_status (PAID/PENDING), customer_name, is_purchased }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING, enum: ["transaction", "expense", "other_expense", "personal_received", "personal_paid", "inventory", "none"] },
              category: { type: Type.STRING, enum: ["BUSINESS", "PERSONAL"] },
              item: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              unitPrice: { type: Type.NUMBER },
              payment_status: { type: Type.STRING, enum: ["PAID", "PENDING"] },
              customer_name: { type: Type.STRING },
              is_purchased: { type: Type.BOOLEAN }
            },
            required: ["action", "category", "item"]
          }
        }
      });
      return this.safeParseJson(response.text, { action: "none", category: "BUSINESS", item: "Manual Entry", is_purchased: false });
    });
  }

  async analyzeProduct(base64Image: string) {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: `As a Royal Curator of Udaipur, analyze this artisan craft.
            
            REQUIREMENTS:
            1. Title: A majestic and marketable name.
            2. Story: Write a DETAILED heritage narrative (minimum 150 words). Focus on the craftsmanship, the history of the style in Mewar, material secrets (e.g., stone pigments, natural dyes), and the symbolic meaning of the patterns.
            3. Price: Fair high-end market value in INR.
            4. Style: Precise category (e.g., Pichwai, Miniature, Koftgari).
            
            Return JSON only.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              style: { type: Type.STRING },
              story: { type: Type.STRING },
              price: { type: Type.NUMBER },
              title: { type: Type.STRING }
            },
            required: ["style", "story", "price", "title"]
          }
        }
      });
      return this.safeParseJson(response.text, { 
        style: "Mewari", 
        story: "Detailed heritage narrative of Udaipur's craftsmanship.",
        price: 2500,
        title: "Artisanal Masterpiece"
      });
    });
  }

  async checkAuthenticity(base64Image: string) {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: `Perform a forensic authenticity scan. Look for:
            - Hand-painted irregularities (stroke jitter, natural pigment layering).
            - Machine print signs (CMYK halftone dots, perfect uniformity).
            - Material clues (handmade paper vs synthetic cloth).
            
            Return JSON: { isHandmade: boolean, confidence: number, reasoning: string (detailed), indicators: string[] }` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isHandmade: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              indicators: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["isHandmade", "confidence", "reasoning", "indicators"]
          }
        }
      });
      return this.safeParseJson(response.text, { isHandmade: true, confidence: 50, reasoning: "Scanning...", indicators: [] });
    });
  }

  async translateMessage(text: string, targetLanguage: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following text to ${targetLanguage}: "${text}". 
        
        CONTEXT: Heritage artisan ecosystem in Udaipur, Mewar.
        
        STRICT LANGUAGE RULES:
        1. If target is "Hindi", use Standard Modern Hindi (Khadi Boli). Do NOT use Marwari or Mewari words like 'ro', 'thaaro', 'mhaaro', 'kai', 'in'. Use 'ka', 'aapka', 'mera', 'kya', 'in'.
        2. If target is "Mewari" or "Marwari", use authentic local Rajasthani vocabulary and grammar.
        3. If target is "English", use clear, professional English.
        4. Always maintain a polite, respectful tone (using 'Aap' or 'Hukumn' as appropriate for the culture).
        5. Ensure the translation is COMPLETE and captures the full meaning.
        
        Output ONLY the translated text.`,
        config: { maxOutputTokens: 500 }
      });
      return response.text?.trim() || "Translation failed.";
    });
  }

  async generateHeritageAudio(text: string, language: string = 'Hindi') {
    if (!text || text.trim().length < 2) return null;
    return this.withRetry(async () => {
      const ai = this.getAI();
      
      let instruction = `Speak this in an authentic ${language} accent.`;
      if (language === 'Hindi') {
        instruction += ` Use Standard Modern Hindi pronunciation with a polite and respectful tone.`;
      } else if (language === 'Mewari' || language === 'Marwari') {
        instruction += ` Use a warm, royal Rajasthani tone with proper local inflections.`;
      } else {
        instruction += ` Use a warm, professional tone.`;
      }
      instruction += ` Text: ${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: instruction }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    });
  }

  async normalizeItemName(name: string): Promise<string> {
    if (!name || name.trim().length === 0) return "";
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Normalize this inventory item name for a heritage artisan shop. 
        Rules:
        1. Convert to English if it's in Hindi/Mewari/Marwari.
        2. Convert to singular form (e.g., "Paintings" -> "painting", "Boxes" -> "box").
        3. Convert to lowercase.
        4. Remove extra spaces and punctuation.
        5. Fix common misspellings and phonetic variations (e.g., "Paintingss" -> "painting", "Panting" -> "painting").
        6. Use the most common generic name.
        
        Item Name: "${name}"
        
        Output ONLY the normalized English name in lowercase.`,
        config: { maxOutputTokens: 20 }
      });
      return response.text?.trim().toLowerCase() || name.toLowerCase();
    });
  }

  async chat(message: string, context: string): Promise<string> {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are the Mewar-Sync Heritage Assistant. 
        Context: ${context}
        User says: "${message}"
        Provide a helpful, polite, and culturally rich response in the spirit of Udaipur. Keep it concise.`,
      });
      return response.text?.trim() || "I am unable to respond at the moment, Hukumn.";
    });
  }

  async getHeritageActivities(placeName: string) {
    return this.withRetry(async () => {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Find popular tourist activities, workshops, or experiences at ${placeName}, Udaipur. 
        Include entry fees (Indian/Foreigner) and specific activity costs if available.
        Focus on cultural and heritage experiences.
        
        IMPORTANT: The "description" MUST be a single, captivating sentence (max 120 characters) that captures the essence of the place.
        For "timings", use simple "HH:MM AM/PM" format for open and close. If there are multiple sessions, use the primary one. Put any complex details or session info in the "must_do" or a new "timing_note" field.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              entry_fee_indian: { type: Type.NUMBER },
              entry_fee_foreigner: { type: Type.NUMBER },
              camera_fee: { type: Type.NUMBER },
              timings: {
                type: Type.OBJECT,
                properties: {
                  open: { type: Type.STRING },
                  close: { type: Type.STRING },
                  timing_note: { type: Type.STRING }
                }
              },
              activities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    cost: { type: Type.NUMBER },
                    note: { type: Type.STRING }
                  },
                  required: ["name", "cost"]
                }
              },
              must_do: { type: Type.STRING }
            },
            required: ["description", "activities", "must_do"]
          }
        }
      });
      return this.safeParseJson(response.text, { 
        description: "A beautiful heritage site in Udaipur.",
        activities: [],
        must_do: "Explore the historic architecture."
      });
    });
  }
}

export const geminiService = new GeminiService();
