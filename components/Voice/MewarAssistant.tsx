
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
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[101] w-[90vw] max-w-md pointer-events-none">
      <div className="flex flex-col items-center gap-8 pointer-events-auto">
        
        {(status !== 'idle' || interimTranscript) && (
          <div className={`w-full min-h-[80px] p-6 rounded-[28px] shadow-2xl border glass-mewar animate-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center gap-4 ${
            status === 'success' ? 'border-green-500/50 bg-green-50/95' : 
            status === 'error' ? 'border-red-500/50 bg-red-50/95' :
            'border-gold/30'
          }`}>
            <div className="flex items-center justify-center w-full gap-3">
              {status === 'listening' && (
                <div className="flex items-center gap-2 h-6">
                  <div className="flex gap-1 shrink-0">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i}
                        className="w-1 bg-red-500 rounded-full animate-waveform"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-heritage font-bold uppercase tracking-[0.2em] text-gray-700 whitespace-nowrap">
                    Boli Capturing...
                  </span>
                </div>
              )}
              {status === 'processing' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-saffron w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-heritage font-bold uppercase tracking-[0.2em] text-gold whitespace-nowrap">
                    Auditing Boli...
                  </span>
                </div>
              )}
              {status === 'success' && (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-heritage font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                    Entry Recognized
                  </span>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-heritage font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                    {errorMessage}
                  </span>
                </div>
              )}
            </div>

            {interimTranscript && (
              <div className="relative w-full px-6">
                <div className="absolute left-0 top-0 text-gold/30 font-heritage text-2xl select-none">"</div>
                <p className={`text-base italic font-medium text-center break-words leading-relaxed transition-opacity duration-300 ${status === 'listening' || status === 'processing' ? 'opacity-100 text-gray-800' : 'opacity-60 text-current'}`}>
                  {interimTranscript}
                </p>
                <div className="absolute right-0 bottom-0 text-gold/30 font-heritage text-2xl select-none">"</div>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            onClick={status === 'listening' ? () => recognitionRef.current?.stop() : startListening}
            disabled={status === 'processing' || status === 'success'}
            className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center z-10 ${
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
            
            <div className={`absolute -inset-4 rounded-full border-2 border-gold/30 transition-opacity duration-700 ${status === 'listening' ? 'opacity-100 animate-ping' : 'opacity-0'}`} />
            <div className={`absolute -inset-1 rounded-full border border-white/20 transition-opacity duration-700 ${status === 'listening' ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
