import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Loader2, Mic, MicOff, Send, Square, X } from 'lucide-react';
import { geminiService } from '../../services/gemini';
import { ApiError, errorMessage } from '../../services/api';
import { buildVoiceDraft, MAX_TRANSCRIPT_LENGTH, type VoiceDraft } from '../../lib/voice';
import { cx } from '../../lib/cx';
import { useApp } from '../layout/AppContext';
import { Button, IconButton } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { LedgerEntryForm } from '../Artisan/LedgerEntryForm';
import { InventoryForm } from '../Artisan/InventoryForm';
import { VOICE_EVENT } from '../../lib/events';

type Phase = 'closed' | 'ready' | 'listening' | 'processing' | 'error';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGS = [
  { value: 'hi-IN', label: 'Hindi / Mewari' },
  { value: 'en-IN', label: 'English (India)' },
];

const EXAMPLES = ['2 pichwai bechi 6000 rupaye mein', 'Bought 10 pigment boxes for 300', 'Rajesh ko 500 diye udhaar'];

const MIC_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings, or type your entry instead.',
  'service-not-allowed': 'Voice recognition is turned off in this browser. Type your entry instead.',
  'audio-capture': 'No microphone was found. Check that one is connected, or type your entry instead.',
  network: 'Voice recognition needs an internet connection. Check your connection or type instead.',
  'no-speech': 'I didn’t hear anything. Tap the microphone and speak clearly, close to the phone.',
};

export function VoiceAssistant() {
  const { notifyDataChanged } = useApp();
  const toast = useToast();
  const supported = typeof window !== 'undefined' && !!getRecognitionCtor();
  const [phase, setPhase] = useState<Phase>('closed');
  const [lang, setLang] = useState('hi-IN');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(!supported);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const sessionRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const stopRecognition = () => {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null;
  };

  const close = useCallback(() => {
    sessionRef.current++;
    stopRecognition();
    setPhase('closed');
    setTranscript('');
    setMessage('');
    fabRef.current?.focus();
  }, []);

  const interpret = useCallback(async (text: string) => {
    const clean = text.trim().slice(0, MAX_TRANSCRIPT_LENGTH);
    if (!clean) {
      setPhase('error');
      setMessage(MIC_ERRORS['no-speech']);
      return;
    }
    const session = ++sessionRef.current;
    setTranscript(clean);
    setPhase('processing');
    try {
      const action = await geminiService.parseLedgerVoice(clean);
      if (session !== sessionRef.current) return;
      const built = buildVoiceDraft(action);
      if (!built) {
        setPhase('error');
        setMessage('I couldn’t find a sale, purchase, expense or payment in that. Try again, mentioning the item and amount.');
        return;
      }
      setDraft(built);
      setPhase('closed');
      setTranscript('');
      setTyped('');
    } catch (err) {
      if (session !== sessionRef.current) return;
      setPhase('error');
      setMessage(err instanceof ApiError && err.code === 'ai_not_configured'
        ? 'Voice understanding isn’t available right now. Use “New entry” to record it by hand.'
        : errorMessage(err, 'Could not understand the entry. Please try again.'));
    }
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setTyping(true);
      setPhase('ready');
      return;
    }
    stopRecognition();
    finalRef.current = '';
    setTranscript('');
    setMessage('');
    const session = ++sessionRef.current;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => session === sessionRef.current && setPhase('listening');
    rec.onresult = e => {
      if (session !== sessionRef.current) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript((finalRef.current + interim).slice(0, MAX_TRANSCRIPT_LENGTH));
    };
    rec.onerror = e => {
      if (session !== sessionRef.current || e.error === 'aborted') return;
      sessionRef.current++;
      setPhase('error');
      setMessage(MIC_ERRORS[e.error] ?? 'Voice recognition stopped unexpectedly. Try again or type instead.');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') setTyping(true);
    };
    rec.onend = () => {
      if (session !== sessionRef.current) return;
      recognitionRef.current = null;
      // Only interpret once, when the recogniser has finished.
      void interpret(finalRef.current);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setPhase('error');
      setMessage('Could not start the microphone. Try again.');
    }
  }, [interpret, lang]);

  const open = useCallback(() => {
    setPhase('ready');
    setMessage('');
  }, []);

  useEffect(() => {
    const onEvent = () => open();
    window.addEventListener(VOICE_EVENT, onEvent);
    return () => window.removeEventListener(VOICE_EVENT, onEvent);
  }, [open]);

  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !draft && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, close, draft]);

  useEffect(() => {
    if (phase === 'ready') panelRef.current?.querySelector<HTMLElement>('button, textarea')?.focus();
  }, [phase]);

  useEffect(() => () => stopRecognition(), []);

  const panelOpen = phase !== 'closed';

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => (panelOpen ? close() : open())}
        aria-expanded={panelOpen}
        aria-label={panelOpen ? 'Close voice entry' : 'Speak an entry'}
        className={cx(
          'fixed bottom-5 right-4 z-[700] flex size-16 items-center justify-center rounded-full shadow-raised ring-4 ring-surface transition-transform active:scale-95 sm:right-6',
          phase === 'listening' ? 'bg-danger text-white' : 'bg-maroon text-ivory hover:bg-maroon-deep'
        )}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {panelOpen ? <X aria-hidden className="size-6" /> : <Mic aria-hidden className="size-7" />}
      </button>

      {panelOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Voice entry"
          className="ms-glass-strong fixed inset-x-3 bottom-24 z-[700] animate-rise-in overflow-hidden rounded-2xl sm:inset-x-auto sm:right-6 sm:w-[380px]"
        >
          <div aria-hidden className="ms-band" />
          <div className="flex items-start justify-between gap-2 px-5 pb-2 pt-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Speak an entry</h2>
              <p className="text-sm text-ink-muted">You’ll review it before anything is saved.</p>
            </div>
            <IconButton icon={X} size="sm" label="Close" onClick={close} />
          </div>

          <div className="space-y-4 px-5 pb-5 pt-2">
            {phase === 'listening' && (
              <div className="flex flex-col items-center gap-3 py-2" aria-live="polite">
                <div className="ms-wave flex h-8 items-center gap-1.5 text-danger" aria-hidden>
                  <span /><span /><span /><span /><span />
                </div>
                <p className="text-sm font-semibold text-danger">Listening…</p>
                <p className="min-h-12 w-full rounded-md bg-parchment-soft/70 px-3 py-2 text-center text-[15px] italic text-ink">{transcript || 'Speak now'}</p>
                <Button variant="danger" icon={Square} onClick={() => recognitionRef.current?.stop()}>Done</Button>
              </div>
            )}

            {phase === 'processing' && (
              <div className="flex flex-col items-center gap-3 py-4" role="status">
                <Loader2 aria-hidden className="size-7 animate-spin text-gold-deep" />
                <p className="text-sm font-semibold">Understanding your entry…</p>
                <p className="w-full rounded-md bg-parchment-soft/70 px-3 py-2 text-center text-[15px] italic">“{transcript}”</p>
              </div>
            )}

            {(phase === 'ready' || phase === 'error') && (
              <>
                {phase === 'error' && (
                  <div role="alert" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">
                    <MicOff aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}
                {phase === 'error' && transcript && <p className="text-sm text-ink-muted">Heard: <span className="italic text-ink">“{transcript}”</span></p>}

                {!typing && supported && (
                  <>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-ink-soft">Language</span>
                      <select value={lang} onChange={e => setLang(e.target.value)} className="h-9 rounded-md border border-line bg-surface px-2 text-sm">
                        {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </label>
                    <Button size="lg" variant="accent" icon={Mic} fullWidth onClick={startListening}>{phase === 'error' ? 'Try again' : 'Start speaking'}</Button>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">Try saying</p>
                      <ul className="space-y-1 text-sm italic text-ink-soft">
                        {EXAMPLES.map(ex => <li key={ex}>“{ex}”</li>)}
                      </ul>
                    </div>
                  </>
                )}

                {typing && (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      void interpret(typed);
                    }}
                    className="space-y-2"
                  >
                    {!supported && <p className="text-sm text-ink-muted">Voice input isn’t supported in this browser — type the entry the way you would say it.</p>}
                    <label htmlFor="voice-typed" className="text-sm font-medium text-ink-soft">Describe the entry</label>
                    <textarea
                      id="voice-typed"
                      rows={3}
                      maxLength={MAX_TRANSCRIPT_LENGTH}
                      value={typed}
                      onChange={e => setTyped(e.target.value)}
                      placeholder={EXAMPLES[0]}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
                    />
                    <Button type="submit" icon={Send} fullWidth disabled={!typed.trim()}>Understand entry</Button>
                  </form>
                )}

                {supported && (
                  <button type="button" onClick={() => setTyping(t => !t)} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-indigo hover:underline">
                    {typing ? <><Mic aria-hidden className="size-4" /> Use the microphone</> : <><Keyboard aria-hidden className="size-4" /> Type instead</>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {draft?.kind === 'ledger' && (
        <LedgerEntryForm
          open
          voiceDraft={draft}
          onClose={() => setDraft(null)}
          onSaved={msg => {
            setDraft(null);
            toast.success(msg);
            notifyDataChanged();
          }}
        />
      )}
      {draft?.kind === 'stock' && (
        <InventoryForm
          open
          prefill={{ item: draft.item, quantity: draft.quantity, unitCost: draft.unitPrice, isPurchased: draft.isPurchased, transcript: draft.transcript }}
          onClose={() => setDraft(null)}
          onSaved={msg => {
            setDraft(null);
            toast.success(msg);
            notifyDataChanged();
          }}
        />
      )}
    </>
  );
}
