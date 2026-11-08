import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Image as ImageIcon, KeyRound, LogOut, MapPin, Save, Sparkles, UserRound } from 'lucide-react';
import type { UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { geminiService } from '../../services/gemini';
import { errorMessage } from '../../services/api';
import { LANGUAGE_OPTIONS } from '../../services/i18n';
import { ImageValidationError, validateImageFile } from '../../lib/image';
import { safeImageUrl } from '../../lib/text';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button } from '../ui/Button';
import { Field, FormErrorSummary, Input, Select, Textarea } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { Avatar, Badge, Card, CardHeader, PageHeader } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { LocationPicker } from '../ui/LocationPicker';
import { CRAFT_CATEGORIES } from '../Auth/AuthPortal';
import { SafeImage } from '../ui/SafeImage';

type CropTarget = 'profile_picture' | 'thumbnail';
interface PixelArea { x: number; y: number; width: number; height: number }

async function cropToBlob(src: string, area: PixelArea, maxSide: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new ImageValidationError('This photo could not be read.'));
    i.src = src;
  });
  const scale = Math.min(1, maxSide / Math.max(area.width, area.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageValidationError('Your browser could not process this photo.');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.88));
  if (!blob) throw new ImageValidationError('Your browser could not process this photo.');
  return blob;
}

interface FormState {
  name: string;
  phone: string;
  preferredLanguage: string;
  category: string;
  shopAddress: string;
  description: string;
  location?: { lat: number; lng: number };
  profile_picture: string;
  thumbnail: string;
}

function fromUser(u: UserProfile): FormState {
  return {
    name: u.name || '',
    phone: u.phone || '',
    preferredLanguage: u.preferredLanguage || 'English',
    category: u.category || '',
    shopAddress: u.shopAddress || '',
    description: u.description || '',
    location: u.location,
    profile_picture: u.profile_picture || '',
    thumbnail: u.thumbnail || '',
  };
}

export const ProfileSettings: React.FC = () => {
  const { user } = useApp();
  const toast = useToast();
  const isArtisan = user.role === 'SHOPKEEPER';
  const [form, setForm] = useState<FormState>(() => fromUser(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [crop, setCrop] = useState<{ target: CropTarget; src: string } | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<PixelArea | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Keep the form in sync if the profile changes elsewhere, unless the user is editing.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setForm(fromUser(user));
  }, [user, dirty]);

  const update = (patch: Partial<FormState>) => {
    setDirty(true);
    setForm(f => ({ ...f, ...patch }));
  };

  const pickImage = (target: CropTarget, file?: File) => {
    if (!file) return;
    try {
      validateImageFile(file);
    } catch (err) {
      toast.error('Cannot use this file', err instanceof Error ? err.message : undefined);
      return;
    }
    setZoom(1);
    setCropPos({ x: 0, y: 0 });
    setCrop({ target, src: URL.createObjectURL(file) });
  };

  const closeCrop = () => {
    if (crop) URL.revokeObjectURL(crop.src);
    setCrop(null);
  };

  const onCropComplete = useCallback((_: unknown, pixels: PixelArea) => setArea(pixels), []);

  const saveCrop = async () => {
    if (!crop || !area) return;
    setUploading(true);
    try {
      const blob = await cropToBlob(crop.src, area, crop.target === 'profile_picture' ? 600 : 1600);
      const url = await storage.uploadImage(blob);
      update({ [crop.target]: url } as Partial<FormState>);
      toast.info('Photo ready', 'Save your profile to keep it.');
      closeCrop();
    } catch (err) {
      toast.error('Upload failed', errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const generateDescription = async () => {
    if (form.name.trim().length < 2 || !form.category.trim()) {
      setErrors(e => ({ ...e, description: 'Add your name and craft first.' }));
      return;
    }
    setGenerating(true);
    try {
      const text = await geminiService.generateProfileDescription(form.name.trim(), form.category.trim());
      update({ description: text });
      toast.info('Draft added', 'Edit it to sound like you before saving.');
    } catch (err) {
      toast.error('Could not write a description', errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name.';
    if (form.name.trim().length > 80) e.name = 'Keep your name under 80 characters.';
    if (!/^\d{10}$/.test(form.phone.trim())) e.phone = 'Enter a 10-digit mobile number.';
    if (isArtisan && form.category.trim().length > 60) e.category = 'Keep this under 60 characters.';
    if (form.shopAddress.length > 200) e.shopAddress = 'Keep the address under 200 characters.';
    if (form.description.length > 1500) e.description = 'Keep the description under 1,500 characters.';
    return e;
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await storage.updateProfile({
        name: form.name.replace(/\s+/g, ' ').trim(),
        phone: form.phone.trim(),
        preferredLanguage: form.preferredLanguage,
        profile_picture: form.profile_picture,
        ...(isArtisan
          ? {
              category: form.category.trim(),
              shopAddress: form.shopAddress.trim(),
              description: form.description.trim(),
              thumbnail: form.thumbnail,
              location: form.location,
            }
          : {}),
      });
      setDirty(false);
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    try {
      await storage.requestPasswordReset(user.email);
      setResetSent(true);
    } catch (err) {
      toast.error('Could not send the email', errorMessage(err));
    }
  };

  const roleLabel = isArtisan ? 'Artisan' : user.role === 'ADMIN' ? 'Administrator' : 'Visitor';

  return (
    <PageContainer>
      <PageHeader title="Settings" />

      <form onSubmit={save} noValidate className="space-y-6">
        {Object.keys(errors).length > 1 && <FormErrorSummary errors={errors} />}

        <Card>
          <CardHeader title="Profile" icon={UserRound} />
          <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <Avatar name={form.name} src={form.profile_picture} size={112} />
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-semibold hover:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-deep">
                <Camera aria-hidden className="size-4" /> Change photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { pickImage('profile_picture', e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={errors.name}>
                <Input value={form.name} maxLength={80} autoComplete="name" onChange={e => update({ name: e.target.value })} />
              </Field>
              <Field label="Mobile number" required error={errors.phone} hint={isArtisan ? 'Visitors can see this on your pieces.' : undefined}>
                <Input type="tel" inputMode="numeric" value={form.phone} onChange={e => update({ phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10) })} />
              </Field>
              <Field label="Menu language" hint="Changes navigation labels.">
                <Select value={form.preferredLanguage} onChange={e => update({ preferredLanguage: e.target.value })}>
                  {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </Select>
              </Field>
              {isArtisan && (
                <Field label="Main craft" error={errors.category}>
                  <Input list="craft-list" value={form.category} maxLength={60} onChange={e => update({ category: e.target.value })} />
                  <datalist id="craft-list">{CRAFT_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
                </Field>
              )}
            </div>
          </div>
        </Card>

        {isArtisan && (
          <Card>
            <CardHeader title="Workshop page" icon={ImageIcon} />
            <div className="space-y-5 p-5">
              <div className="grid gap-5 md:grid-cols-[240px_1fr]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink-soft">Cover image</p>
                  <div className="aspect-[3/2] overflow-hidden rounded-md border border-line bg-parchment-soft">
                    {form.thumbnail ? <SafeImage src={form.thumbnail} alt="Workshop cover" className="size-full" /> : <div className="flex size-full items-center justify-center text-ink-faint"><ImageIcon aria-hidden className="size-8" /></div>}
                  </div>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm font-semibold hover:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-deep">
                    <Camera aria-hidden className="size-4" /> Change cover
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { pickImage('thumbnail', e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                </div>
                <div className="space-y-4">
                  <Field label="Workshop address" error={errors.shopAddress}>
                    <Input value={form.shopAddress} maxLength={200} onChange={e => update({ shopAddress: e.target.value })} placeholder="e.g. Near Hathi Pol, Udaipur" />
                  </Field>
                  <Field label="Your story" error={errors.description} hint={`${form.description.length.toLocaleString('en-IN')} / 1,500`}>
                    <Textarea rows={5} value={form.description} maxLength={1500} onChange={e => update({ description: e.target.value })} placeholder="Tell visitors about your craft, your family tradition and your workshop." />
                  </Field>
                  <Button variant="ghost" size="sm" icon={Sparkles} loading={generating} onClick={generateDescription}>Draft with AI</Button>
                </div>
              </div>
              <div className="border-t border-line-soft pt-5">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><MapPin aria-hidden className="size-4 text-gold-deep" /> Workshop location</p>
                <LocationPicker initialLocation={form.location} onLocationSelect={(lat, lng) => update({ location: { lat, lng } })} />
              </div>
            </div>
          </Card>
        )}

        <div className="sticky bottom-4 z-10 flex justify-start pr-20 sm:justify-end sm:pr-24">
          <Button type="submit" icon={Save} size="lg" loading={saving} disabled={!dirty} className="shadow-raised">
            {dirty ? 'Save changes' : 'All changes saved'}
          </Button>
        </div>
      </form>

      <Card className="mt-6">
        <CardHeader title="Account" icon={KeyRound} />
        <dl className="divide-y divide-line-soft px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-sm text-ink-muted">Email</dt>
            <dd className="text-sm font-medium">{user.email}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <dt className="text-sm text-ink-muted">Account type</dt>
            <dd><Badge tone="info">{roleLabel}</Badge></dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <dt className="text-sm text-ink-muted">Password</dt>
            <dd>{resetSent ? <span role="status" className="text-sm font-medium text-success">Reset link sent to your email.</span> : <Button variant="secondary" size="sm" onClick={sendReset}>Email me a reset link</Button>}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <dt className="text-sm text-ink-muted">Session</dt>
            <dd><Button variant="ghost" size="sm" icon={LogOut} className="text-danger hover:bg-danger-soft" onClick={() => storage.logout()}>Sign out</Button></dd>
          </div>
        </dl>
      </Card>

      <Modal
        open={!!crop}
        onClose={closeCrop}
        dismissible={!uploading}
        size="lg"
        title={crop?.target === 'thumbnail' ? 'Frame your cover image' : 'Frame your photo'}
        footer={
          <>
            <Button variant="secondary" onClick={closeCrop} disabled={uploading}>Cancel</Button>
            <Button onClick={saveCrop} loading={uploading}>Use photo</Button>
          </>
        }
      >
        {crop && (
          <div className="space-y-4">
            <div className="relative h-[min(60dvh,380px)] overflow-hidden rounded-2xl bg-ink">
              <Cropper
                image={crop.src}
                crop={cropPos}
                zoom={zoom}
                aspect={crop.target === 'profile_picture' ? 1 : 3 / 2}
                cropShape={crop.target === 'profile_picture' ? 'round' : 'rect'}
                onCropChange={setCropPos}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <Field label="Zoom">
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-full accent-indigo" />
            </Field>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};
