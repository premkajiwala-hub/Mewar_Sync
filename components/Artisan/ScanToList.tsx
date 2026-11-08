import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { geminiService } from '../../services/gemini';
import { storage } from '../../services/storage';
import { ApiError, errorMessage } from '../../services/api';
import { ImageValidationError, downscaleImage, validateImageFile } from '../../lib/image';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button } from '../ui/Button';
import { Card, PageHeader, Spinner } from '../ui/Surface';
import { ArchImage, OrnamentDivider } from '../ui/Ornaments';
import { useToast } from '../ui/Toast';
import { ProductFields, validateProductDraft, type ProductDraft } from './ProductEditor';
import { cx } from '../../lib/cx';

const EMPTY: ProductDraft = { title: '', description: '', price: '', style: '' };

export const ScanToList: React.FC = () => {
  const { navigate } = useApp();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<'choose' | 'analysing' | 'review'>('choose');
  const [aiNote, setAiNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickError, setPickError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    runId.current++;
    setFile(null);
    setPreview(null);
    setPhase('choose');
    setDraft(EMPTY);
    setAiNote(null);
    setErrors({});
    setPickError('');
    setAiSuggested(false);
  };

  const analyse = async (f: File) => {
    const id = ++runId.current;
    setPhase('analysing');
    setAiNote(null);
    try {
      const result = await geminiService.analyzeProduct(f);
      if (id !== runId.current) return;
      setDraft({ title: result.title, description: result.story, price: result.price ? String(result.price) : '', style: result.style });
      setAiSuggested(true);
      setAiNote({ tone: 'ok', text: 'Draft written by the AI curator. Check every detail — especially the price — before publishing.' });
      void storage.logAIInteraction('SCANNER_PRODUCT', 'image', { title: result.title, style: result.style, price: result.price ?? null });
    } catch (err) {
      if (id !== runId.current) return;
      const reason = err instanceof ApiError && err.code === 'ai_not_configured' ? 'The AI curator is not available right now.' : errorMessage(err, 'The AI curator could not analyse this photo.');
      setDraft(EMPTY);
      setAiSuggested(false);
      setAiNote({ tone: 'warn', text: `${reason} You can describe the piece yourself below.` });
    } finally {
      if (id === runId.current) setPhase('review');
    }
  };

  const choose = (f: File | undefined | null) => {
    setPickError('');
    if (!f) return;
    try {
      validateImageFile(f);
    } catch (err) {
      setPickError(err instanceof ImageValidationError ? err.message : 'That file cannot be used.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    void analyse(f);
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || publishing) return;
    const r = validateProductDraft(draft);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setErrors({});
    setPublishing(true);
    try {
      const upload = await downscaleImage(file, 2000, 0.88);
      const imageUrl = await storage.uploadImage(upload);
      await storage.createProduct({ ...r.value, image_url: imageUrl });
      toast.success('Published to your gallery', `“${r.value.title}” is now visible to visitors.`);
      reset();
      navigate('/gallery');
    } catch (err) {
      toast.error('Could not publish', errorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Scan to list"
        description="Photograph a piece and review the AI draft before publishing."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">1. Photo</h2>
          {!preview ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}
              className={cx('flex aspect-[4/5] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 text-center transition-colors', dragging ? 'border-indigo bg-indigo-soft/50' : 'border-line bg-parchment-soft/40')}
            >
              <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-gold-soft text-gold-deep"><ImagePlus className="size-7" /></span>
              <div>
                <p className="font-semibold">Add a clear photo of the piece</p>
                <p className="mt-1 text-sm text-ink-muted">Good light, plain background. JPG, PNG or WebP.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={Camera} onClick={() => inputRef.current?.click()}>Take or choose photo</Button>
              </div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label="Choose a photo of the piece" onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
              {pickError && <p role="alert" className="text-sm font-medium text-danger">{pickError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <ArchImage src={preview} alt="Selected piece" className="aspect-[4/5] w-full" />
                {phase === 'analysing' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 text-ink backdrop-blur-sm" style={{ clipPath: 'inherit' }}>
                    <Sparkles aria-hidden className="size-8 animate-pulse text-gold" />
                    <p className="text-sm font-medium">Analysing…</p>
                  </div>
                )}
              </div>
              <Button variant="secondary" icon={RotateCcw} fullWidth onClick={reset} disabled={publishing}>Use a different photo</Button>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">2. Review & publish</h2>
          {phase === 'choose' && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-ink-muted">
              <Sparkles aria-hidden className="size-8 text-gold" />
              <p className="max-w-xs text-sm">The draft appears here.</p>
            </div>
          )}
          {phase === 'analysing' && (
            <div className="flex min-h-64 items-center justify-center"><Spinner label="The AI curator is drafting a description" /></div>
          )}
          {phase === 'review' && (
            <form onSubmit={publish} noValidate className="space-y-5">
              {aiNote && (
                <div role="status" className={cx('flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm', aiNote.tone === 'ok' ? 'border-gold/40 bg-gold-soft/70 text-ink-soft' : 'border-warning/30 bg-warning-soft text-warning')}>
                  <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" /> {aiNote.text}
                </div>
              )}
              <ProductFields draft={draft} onChange={setDraft} errors={errors} aiSuggested={aiSuggested} />
              <OrnamentDivider />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {file && !aiSuggested && <Button variant="ghost" icon={Sparkles} onClick={() => file && analyse(file)} disabled={publishing}>Try AI again</Button>}
                <Button type="submit" icon={Upload} loading={publishing}>Publish to gallery</Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </PageContainer>
  );
};
