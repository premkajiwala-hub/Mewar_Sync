import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Heart, Image as ImageIcon, MapPin, MessageSquare, Navigation, Phone } from 'lucide-react';
import type { ArtisanProduct, UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Button } from '../ui/Button';
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingBlock } from '../ui/Surface';
import { ArchImage, OrnamentDivider } from '../ui/Ornaments';
import { useToast } from '../ui/Toast';
import { ProductDetail } from './ProductDetail';
import { safeImageUrl, stripMarkdownEmphasis } from '../../lib/text';
import { cx } from '../../lib/cx';
import { SafeImage } from '../ui/SafeImage';

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export const ArtisanProfile: React.FC<{ artisanId: string }> = ({ artisanId }) => {
  const { user, navigate, openMessenger } = useApp();
  const toast = useToast();
  const [artisan, setArtisan] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<ArtisanProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ArtisanProduct | null>(null);
  const [liking, setLiking] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [profile, items] = await Promise.all([storage.getProfile(artisanId), storage.getProductsByShop(artisanId)]);
      if (!profile || profile.role !== 'SHOPKEEPER') {
        setStatus('missing');
        return;
      }
      setArtisan(profile);
      setProducts(items);
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this artisan.'));
      setStatus('error');
    }
  }, [artisanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const liked = !!artisan?.likes?.includes(user.id);
  const toggleLike = async () => {
    if (!artisan || liking) return;
    setLiking(true);
    const next = !liked;
    setArtisan(a => a && { ...a, likes: next ? [...(a.likes ?? []), user.id] : (a.likes ?? []).filter(id => id !== user.id) });
    try {
      await storage.toggleArtisanLike(artisan.id, next);
    } catch (err) {
      setArtisan(a => a && { ...a, likes: !next ? [...(a.likes ?? []), user.id] : (a.likes ?? []).filter(id => id !== user.id) });
      toast.error('Could not update', errorMessage(err));
    } finally {
      setLiking(false);
    }
  };

  const back = (
    <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/artisans')} className="mb-4">All artisans</Button>
  );

  if (status === 'loading') return <PageContainer wide>{back}<Card><LoadingBlock label="Loading artisan" rows={5} /></Card></PageContainer>;
  if (status === 'error') return <PageContainer wide>{back}<Card><ErrorState message={error} onRetry={load} /></Card></PageContainer>;
  if (status === 'missing' || !artisan) {
    return <PageContainer wide>{back}<Card><EmptyState icon={ImageIcon} title="Artisan not found" description="This profile may have been removed." /></Card></PageContainer>;
  }

  const cover = safeImageUrl(artisan.thumbnail);
  const isVisitor = user.role === 'VISITOR';

  return (
    <PageContainer wide>
      {back}
      <Card className="overflow-hidden">
        <div className="relative h-44 bg-parchment-soft sm:h-56">
          <SafeImage src={cover} alt="" className="size-full" loading="eager" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/60 to-transparent" />
        </div>
        <div className="relative z-10 px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={artisan.name} src={artisan.profile_picture} size={104} className="ring-4 ring-surface" />
              <div className="pb-1">
                <h1 className="text-3xl font-semibold leading-tight">{artisan.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  {artisan.category && <Badge tone="gold">{artisan.category}</Badge>}
                  {artisan.shopAddress && <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-3.5" />{artisan.shopAddress}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isVisitor && <Button icon={MessageSquare} onClick={() => openMessenger(artisan)}>Message artisan</Button>}
              {artisan.location && (
                <a href={directionsUrl(artisan.location.lat, artisan.location.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold hover:border-gold">
                  <Navigation aria-hidden className="size-4" /> Directions
                </a>
              )}
              <Button variant="secondary" icon={Heart} onClick={toggleLike} aria-pressed={liked} className={cx(liked && 'border-maroon/40 bg-maroon-soft text-maroon')}>
                {liked ? 'Liked' : 'Like'} · {artisan.likes?.length ?? 0}
              </Button>
            </div>
          </div>
          <OrnamentDivider className="my-6" />
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div>
              <h2 className="mb-2 text-lg font-semibold">Story</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
                {stripMarkdownEmphasis(artisan.description || `A ${artisan.category ? artisan.category.toLowerCase() : 'craft'} artisan working in Udaipur.`)}
              </p>
            </div>
            <dl className="space-y-3 rounded-lg bg-parchment-soft/60 p-4 text-sm">
              {artisan.phone && (
                <div>
                  <dt className="text-ink-muted">Phone</dt>
                  <dd><a href={`tel:+91${artisan.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-indigo hover:underline"><Phone aria-hidden className="size-3.5" />+91 {artisan.phone}</a></dd>
                </div>
              )}
              <div>
                <dt className="text-ink-muted">Pieces listed</dt>
                <dd className="ms-num font-semibold">{products.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      <h2 className="mb-4 mt-8 text-2xl font-semibold">Pieces</h2>
      {products.length === 0 ? (
        <Card><EmptyState icon={ImageIcon} title="No pieces listed yet" description="Message the artisan to ask about their work." /></Card>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelected(p)} className="group block w-full rounded-lg text-left focus-visible:outline-2">
                <Card as="div" interactive className="overflow-hidden">
                  <div className="bg-parchment-soft px-3 pt-3">
                    <ArchImage src={safeImageUrl(p.image_url)} alt={p.title} className="aspect-[4/5] w-full" />
                  </div>
                  <div className="p-4">
                    {p.style && <Badge tone="gold">{p.style}</Badge>}
                    <h3 className="mt-2 line-clamp-2 font-sans text-base font-semibold">{p.title}</h3>
                    <p className="mt-1 text-sm text-ink-muted">View details</p>
                  </div>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <ProductDetail
          product={selected}
          artisan={artisan}
          onClose={() => setSelected(null)}
          onLikeChange={likes => setProducts(list => list.map(p => (p.id === selected.id ? { ...p, likes } : p)))}
        />
      )}
    </PageContainer>
  );
};
