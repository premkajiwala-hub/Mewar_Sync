import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Landmark, Trash2, Upload, X } from 'lucide-react';
import type { PlacePhoto } from '../../types';
import { LOCATIONS } from '../../src/constants';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { ImageValidationError, downscaleImage, validateImageFile } from '../../lib/image';
import { formatDate } from '../../lib/dates';
import { safeImageUrl } from '../../lib/text';
import { PageContainer } from '../layout/AppShell';
import { Button, IconButton } from '../ui/Button';
import { Field, Select } from '../ui/Form';
import { ConfirmDialog } from '../ui/Modal';
import { Card, CardHeader, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { SafeImage } from '../ui/SafeImage';

const MAX_PHOTOS = 10;

export const LocationPhotoManager: React.FC = () => {
  const toast = useToast();
  const [placeId, setPlaceId] = useState(LOCATIONS[0].id);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const [pickError, setPickError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<PlacePhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const place = useMemo(() => LOCATIONS.find(l => l.id === placeId)!, [placeId]);
  const remaining = Math.max(0, MAX_PHOTOS - photos.length);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setPhotos(await storage.getPlacePhotos(placeId));
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load photos.'));
      setStatus('error');
    }
  }, [placeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => pending.forEach(p => URL.revokeObjectURL(p.url)), [pending]);

  const clearPending = () => {
    setPending([]);
    setPickError('');
  };

  const pick = (files: FileList | null) => {
    setPickError('');
    const list = Array.from(files ?? []);
    const accepted: { file: File; url: string }[] = [];
    for (const f of list) {
      try {
        validateImageFile(f);
        accepted.push({ file: f, url: URL.createObjectURL(f) });
      } catch (err) {
        setPickError(err instanceof ImageValidationError ? `${f.name}: ${err.message}` : 'Some files could not be used.');
      }
    }
    setPending(prev => [...prev, ...accepted].slice(0, remaining));
    if (pending.length + accepted.length > remaining) setPickError(`Only ${remaining} more ${remaining === 1 ? 'photo fits' : 'photos fit'} for this site (max ${MAX_PHOTOS}).`);
  };

  const upload = async () => {
    setUploading(true);
    let done = 0;
    try {
      for (const p of pending) {
        const scaled = await downscaleImage(p.file, 2000, 0.86);
        const url = await storage.uploadImage(scaled);
        await storage.addPlacePhoto(placeId, url);
        done++;
      }
      toast.success(`${done} ${done === 1 ? 'photo' : 'photos'} added to ${place.name}`);
      clearPending();
    } catch (err) {
      toast.error(done > 0 ? `Uploaded ${done}, then stopped` : 'Upload failed', errorMessage(err));
      setPending(prev => prev.slice(done));
    } finally {
      setUploading(false);
      void load();
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await storage.deletePlacePhoto(deleting.id);
      setPhotos(list => list.filter(p => p.id !== deleting.id));
      toast.success('Photo removed');
      setDeleting(null);
    } catch (err) {
      toast.error('Could not remove', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer wide>
      <PageHeader title="Place photos" />

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <Field label="Place">
            <Select value={placeId} onChange={e => { setPlaceId(e.target.value); clearPending(); }}>
              <optgroup label="Heritage sites">{LOCATIONS.filter(l => l.type === 'HERITAGE').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>
              <optgroup label="Markets">{LOCATIONS.filter(l => l.type === 'MARKET').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>
            </Select>
          </Field>
          <p className="mt-3 text-sm text-ink-muted">{photos.length} of {MAX_PHOTOS} photos used.</p>

          <div className="mt-5 space-y-3">
            {pending.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {pending.map((p, i) => (
                  <li key={p.url} className="relative">
                    <img src={p.url} alt={`New photo ${i + 1}`} className="aspect-square w-full rounded object-cover" />
                    <button type="button" aria-label={`Remove new photo ${i + 1}`} onClick={() => setPending(list => list.filter(x => x.url !== p.url))} className="absolute right-1 top-1 rounded-full bg-indigo-night/70 p-1 text-white hover:bg-indigo-night">
                      <X aria-hidden className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {remaining > pending.length && (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-parchment-soft/40 p-5 text-center hover:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-deep">
                <ImagePlus aria-hidden className="size-7 text-gold-deep" />
                <span className="text-sm font-semibold">Choose photos</span>
                <span className="text-xs text-ink-muted">JPG, PNG or WebP</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { pick(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            {pickError && <p role="alert" className="text-sm text-danger">{pickError}</p>}
            <Button fullWidth icon={Upload} loading={uploading} disabled={pending.length === 0} onClick={upload}>
              Upload {pending.length > 0 ? pending.length : ''} {pending.length === 1 ? 'photo' : 'photos'}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title={place.name} icon={Landmark} description={place.type === 'HERITAGE' ? 'Heritage site' : 'Market'} />
          {status === 'loading' && <LoadingBlock label="Loading photos" />}
          {status === 'error' && <ErrorState message={error} onRetry={load} />}
          {status === 'ready' && photos.length === 0 && <EmptyState icon={ImagePlus} title="No photos yet"  />}
          {status === 'ready' && photos.length > 0 && (
            <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-lg border border-line-soft">
                  <SafeImage src={p.image_url} alt={`${place.name} photo ${i + 1}`} className="aspect-video w-full" />
                  <div className="flex items-center justify-between px-3 py-2 text-sm text-ink-muted">
                    <span>Added {formatDate(p.uploaded_at)}</span>
                    <IconButton icon={Trash2} size="sm" tone="danger" label={`Delete photo ${i + 1}`} onClick={() => setDeleting(p)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog open={!!deleting} tone="danger" title="Delete this photo?" confirmLabel="Delete" loading={busy} onCancel={() => setDeleting(null)} onConfirm={remove} message="It will no longer appear on the visitor map." />
    </PageContainer>
  );
};
