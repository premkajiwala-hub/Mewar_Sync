import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Languages, Mic, Square, Volume2 } from 'lucide-react';
import { geminiService } from '../../services/gemini';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button, IconButton } from '../ui/Button';
import { Field, Select, Textarea } from '../ui/Form';
import { Card, PageHeader, Spinner } from '../ui/Surface';
import { cx } from '../../lib/cx';

const LANGUAGES = [
  { value: 'English', speech: 'en-IN' },
  { value: 'Hindi', speech: 'hi-IN' },
  { value: 'Marwari', speech: 'hi-IN' },
  { value: 'Mewari', speech: 'hi-IN' },
] as const;
type Lang = (typeof LANGUAGES)[number]['value'];

interface Recognition {
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const TranslatorBridge: React.FC = () => {
  const { user } = useApp();
  const [from, setFrom] = useState<Lang>('English');
  const [to, setTo] = useState<Lang>('Hindi');
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const recRef = useRef<Recognition | null>(null);
  const requestRef = useRef(0);
  const canListen = !!recognitionCtor();
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => {
    recRef.current?.abort();
    if (canSpeak) window.speechSynthesis.cancel();
  }, [canSpeak]);

  const translate = async (input = text) => {
    const q = input.trim();
    if (!q) return;
    if (from === to) {
      setResult(q);
      return;
    }
    const id = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const out = await geminiService.translateMessage(q, to);
      if (id === requestRef.current) setResult(out);
    } catch (err) {
      if (id === requestRef.current) setError(errorMessage(err, 'Translation failed. Please try again.'));
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  };

  const listen = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    setError('');
    const rec = new Ctor();
    rec.lang = LANGUAGES.find(l => l.value === from)?.speech ?? 'en-IN';
    rec.interimResults = false;
    rec.onresult = e => {
      const heard = e.results[0]?.[0]?.transcript ?? '';
      setText(heard.slice(0, 1000));
      void translate(heard);
    };
    rec.onerror = e => {
      if (e.error !== 'aborted') setError(e.error === 'not-allowed' ? 'Microphone access is blocked. Allow it in site settings, or type instead.' : 'Could not hear that clearly. Try again or type instead.');
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const speak = () => {
    if (!canSpeak || !result) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(result);
    u.lang = LANGUAGES.find(l => l.value === to)?.speech ?? 'hi-IN';
    u.rate = 0.95;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang === u.lang) ?? window.speechSynthesis.getVoices().find(v => v.lang.startsWith(u.lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    if (result) {
      setText(result);
      setResult('');
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Translator" description="AI translation — double-check anything important." />

      <Card className="p-4 sm:p-5">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="From">
            <Select value={from} onChange={e => setFrom(e.target.value as Lang)}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.value}</option>)}
            </Select>
          </Field>
          <IconButton icon={ArrowLeftRight} label="Swap languages" onClick={swap} className="mx-auto border border-line bg-surface" />
          <Field label="To">
            <Select value={to} onChange={e => setTo(e.target.value as Lang)}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.value}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col p-5">
          <Field label={`${from} text`} hint={`${text.length} / 1000`}>
            <Textarea rows={7} maxLength={1000} value={text} onChange={e => setText(e.target.value)} placeholder="Type or speak what you want to say" />
          </Field>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={Languages} onClick={() => void translate()} loading={loading} disabled={!text.trim()}>Translate</Button>
            {canListen && (
              <Button variant={listening ? 'danger' : 'secondary'} icon={listening ? Square : Mic} onClick={listen}>
                {listening ? 'Stop' : `Speak ${from}`}
              </Button>
            )}
          </div>
          {listening && (
            <p className="mt-3 flex items-center gap-2 text-sm text-danger" role="status">
              <span className="ms-wave flex h-5 items-center gap-1" aria-hidden><span /><span /><span /></span> Listening in {from}…
            </p>
          )}
        </Card>

        <Card className={cx('relative flex min-h-64 flex-col p-5', result && 'ring-1 ring-gold/30')}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-ink-soft">{to} translation</h2>
            {result && canSpeak && (
              <Button size="sm" variant="ghost" icon={Volume2} onClick={speak} aria-pressed={speaking}>{speaking ? 'Speaking…' : 'Listen'}</Button>
            )}
          </div>
          {loading && <div className="flex flex-1 items-center justify-center"><Spinner label="Translating" /></div>}
          {!loading && error && <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
          {!loading && !error && (
            <p lang={to === 'English' ? 'en' : 'hi'} aria-live="polite" className={cx('flex-1 whitespace-pre-wrap font-display text-2xl leading-relaxed', !result && 'text-base font-sans text-ink-faint')}>
              {result || 'The translation will appear here.'}
            </p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
};
