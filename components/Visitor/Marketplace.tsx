import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ArrowLeft, Clock, Landmark, MapPin, MessageSquare, Minus, Navigation, Pause, Play, Plus, ShoppingBag, Sparkles, Store, Ticket, Users,
} from 'lucide-react';
import type { MapLocation, PlacePhoto, UserProfile } from '../../types';
import { LOCATIONS } from '../../src/constants';
import { storage } from '../../services/storage';
import { geminiService, type HeritageInfo } from '../../services/gemini';
import { errorMessage } from '../../services/api';
import { decode } from '../../utils/audioUtils';
import { useApp } from '../layout/AppContext';
import { Button, IconButton } from '../ui/Button';
import { SegmentedControl } from '../ui/Form';
import { Avatar, Badge, Card, Spinner } from '../ui/Surface';
import { OrnamentDivider } from '../ui/Ornaments';
import { useToast } from '../ui/Toast';
import { formatINR } from '../../lib/money';
import { safeImageUrl, stripMarkdownEmphasis } from '../../lib/text';
import { cx } from '../../lib/cx';
import { directionsUrl } from './ArtisanProfile';
import { SafeImage } from '../ui/SafeImage';

type Filter = 'ALL' | 'HERITAGE' | 'MARKET' | 'ARTISAN';
type Selection = { kind: 'place'; place: MapLocation } | { kind: 'artisan'; artisan: UserProfile } | null;

const UDAIPUR_CENTER: [number, number] = [24.5764, 73.6835];

function pinIcon(kind: 'HERITAGE' | 'MARKET' | 'ARTISAN', active: boolean) {
  const colors = { HERITAGE: '#243b64', MARKET: '#b86f4b', ARTISAN: '#762f35' };
  const glyphs = {
    HERITAGE: '<path d="M4 20h16M6 20V10m4 10V10m4 10V10m4 10V10M3 10l9-6 9 6z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>',
    MARKET: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>',
    ARTISAN: '<path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.5-4 6-.6z" fill="#e2c78f"/>',
  };
  const size = active ? 40 : 32;
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colors[kind]};border:2px solid #fffdf8;box-shadow:0 4px 10px rgba(18,31,54,.35);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="${size * 0.55}" height="${size * 0.55}" style="transform:rotate(45deg)">${glyphs[kind]}</svg></div>`,
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [target, map]);
  return null;
}

function openStatus(timings?: { open: string; close: string }): { open: boolean; label: string } | null {
  if (!timings || !/^\d{2}:\d{2}$/.test(timings.open) || !/^\d{2}:\d{2}$/.test(timings.close)) return null;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = timings.open.split(':').map(Number);
  const [ch, cm] = timings.close.split(':').map(Number);
  const open = mins >= oh * 60 + om && mins < ch * 60 + cm;
  return { open, label: open ? `Open now · closes ${timings.close}` : `Closed · opens ${timings.open}` };
}

function feeLabel(n?: number) {
  return !n ? 'Free' : formatINR(n);
}

function Stepper({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line bg-surface px-2 py-1.5">
      <span className="px-1 text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <IconButton icon={Minus} size="sm" label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} />
        <span className="ms-num w-6 text-center font-semibold" aria-live="polite">{value}</span>
        <IconButton icon={Plus} size="sm" label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(30, value + 1))} disabled={value >= 30} />
      </div>
    </div>
  );
}

function PlaceDetails({ place, onBack }: { place: MapLocation; onBack: () => void }) {
  const toast = useToast();
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [ai, setAi] = useState<HeritageInfo | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [foreigner, setForeigner] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audioRef = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode } | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.source.stop();
      } catch {
        /* already stopped */
      }
      void audioRef.current.ctx.close();
      audioRef.current = null;
    }
    setAudioState('idle');
  }, []);

  useEffect(() => {
    setPhotoIndex(0);
    setChosen([]);
    setAi(null);
    setAiState('idle');
    let cancelled = false;
    storage.getPlacePhotos(place.id).then(p => !cancelled && setPhotos(p)).catch(() => !cancelled && setPhotos([]));
    return () => {
      cancelled = true;
      stopAudio();
    };
  }, [place.id, stopAudio]);

  const images = photos.length > 0 ? photos.map(p => p.image_url) : place.image_url ? [place.image_url] : [];
  const status = openStatus(place.timings);
  const activities = useMemo(() => {
    const base = place.activity_costs ?? [];
    const extra = (ai?.activities ?? []).filter(a => !base.some(b => b.name.toLowerCase() === a.name.toLowerCase()));
    return [...base.map(a => ({ ...a, ai: false })), ...extra.map(a => ({ ...a, ai: true }))];
  }, [place, ai]);

  const adultFee = foreigner ? place.entry_fee_foreigner ?? 0 : place.entry_fee_indian ?? 0;
  const childFee = foreigner ? place.entry_fee_foreigner_child ?? place.entry_fee_foreigner ?? 0 : place.entry_fee_indian_child ?? place.entry_fee_indian ?? 0;
  const activityPerPerson = activities.filter(a => chosen.includes(a.name)).reduce((s, a) => s + (a.cost || 0), 0);
  const total = adults * adultFee + children * childFee + (adults + children) * activityPerPerson;

  const loadAi = async () => {
    setAiState('loading');
    try {
      setAi(await geminiService.getHeritageActivities(place.name));
      setAiState('idle');
    } catch (err) {
      setAiState('error');
      toast.error('Could not fetch suggestions', errorMessage(err));
    }
  };

  const playGuide = async () => {
    if (audioState === 'playing') {
      stopAudio();
      return;
    }
    setAudioState('loading');
    try {
      const base64 = await geminiService.generateHeritageAudio(place.description, 'English');
      if (!base64) throw new Error('The audio guide is not available right now.');
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 24000 });
      const bytes = decode(base64);
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      const buffer = ctx.createBuffer(1, pcm.length, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => stopAudio();
      source.start();
      audioRef.current = { ctx, source };
      setAudioState('playing');
    } catch (err) {
      setAudioState('idle');
      toast.error('Audio guide unavailable', errorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>All places</Button>
      {images.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-parchment-soft">
          <SafeImage src={images[photoIndex]} alt={`${place.name}, photo ${photoIndex + 1} of ${images.length}`} className="aspect-[16/10] w-full" loading="eager" />
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === photoIndex} onClick={() => setPhotoIndex(i)} className={cx('h-2 rounded-full transition-all', i === photoIndex ? 'w-6 bg-gold' : 'w-2 bg-white/70')} />
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge tone={place.type === 'HERITAGE' ? 'info' : 'terracotta'} icon={place.type === 'HERITAGE' ? Landmark : Store}>{place.type === 'HERITAGE' ? 'Heritage site' : 'Market'}</Badge>
          {status && <Badge tone={status.open ? 'success' : 'neutral'} icon={Clock}>{status.label}</Badge>}
        </div>
        <h2 className="text-3xl font-semibold leading-tight">{place.name}</h2>
        {place.timings?.note && <p className="mt-1 text-sm text-ink-muted">{place.timings.note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={directionsUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo px-4 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#2c4877]">
          <Navigation aria-hidden className="size-4" /> Directions
        </a>
        <Button variant="secondary" icon={audioState === 'playing' ? Pause : Play} loading={audioState === 'loading'} onClick={playGuide}>
          {audioState === 'playing' ? 'Stop audio guide' : 'Audio guide'}
        </Button>
      </div>
      <p className="text-[15px] leading-relaxed text-ink-soft">{place.description}</p>

      {place.must_do && (
        <div className="rounded-lg border border-gold/40 bg-gold-soft/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-deep">Don’t miss</p>
          <p className="mt-1 font-display text-lg">{place.must_do}</p>
        </div>
      )}

      {place.mewari_bol && place.mewari_bol.length > 0 && (
        <div>
          <h3 className="mb-2 font-sans text-sm font-semibold">Useful Mewari phrases</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {place.mewari_bol.map(b => (
              <li key={b.phrase} className="rounded-md border border-line-soft bg-surface px-3 py-2">
                <p className="font-semibold">“{b.phrase}”</p>
                <p className="text-xs text-ink-muted">{b.meaning}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <OrnamentDivider />

      {place.type === 'HERITAGE' ? (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 font-sans text-base font-semibold"><Ticket aria-hidden className="size-4 text-gold-deep" /> Tickets</h3>
          <table className="w-full overflow-hidden rounded-md border border-line-soft text-sm">
            <caption className="sr-only">Entry fees for {place.name}</caption>
            <thead className="bg-parchment-soft/60 text-xs uppercase tracking-wider text-ink-muted">
              <tr><th scope="col" className="px-3 py-2 text-left">Visitor</th><th scope="col" className="px-3 py-2 text-right">Adult</th><th scope="col" className="px-3 py-2 text-right">Child</th></tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              <tr><th scope="row" className="px-3 py-2 text-left font-medium">Indian</th><td className="ms-num px-3 py-2 text-right">{feeLabel(place.entry_fee_indian)}</td><td className="ms-num px-3 py-2 text-right">{feeLabel(place.entry_fee_indian_child ?? place.entry_fee_indian)}</td></tr>
              <tr><th scope="row" className="px-3 py-2 text-left font-medium">Foreign</th><td className="ms-num px-3 py-2 text-right">{feeLabel(place.entry_fee_foreigner)}</td><td className="ms-num px-3 py-2 text-right">{feeLabel(place.entry_fee_foreigner_child ?? place.entry_fee_foreigner)}</td></tr>
            </tbody>
          </table>
          {(place.camera_fee || place.video_fee) && (
            <p className="text-sm text-ink-muted">{place.camera_fee ? `Camera ${formatINR(place.camera_fee)}` : ''}{place.camera_fee && place.video_fee ? ' · ' : ''}{place.video_fee ? `Video ${formatINR(place.video_fee)}` : ''}</p>
          )}
          <p className="text-xs text-ink-muted">Fees change; confirm at the ticket counter.</p>
        </div>
      ) : (
        place.shopping_guide && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-sans text-base font-semibold"><ShoppingBag aria-hidden className="size-4 text-gold-deep" /> Shopping guide</h3>
            <p className="text-sm"><span className="text-ink-muted">Known for: </span><span className="font-semibold">{place.shopping_guide.local_specialty}</span></p>
            <div className="flex flex-wrap gap-1.5">{place.shopping_guide.best_buys.map(b => <Badge key={b} tone="gold">{b}</Badge>)}</div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">{place.shopping_guide.bargaining_tips.map(t => <li key={t}>{t}</li>)}</ol>
          </div>
        )
      )}

      {activities.length > 0 && (
        <div className="space-y-3 rounded-lg border border-line-soft bg-parchment-soft/40 p-4">
          <h3 className="font-sans text-base font-semibold">Plan your visit</h3>
          {place.type === 'HERITAGE' && (
            <SegmentedControl label="Nationality" size="sm" value={foreigner ? 'F' : 'I'} onChange={v => setForeigner(v === 'F')} options={[{ value: 'I', label: 'Indian' }, { value: 'F', label: 'Foreign' }]} />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Stepper label="Adults" value={adults} min={1} onChange={setAdults} />
            <Stepper label="Children" value={children} min={0} onChange={setChildren} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-soft">Experiences (per person)</legend>
            <ul className="space-y-1.5">
              {activities.map(a => (
                <li key={a.name}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-soft bg-surface px-3 py-2 hover:border-gold">
                    <input type="checkbox" className="mt-0.5 size-4 accent-indigo" checked={chosen.includes(a.name)} onChange={e => setChosen(c => (e.target.checked ? [...c, a.name] : c.filter(n => n !== a.name)))} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{a.name}</span>
                      {a.ai && <Badge tone="info" className="ml-1.5">AI suggestion</Badge>}
                      {a.note && <span className="block text-xs text-ink-muted">{a.note}</span>}
                    </span>
                    <span className="ms-num text-sm font-semibold">{feeLabel(a.cost)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="flex items-center justify-between border-t border-dashed border-line pt-3">
            <span className="text-sm text-ink-muted">Estimated total</span>
            <span className="ms-num font-display text-2xl font-semibold" aria-live="polite">{formatINR(total)}</span>
          </div>
        </div>
      )}

      {place.type === 'HERITAGE' && (
        <div className="rounded-lg border border-indigo/15 bg-indigo-soft/40 p-4">
          {!ai && aiState !== 'loading' && (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">Find current activities and timings from the web.</p>
              <Button variant="secondary" size="sm" icon={Sparkles} onClick={loadAi}>{aiState === 'error' ? 'Try again' : 'Get AI suggestions'}</Button>
            </div>
          )}
          {aiState === 'loading' && <Spinner label="Searching for current information" />}
          {ai && (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo"><Sparkles aria-hidden className="size-3.5" /> AI-suggested · verify locally</p>
              {ai.description && <p className="font-display text-base">{stripMarkdownEmphasis(ai.description)}</p>}
              {ai.must_do && <p><span className="font-semibold">Must do:</span> {stripMarkdownEmphasis(ai.must_do)}</p>}
              {(ai.timings?.open || ai.timings?.close) && <p><span className="font-semibold">Timings:</span> {ai.timings?.open} – {ai.timings?.close}{ai.timings?.timing_note ? ` (${ai.timings.timing_note})` : ''}</p>}
              {activities.some(a => a.ai) && <p className="text-ink-muted">New activities were added to the planner above.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtisanSummary({ artisan, onBack }: { artisan: UserProfile; onBack: () => void }) {
  const { navigate, openMessenger, user } = useApp();
  const cover = safeImageUrl(artisan.thumbnail);
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>All places</Button>
      {cover && <SafeImage src={cover} alt="" className="aspect-[16/10] w-full rounded-lg" />}
      <div className="flex items-center gap-3">
        <Avatar name={artisan.name} src={artisan.profile_picture} size={56} />
        <div>
          <h2 className="text-2xl font-semibold leading-tight">{artisan.name}</h2>
          {artisan.category && <Badge tone="gold">{artisan.category}</Badge>}
        </div>
      </div>
      <p className="line-clamp-6 text-[15px] leading-relaxed text-ink-soft">{stripMarkdownEmphasis(artisan.description || 'Traditional workshop in Udaipur.')}</p>
      <div className="flex flex-wrap gap-2">
        <Button icon={Users} onClick={() => navigate(`/artisans/${artisan.id}`)}>View workshop</Button>
        {user.role === 'VISITOR' && <Button variant="secondary" icon={MessageSquare} onClick={() => openMessenger(artisan)}>Message</Button>}
        {artisan.location && (
          <a href={directionsUrl(artisan.location.lat, artisan.location.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold hover:border-gold">
            <Navigation aria-hidden className="size-4" /> Directions
          </a>
        )}
      </div>
    </div>
  );
}

export const Marketplace: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [artisans, setArtisans] = useState<UserProfile[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    storage.getArtisans().then(list => setArtisans(list.filter(a => a.location && Number.isFinite(a.location.lat) && Number.isFinite(a.location.lng)))).catch(() => setArtisans([]));
  }, []);

  const places = LOCATIONS.filter(l => filter === 'ALL' || filter === l.type);
  const showArtisans = filter === 'ALL' || filter === 'ARTISAN';

  const select = (s: Selection) => {
    setSelection(s);
    if (s?.kind === 'place') setFlyTarget([s.place.lat, s.place.lng]);
    if (s?.kind === 'artisan' && s.artisan.location) setFlyTarget([s.artisan.location.lat, s.artisan.location.lng]);
    panelRef.current?.scrollTo({ top: 0 });
    if (window.matchMedia('(max-width: 1023px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-70px)] lg:flex-row">
      <div className="relative h-[46dvh] shrink-0 lg:h-auto lg:flex-1">
        <div className="absolute left-3 right-3 top-3 z-[400] flex justify-center lg:justify-start">
          <div className="ms-glass-strong ms-no-scrollbar overflow-x-auto rounded-xl">
            <SegmentedControl
              label="Show on map"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[{ value: 'ALL', label: 'All' }, { value: 'HERITAGE', label: 'Heritage', icon: Landmark }, { value: 'MARKET', label: 'Markets', icon: Store }, { value: 'ARTISAN', label: 'Artisans', icon: Users }]}
            />
          </div>
        </div>
        <MapContainer center={UDAIPUR_CENTER} zoom={14} className="size-full" zoomControl>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          {places.map(p => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={pinIcon(p.type, selection?.kind === 'place' && selection.place.id === p.id)}
              title={p.name}
              alt={p.name}
              keyboard
              eventHandlers={{ click: () => select({ kind: 'place', place: p }) }}
            />
          ))}
          {showArtisans && artisans.map(a => (
            <Marker
              key={a.id}
              position={[a.location!.lat, a.location!.lng]}
              icon={pinIcon('ARTISAN', selection?.kind === 'artisan' && selection.artisan.id === a.id)}
              title={`${a.name} (artisan)`}
              alt={`${a.name} (artisan)`}
              keyboard
              eventHandlers={{ click: () => select({ kind: 'artisan', artisan: a }) }}
            />
          ))}
          <FlyTo target={flyTarget} />
        </MapContainer>
      </div>

      <aside ref={panelRef} aria-label="Place details" className="ms-glass ms-scroll-thin !rounded-none !border-x-0 !border-b-0 lg:w-[440px] lg:overflow-y-auto lg:!border-l lg:!border-t-0">
        <div className="p-5 pb-28">
          {selection?.kind === 'place' && <PlaceDetails place={selection.place} onBack={() => setSelection(null)} />}
          {selection?.kind === 'artisan' && <ArtisanSummary artisan={selection.artisan} onBack={() => setSelection(null)} />}
          {!selection && (
            <>
              <h1 className="text-[28px] font-semibold">Explore Udaipur</h1>
              <div aria-hidden className="ms-hairline my-5" />
              <ul className="space-y-2">
                {places.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => select({ kind: 'place', place: p })} className="flex w-full items-center gap-3 rounded-md border border-line-soft bg-surface p-2.5 text-left hover:border-gold">
                      <SafeImage src={p.image_url} alt="" className="size-14 shrink-0 rounded" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                          {p.type === 'HERITAGE' ? <Landmark aria-hidden className="size-3" /> : <Store aria-hidden className="size-3" />}
                          {p.type === 'HERITAGE' ? 'Heritage site' : 'Market'}
                          {openStatus(p.timings) && <> · {openStatus(p.timings)!.open ? 'Open now' : 'Closed now'}</>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {showArtisans && artisans.map(a => (
                  <li key={a.id}>
                    <button type="button" onClick={() => select({ kind: 'artisan', artisan: a })} className="flex w-full items-center gap-3 rounded-md border border-line-soft bg-surface p-2.5 text-left hover:border-gold">
                      <Avatar name={a.name} src={a.profile_picture} size={56} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{a.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted"><MapPin aria-hidden className="size-3" /> Artisan · {a.category || 'Workshop'}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
