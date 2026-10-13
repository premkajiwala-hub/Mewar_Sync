
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Languages, Loader2, User, Store, Check, Info, ArrowRightLeft, Settings2, Volume2 } from 'lucide-react';
import { geminiService } from '../../services/gemini';
import { LANGUAGES as GLOBAL_LANGUAGES } from '../../services/translations';
import { storage } from '../../services/storage';

const TRANSLATION_LANGS = GLOBAL_LANGUAGES.map(l => l.name);

export const TranslatorBridge: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [inputLang, setInputLang] = useState('English');
  const [targetLang, setTargetLang] = useState('Hindi');
  const [showInputPicker, setShowInputPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const lastTranslatedRef = useRef({ text: '', lang: '' });

  const user = storage.getCurrentUser();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (user?.role === 'SHOPKEEPER') {
      setInputLang(user.preferredLanguage || 'Hindi');
      setTargetLang('English');
    } else {
      setInputLang('English');
      setTargetLang(user?.preferredLanguage || 'Hindi');
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [user]);

  useEffect(() => {
    const reTranslate = async () => {
      if (!transcript || isRecording) return;
      
      // Avoid redundant translations
      if (transcript === lastTranslatedRef.current.text && targetLang === lastTranslatedRef.current.lang) return;

      setLoading(true);
      try {
        const translated = await geminiService.translateMessage(transcript, targetLang);
        setTranslation(translated);
        lastTranslatedRef.current = { text: transcript, lang: targetLang };
        // We don't set loading false here, speakTranslation will handle it onstart
        speakTranslation(translated, targetLang);
      } catch (e) {
        setLoading(false);
        setTranslation("Translation error");
      }
    };
    reTranslate();
  }, [transcript, targetLang, isRecording]);

  const swapLanguages = () => {
    const temp = inputLang;
    setInputLang(targetLang);
    setTargetLang(temp);
    setTranscript('');
    setTranslation('');
    lastTranslatedRef.current = { text: '', lang: '' };
  };

  const speakTranslation = (text: string, lang: string = 'Hindi') => {
    if (!text || text === "Translation error") {
      setLoading(false);
      return;
    }
    
    // Stop Duplication: Cancel any ongoing speech before starting new one
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Accent & Language Matching
    const langMap: Record<string, string> = {
      'Hindi': 'hi-IN',
      'English': 'en-IN',
      'Marwari': 'hi-IN',
      'Mewari': 'hi-IN'
    };
    
    const targetLangCode = langMap[lang] || 'hi-IN';
    utterance.lang = targetLangCode;

    // Speech Parameters: Slightly faster and natural pitch
    utterance.pitch = 1.0;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setLoading(false); // Sync: Stop "Bridging Cultures" animation exactly when speech begins
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setLoading(false);
    };

    // Find best matching voice for the accent
    const speak = () => {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === targetLangCode) || 
                    voices.find(v => v.lang.startsWith(targetLangCode.split('-')[0]));
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = speak;
    } else {
      speak();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Hukumn, voice recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    
    const langMap: Record<string, string> = {
      'Hindi': 'hi-IN',
      'English': 'en-US',
      'Marwari': 'hi-IN',
      'Mewari': 'hi-IN'
    };

    recognitionRef.current.lang = langMap[inputLang] || 'en-US';
    
    recognitionRef.current.onstart = () => setIsRecording(true);
    recognitionRef.current.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
    };
    recognitionRef.current.onend = () => setIsRecording(false);
    recognitionRef.current.start();
  };

  const PickerModal = ({ title, active, onSelect, onClose }: any) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      <div className="glass-mewar p-8 rounded-[40px] border-2 border-gold/20 w-full max-w-md shadow-2xl bg-white relative animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-heritage font-bold mb-6 text-center">{title}</h3>
        <div className="grid grid-cols-2 gap-3">
          {TRANSLATION_LANGS.map(lang => (
            <button
              key={lang}
              onClick={() => { onSelect(lang); onClose(); }}
              className={`py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border-2 ${
                active === lang 
                ? 'bg-saffron border-saffron text-white shadow-lg' 
                : 'bg-white border-gold/10 text-gray-600 hover:border-saffron hover:bg-saffron/5'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full mt-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Close</button>
      </div>
    </div>
  );

  return (
    <div className="font-outfit">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-700 pb-24">
      <div className="glass-mewar p-4 md:p-6 rounded-[32px] border-2 border-gold/10 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 bg-white/60">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">My Language</p>
            <button 
              onClick={() => setShowInputPicker(true)}
              className="w-full md:w-40 px-5 py-3 bg-white border border-gold/20 rounded-2xl font-bold text-xs flex items-center justify-between hover:border-saffron transition-all shadow-sm"
            >
              {inputLang}
              <Settings2 size={14} className="text-gold" />
            </button>
          </div>

          <button 
            onClick={swapLanguages}
            className="mt-5 p-3 bg-royal-gradient text-white rounded-full shadow-lg hover:rotate-180 transition-all active:scale-90"
          >
            <ArrowRightLeft size={18} />
          </button>

          <div className="flex-1 md:flex-none">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Target Language</p>
            <button 
              onClick={() => setShowTargetPicker(true)}
              className="w-full md:w-40 px-5 py-3 bg-white border border-gold/20 rounded-2xl font-bold text-xs flex items-center justify-between hover:border-saffron transition-all shadow-sm"
            >
              {targetLang}
              <Settings2 size={14} className="text-gold" />
            </button>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center gap-3 bg-saffron/5 px-4 py-2 rounded-2xl border border-saffron/10">
          <Info size={14} className="text-saffron" />
          <span className="text-[9px] font-bold text-saffron uppercase tracking-widest">AI Mediation Active: {inputLang} to {targetLang}</span>
        </div>
      </div>

      <div className="glass-mewar p-10 rounded-[40px] border-2 border-gold/10 shadow-xl text-center relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12 pointer-events-none">
           <Languages size={200} />
        </div>
        
        <div className="relative z-10 space-y-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-heritage font-bold">The Royal Bridge</h2>
            <p className="text-gray-500 italic text-sm">Speak naturally, our heritage AI handles the rest.</p>
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={isRecording ? () => recognitionRef.current?.stop() : startRecording}
              disabled={loading || isSpeaking}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative ${
                isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-royal-gradient hover:scale-105 active:scale-95'
              } disabled:opacity-50`}
            >
              {isRecording ? (
                <div className="flex gap-1.5 items-end">
                  <div className="w-2 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite_0ms]" />
                  <div className="w-2 h-8 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms]" />
                  <div className="w-2 h-5 bg-white rounded-full animate-[bounce_0.8s_infinite_400ms]" />
                </div>
              ) : (
                <Mic className="text-white w-14 h-14" />
              )}
              {isRecording && <div className="absolute -inset-4 rounded-full border-2 border-red-200 animate-ping opacity-30" />}
            </button>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.5em] animate-pulse">
              {isRecording ? `Recording in ${inputLang}...` : `Tap to translate into ${targetLang}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[350px]">
        <div className="glass-mewar p-10 rounded-[40px] border-2 border-gold/10 shadow-lg flex flex-col bg-white/40 group hover:border-gold/30 transition-all">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/10 rounded-xl text-gold">
                  <User size={18} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{inputLang} Input</span>
              </div>
           </div>
           <div className="flex-grow flex items-center justify-center text-center italic text-gray-700 text-xl font-medium leading-relaxed">
             {transcript || `Captured speech in ${inputLang} will appear here...`}
           </div>
        </div>

        <div className="glass-mewar p-10 rounded-[40px] border-b-[16px] border-saffron shadow-xl flex flex-col relative overflow-hidden bg-white group hover:translate-y-[-4px] transition-all">
           {loading && (
             <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex items-center justify-center z-10 animate-in fade-in">
                <div className="flex flex-col items-center gap-6">
                  <Loader2 className="animate-spin text-saffron w-16 h-16" />
                  <p className="text-[11px] font-bold text-saffron uppercase tracking-[0.4em] animate-pulse">Bridging Cultures...</p>
                </div>
             </div>
           )}
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-saffron/10 rounded-xl text-saffron">
                  <Store size={18} />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-saffron">{targetLang} Translation</span>
              </div>
              {translation && !loading && (
                <button 
                  onClick={() => speakTranslation(translation, targetLang)}
                  className={`p-2 rounded-full hover:bg-saffron/10 transition-colors ${isSpeaking ? 'text-saffron animate-pulse' : 'text-gray-400'}`}
                >
                  <Volume2 size={20} />
                </button>
              )}
           </div>
           <div className="flex-grow flex items-center justify-center text-center font-heritage font-bold text-3xl text-gray-900 leading-snug animate-in slide-in-from-bottom-4">
             {translation || `Translation in ${targetLang} will illuminate here...`}
           </div>
        </div>
      </div>

      {showInputPicker && (
        <PickerModal 
          title="Choose My Language" 
          active={inputLang} 
          onSelect={setInputLang} 
          onClose={() => setShowInputPicker(false)} 
        />
      )}
      
      {showTargetPicker && (
        <PickerModal 
          title="Choose Target Language" 
          active={targetLang} 
          onSelect={setTargetLang} 
          onClose={() => setShowTargetPicker(false)} 
        />
      )}

      <div className="flex items-center justify-center gap-4 text-gray-400 text-[10px] font-bold uppercase tracking-[0.4em] pt-8 opacity-50">
        <Languages size={14} />
        Mewar-Sync Heritage Protocol v2.0
      </div>
      </div>
    </div>
  );
};
