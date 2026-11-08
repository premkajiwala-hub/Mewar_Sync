import React, { useEffect, useRef, useState } from 'react';
import { Camera, Info, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { geminiService, type AuthenticityReport } from '../../services/gemini';
import { errorMessage } from '../../services/api';
import { ImageValidationError, validateImageFile } from '../../lib/image';
import { PageContainer } from '../layout/AppShell';
import { Button } from '../ui/Button';
import { Card, PageHeader, Spinner } from '../ui/Surface';
import { cx } from '../../lib/cx';

/** Visual summary of an AI authenticity opinion (shared with the product view). */
export function AuthenticityResult({ report }: { report: AuthenticityReport }) {
  const handmade = report.isHandmade;
  const confidence = Math.max(0, Math.min(100, Math.round(report.confidence)));
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className={cx('flex size-12 shrink-0 items-center justify-center rounded-full', handmade ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
          {handmade ? <ShieldCheck className="size-6" /> : <ShieldAlert className="size-6" />}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">AI opinion</p>
          <p className={cx('font-display text-2xl font-semibold', handmade ? 'text-success' : 'text-warning')}>{handmade ? 'Looks hand-made' : 'May be machine-printed'}</p>
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-ink-muted">Confidence</span>
          <span className="ms-num font-semibold">{confidence}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-parchment" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={confidence} aria-label="Confidence">
          <div className={cx('h-full rounded-full', handmade ? 'bg-sage' : 'bg-terracotta')} style={{ width: `${confidence}%` }} />
        </div>
      </div>
      <p className="text-[15px] leading-relaxed text-ink-soft">{report.reasoning}</p>
      {report.indicators.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">What it noticed</p>
          <ul className="space-y-1.5">
            {report.indicators.map(i => (
              <li key={i} className="flex gap-2 text-sm text-ink-soft"><span aria-hidden className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold" />{i}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="flex items-start gap-2 rounded-md bg-parchment-soft/70 p-3 text-xs text-ink-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        A photo-based AI opinion, not a certificate. For valuable purchases, ask the artisan about materials and process, or consult an expert.
      </p>
    </div>
  );
}

export const AuthenticityScanner: React.FC = () => {
  const [preview, setPreview] = useState<string | null>(null);
  const [report, setReport] = useState<AuthenticityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const scan = async (file?: File) => {
    if (!file) return;
    setError('');
    setReport(null);
    try {
      validateImageFile(file);
    } catch (err) {
      setError(err instanceof ImageValidationError ? err.message : 'That file cannot be used.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    const id = ++runId.current;
    setLoading(true);
    try {
      const r = await geminiService.checkAuthenticity(file);
      if (id === runId.current) setReport(r);
    } catch (err) {
      if (id === runId.current) setError(errorMessage(err, 'The check could not be completed. Please try again.'));
    } finally {
      if (id === runId.current) setLoading(false);
    }
  };

  const reset = () => {
    runId.current++;
    setPreview(null);
    setReport(null);
    setError('');
    setLoading(false);
  };

  return (
    <PageContainer>
      <PageHeader title="Authenticity check" description="An AI opinion on whether a piece looks hand-made." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          {!preview ? (
            <div className="flex aspect-[4/5] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-line bg-parchment-soft/40 p-6 text-center">
              <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-gold-soft text-gold-deep"><Camera className="size-7" /></span>
              <div>
                <p className="font-semibold">Photograph the brushwork</p>
                <p className="mt-1 text-sm text-ink-muted">Fill the frame with fine lines and shading; avoid glare.</p>
              </div>
              <Button icon={Camera} onClick={() => inputRef.current?.click()}>Take or choose photo</Button>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label="Choose a photo to check" onChange={e => { void scan(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          ) : (
            <div className="space-y-4">
              <img src={preview} alt="Piece being checked" className="aspect-[4/5] w-full rounded-lg object-cover" />
              <Button variant="secondary" icon={RotateCcw} fullWidth onClick={reset}>Check another piece</Button>
            </div>
          )}
          {error && <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
        </Card>

        <Card className="p-5">
          {loading && <div className="flex min-h-64 items-center justify-center"><Spinner label="Examining pigments and strokes" /></div>}
          {!loading && report && <AuthenticityResult report={report} />}
          {!loading && !report && (
            <ol className="space-y-4">
              {['Photograph the piece close up in good light.', 'The AI compares stroke variation, pigment layering and print patterns.', 'Read its opinion and confidence — then ask the artisan about the process.'].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span aria-hidden className="ms-num flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-sm font-semibold text-indigo">{i + 1}</span>
                  <span className="pt-0.5 text-[15px] text-ink-soft">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </PageContainer>
  );
};
