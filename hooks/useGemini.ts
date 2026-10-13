
import { useState, useCallback } from 'react';
import { geminiService } from '../services/gemini';

/**
 * Custom hook to interact with Gemini AI features
 */
export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processVoiceLedger = useCallback(async (transcript: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.parseLedgerVoice(transcript);
      return result;
    } catch (err) {
      setError('Failed to parse voice ledger.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeProductImage = useCallback(async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.analyzeProduct(base64);
      return result;
    } catch (err) {
      setError('Failed to analyze product image.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyAuthenticity = useCallback(async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await geminiService.checkAuthenticity(base64);
      return result;
    } catch (err) {
      setError('Authenticity check failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAudioGuide = useCallback(async (text: string) => {
    setLoading(true);
    setError(null);
    try {
      return await geminiService.generateHeritageAudio(text);
    } catch (err) {
      setError('Audio generation failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getHeritageActivities = useCallback(async (placeName: string) => {
    setLoading(true);
    setError(null);
    try {
      return await geminiService.getHeritageActivities(placeName);
    } catch (err) {
      setError('Failed to fetch heritage activities.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, processVoiceLedger, analyzeProductImage, verifyAuthenticity, getAudioGuide, getHeritageActivities };
};
