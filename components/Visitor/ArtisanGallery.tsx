import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Search, Users } from 'lucide-react';
import type { ArtisanProduct, UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { useApp } from '../layout/AppContext';
import { PageContainer } from '../layout/AppShell';
import { Input } from '../ui/Form';
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../ui/Surface';
import { ARCH_CLIP } from '../ui/Ornaments';
import { safeImageUrl, stripMarkdownEmphasis } from '../../lib/text';
import { cx } from '../../lib/cx';
import { SafeImage } from '../ui/SafeImage';

export const ArtisanGallery: React.FC = () => {
  const { navigate } = useApp();
  const [artisans, setArtisans] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<ArtisanProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [craft, setCraft] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([storage.getArtisans(), storage.getProducts()]);
      setArtisans(a.sort((x, y) => x.name.localeCompare(y.name)));
      setProducts(p);
      setStatus('ready');
    } catch (err) {
      setError(errorMessage(err, 'Could not load artisans.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crafts = useMemo(() => [...new Set(artisans.map(a => a.category).filter(Boolean) as string[])].sort(), [artisans]);
  const pieceCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.shop_id, (m.get(p.shop_id) ?? 0) + 1);
    return m;
  }, [products]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return artisans.filter(a => (craft === 'ALL' || a.category === craft) && (!term || a.name.toLowerCase().includes(term) || (a.category || '').toLowerCase().includes(term)));
  }, [artisans, search, craft]);

  return (
    <PageContainer wide>
      <PageHeader title="Artisans" />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="lg:w-80">
            <Input type="search" aria-label="Search artisans" placeholder="Search by name or craft" value={search} onChange={e => setSearch(e.target.value)} leading={<Search className="size-4" />} />
          </div>
          <div role="group" aria-label="Filter by craft" className="ms-no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {['ALL', ...crafts].map(c => (
              <button key={c} type="button" aria-pressed={craft === c} onClick={() => setCraft(c)} className={cx('h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors duration-200', craft === c ? 'bg-ink text-white' : 'bg-black/[0.05] text-ink-soft hover:bg-black/[0.08]')}>
                {c === 'ALL' ? 'All crafts' : c}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {status === 'loading' && <Card><LoadingBlock label="Loading artisans" rows={4} /></Card>}
      {status === 'error' && <Card><ErrorState message={error} onRetry={load} /></Card>}
      {status === 'ready' && visible.length === 0 && (
        <Card><EmptyState icon={Users} title={artisans.length === 0 ? 'No artisans have joined yet' : 'No artisans match'} description={artisans.length === 0 ? 'Check back soon.' : 'Try another name or craft.'} /></Card>
      )}

      {status === 'ready' && visible.length > 0 && (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(a => {
            const cover = safeImageUrl(a.thumbnail);
            const pieces = pieceCount.get(a.id) ?? 0;
            return (
              <li key={a.id}>
                <Card as="article" interactive className="group relative flex h-full flex-col overflow-hidden">
                  <div className="relative h-36 bg-parchment-soft" style={{ clipPath: ARCH_CLIP }}>
                    <SafeImage src={cover} alt="" className="size-full transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="relative z-10 -mt-8 flex flex-1 flex-col px-4 pb-4">
                    <Avatar name={a.name} src={a.profile_picture} size={60} className="ring-4 ring-surface" />
                    <h2 className="mt-2 text-lg font-semibold leading-snug">
                      <a href={`#/artisans/${a.id}`} onClick={e => { e.preventDefault(); navigate(`/artisans/${a.id}`); }} className="after:absolute after:inset-0 focus-visible:outline-none">
                        {a.name}
                      </a>
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.category && <Badge tone="gold">{a.category}</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{stripMarkdownEmphasis(a.description || a.shopAddress || 'Traditional workshop in Udaipur.')}</p>
                    <div className="mt-auto flex items-center justify-between pt-3 text-sm text-ink-muted">
                      <span>{pieces} {pieces === 1 ? 'piece' : 'pieces'}</span>
                      <span className="inline-flex items-center gap-1"><Heart aria-hidden className="size-4" />{a.likes?.length ?? 0}<span className="sr-only"> likes</span></span>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
};
