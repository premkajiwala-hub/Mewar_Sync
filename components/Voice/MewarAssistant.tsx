
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { geminiService } from '../../services/gemini';
import { VoiceAction } from '../../types';
import { storage } from '../../services/storage';

interface MewarAssistantProps {
  onAction: (action: VoiceAction) => void;
}

export const MewarAssistant: React.FC<MewarAssistantProps> = ({ onAction }) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);

  const resetStatus = () => {
    setStatus('idle');
    setErrorMessage('');
    setInterimTranscript('');
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('error');
      setErrorMessage('Voice not supported');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
      setStatus('listening');
      setInterimTranscript('');
    };

    recognition.onresult = (event: any) => {
      let current = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        current += event.results[i][0].transcript;
      }
      setInterimTranscript(current);

      if (event.results[0].isFinal) {
        processTranscript(current);
      }
    };

    const processTranscript = async (transcript: string) => {
      if (!transcript.trim()) {
        setStatus('idle');
        return;
      }

      setStatus('processing');
      try {
        const action = await geminiService.parseLedgerVoice(transcript);
        action.transcript = transcript;
        
        // Audit log the AI interaction
        await storage.logAIInteraction('VOICE_LEDGER', transcript, action);
        
        onAction(action);
        
        setStatus('success');
        setTimeout(resetStatus, 3000);
      } catch (e: any) {
        console.error("Voice Sync Error:", e);
        setStatus('error');
        setErrorMessage('Sync failed');
        setTimeout(resetStatus, 4000);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return;
      setStatus('error');
      setErrorMessage('Mic error: ' + event.error);
      setTimeout(resetStatus, 3000);
    };

    try {
      recognition.start();
    } catch (e) {
      setStatus('idle');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[101] w-full max-w-sm px-4 pointer-events-none">
      <div className="flex flex-col items-center gap-4 pointer-events-auto">
        
        {(status !== 'idle' || interimTranscript) && (
          <div className={`w-full p-6 rounded-[32px] shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom duration-300 flex flex-col items-center gap-3 ${
            status === 'success' ? 'bg-green-600 border-green-400 text-white' : 
            status === 'error' ? 'bg-red-600 border-red-400 text-white' :
            'bg-white/95 border-gold/30 text-gray-900 shadow-gold/20'
          }`}>
            <div className="flex items-center gap-2">
              {status === 'listening' && (
                <div className="flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Boli Capturing...</span>
                </div>
              )}
              {status === 'processing' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-saffron w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Auditing Boli...</span>
                </div>
              )}
              {status === 'success' && <span className="text-[10px] font-bold uppercase tracking-widest">Entry Recognized</span>}
              {status === 'error' && <span className="text-[10px] font-bold uppercase tracking-widest">{errorMessage}</span>}
            </div>

            {interimTranscript && (
              <p className={`text-sm italic font-medium text-center line-clamp-3 transition-opacity duration-300 ${status === 'listening' || status === 'processing' ? 'opacity-100 text-gray-800' : 'opacity-60 text-current'}`}>
                "{interimTranscript}"
              </p>
            )}
          </div>
        )}

        <button
          onClick={status === 'listening' ? () => recognitionRef.current?.stop() : startListening}
          disabled={status === 'processing' || status === 'success'}
          className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center ${
            status === 'listening' ? 'bg-red-500 scale-110' : 
            status === 'success' ? 'bg-green-600' :
            status === 'error' ? 'bg-red-700' :
            'bg-royal-gradient hover:scale-105 active:scale-95'
          }`}
        >
          {status === 'processing' ? (
            <Loader2 className="text-white animate-spin w-8 h-8" />
          ) : status === 'success' ? (
            <CheckCircle2 className="text-white w-8 h-8" />
          ) : (
            <Mic className={`text-white w-8 h-8 ${status === 'listening' ? 'animate-pulse' : ''}`} />
          )}
          
          <div className={`absolute -inset-2 rounded-full border border-gold/20 transition-opacity duration-700 ${status === 'listening' ? 'opacity-100 animate-ping' : 'opacity-0'}`} />
        </button>
      </div>
    </div>
  );
};
