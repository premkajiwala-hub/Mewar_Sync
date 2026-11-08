import React, { Suspense, lazy, useState } from 'react';
import { ArrowLeft, Compass, Eye, EyeOff, Store } from 'lucide-react';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { cx } from '../../lib/cx';
import { Button } from '../ui/Button';
import { Field, Input, Select, SegmentedControl } from '../ui/Form';
import { ArchMotif, Wordmark } from '../ui/Ornaments';
import { Spinner } from '../ui/Surface';

const LocationPicker = lazy(() => import('../ui/LocationPicker').then(m => ({ default: m.LocationPicker })));

type Mode = 'signin' | 'signup' | 'reset';
type Role = 'SHOPKEEPER' | 'VISITOR';

export const CRAFT_CATEGORIES = ['Pichwai', 'Miniature painting', 'Phad painting', 'Koftgari', 'Meenakari', 'Block printing', 'Bandhani', 'Blue pottery', 'Terracotta', 'Wood carving', 'Stone carving', 'Silver jewellery', 'Lac work', 'Paintings', 'Other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      trailing={
        <button type="button" onClick={() => setShow(s => !s)} className="flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-black/5 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      }
    />
  );
}

export const AuthPortal: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [role, setRole] = useState<Role>('SHOPKEEPER');
  const [step, setStep] = useState<'details' | 'location'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState(CRAFT_CATEGORIES[0]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('details');
    setErrors({});
    setFormError('');
    setNotice('');
  };

  const validateDetails = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address.';
    if (mode === 'signin') {
      if (!password) e.password = 'Enter your password.';
      return e;
    }
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (!/^\d{10}$/.test(phone.trim())) e.phone = 'Enter a 10-digit mobile number (digits only).';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) e.password = 'Use at least 8 characters with letters and numbers.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    setFormError('');
    setNotice('');

    if (mode === 'reset') {
      if (!EMAIL_RE.test(email.trim())) {
        setErrors({ email: 'Enter a valid email address.' });
        return;
      }
      setErrors({});
      setBusy(true);
      try {
        await storage.requestPasswordReset(email);
        setNotice('If an account exists for this email, a password reset link is on its way.');
      } catch (err) {
        setFormError(errorMessage(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    const e = validateDetails();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (mode === 'signup' && role === 'SHOPKEEPER' && step === 'details') {
      setStep('location');
      return;
    }
    if (mode === 'signup' && role === 'SHOPKEEPER' && !location) {
      setFormError('Tap the map to pin your workshop.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await storage.signIn(email, password);
      } else {
        await storage.signUp({
          email,
          password,
          name,
          phone: phone.trim(),
          role,
          category: role === 'SHOPKEEPER' ? category : undefined,
          location: role === 'SHOPKEEPER' && location ? location : undefined,
        });
      }
    } catch (err) {
      setFormError(errorMessage(err, 'Could not complete the request. Please try again.'));
      setBusy(false);
    }
  };

  const title = mode === 'signin' ? 'Sign in' : mode === 'reset' ? 'Reset password' : step === 'location' ? 'Workshop location' : 'Create account';
  const wide = step === 'location';

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Understated Udaipur detail: a large, faint jharokha arch behind the card. */}
      <ArchMotif className="pointer-events-none absolute left-1/2 top-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 text-gold/[0.13]" />

      <div className={cx('relative w-full animate-rise-in', wide ? 'max-w-lg' : 'max-w-[400px]')}>
        <div className="mb-7 flex justify-center">
          <Wordmark />
        </div>

        <div className="ms-glass rounded-[22px] p-6 sm:p-8">
          {mode !== 'reset' && step === 'details' && (
            <SegmentedControl
              label="Account action"
              value={mode as 'signin' | 'signup'}
              onChange={m => switchMode(m)}
              options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]}
              className="mb-6 w-full"
            />
          )}

          {(mode === 'reset' || step === 'location') && (
            <button type="button" onClick={() => (mode === 'reset' ? switchMode('signin') : setStep('details'))} className="-ml-1 mb-4 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-medium text-indigo transition-colors hover:bg-indigo/5">
              <ArrowLeft aria-hidden className="size-4" /> Back
            </button>
          )}

          <h1 className="mb-5 text-[22px] font-semibold">{title}</h1>

          <form onSubmit={submit} noValidate className="space-y-4">
            {formError && <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{formError}</div>}
            {notice && <div role="status" className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success">{notice}</div>}

            {mode === 'signup' && step === 'details' && (
              <fieldset>
                <legend className="sr-only">Account type</legend>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { value: 'SHOPKEEPER', label: 'Artisan', icon: Store },
                    { value: 'VISITOR', label: 'Visitor', icon: Compass },
                  ] as const).map(opt => (
                    <label
                      key={opt.value}
                      className={cx(
                        'flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-indigo/15',
                        role === opt.value ? 'border-indigo/50 bg-indigo/[0.06] text-indigo' : 'border-black/10 bg-white/60 text-ink-soft hover:border-black/20'
                      )}
                    >
                      <input type="radio" name="role" value={opt.value} checked={role === opt.value} onChange={() => setRole(opt.value)} className="sr-only" />
                      <opt.icon aria-hidden className="size-4" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {step === 'details' && (
              <>
                {mode === 'signup' && (
                  <Field label="Full name" required error={errors.name}>
                    <Input autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
                  </Field>
                )}
                <Field label="Email" required error={errors.email}>
                  <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} />
                </Field>
                {mode !== 'reset' && (
                  <Field label="Password" required error={errors.password} hint={mode === 'signup' ? '8+ characters, letters and numbers.' : undefined}>
                    <PasswordInput autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} maxLength={128} />
                  </Field>
                )}
                {mode === 'signup' && (
                  <>
                    <Field label="Confirm password" required error={errors.confirm}>
                      <PasswordInput autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={128} />
                    </Field>
                    <Field label="Mobile number" required error={errors.phone}>
                      <Input type="tel" autoComplete="tel-national" inputMode="numeric" placeholder="10 digits" value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))} />
                    </Field>
                    {role === 'SHOPKEEPER' && (
                      <Field label="Main craft">
                        <Select value={category} onChange={e => setCategory(e.target.value)}>
                          {CRAFT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                      </Field>
                    )}
                  </>
                )}
              </>
            )}

            {step === 'location' && (
              <Suspense fallback={<div className="flex h-64 items-center justify-center"><Spinner label="Loading map" /></div>}>
                <LocationPicker initialLocation={location ?? undefined} onLocationSelect={(lat, lng) => setLocation({ lat, lng })} />
              </Suspense>
            )}

            <Button type="submit" fullWidth size="lg" loading={busy} className="mt-2">
              {mode === 'signin' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : role === 'SHOPKEEPER' && step === 'details' ? 'Continue' : 'Create account'}
            </Button>

            {mode === 'signin' && (
              <p className="text-center">
                <button type="button" onClick={() => switchMode('reset')} className="rounded-lg px-1 text-sm font-medium text-indigo transition-colors hover:text-indigo-deep hover:underline">
                  Forgot password?
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
