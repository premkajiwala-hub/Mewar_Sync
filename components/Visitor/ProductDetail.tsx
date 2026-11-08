import React, { useState } from 'react';
import { BadgeCheck, Heart, MessageSquare, ShieldCheck } from 'lucide-react';
import type { ArtisanProduct, UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { geminiService, type AuthenticityReport } from '../../services/gemini';
import { errorMessage } from '../../services/api';
import { safeImageUrl, stripMarkdownEmphasis } from '../../lib/text';
import { formatINR } from '../../lib/money';
import { cx } from '../../lib/cx';
import { useApp } from '../layout/AppContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar, Badge, Spinner } from '../ui/Surface';
import { useToast } from '../ui/Toast';
import { AuthenticityResult } from '../Tourist/AuthenticityScanner';
import { SafeImage } from '../ui/SafeImage';

interface ProductDetailProps {
  product: ArtisanProduct;
  artisan?: UserProfile | null;
  onClose: () => void;
  onLikeChange?: (likes: string[]) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ product, artisan, onClose, onLikeChange }) => {
  const { user, openMessenger } = useApp();
  const toast = useToast();
  const [likes, setLikes] = useState<string[]>(product.likes ?? []);
  const [report, setReport] = useState<AuthenticityReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const image = safeImageUrl(product.image_url);
  const liked = likes.includes(user.id);
  const isOwner = product.shop_id === user.id;

  const toggleLike = async () => {
    const next = liked ? likes.filter(id => id !== user.id) : [...likes, user.id];
    setLikes(next);
    try {
      await storage.toggleProductLike(product.id, !liked);
      onLikeChange?.(next);
    } catch (err) {
      setLikes(likes);
      toast.error('Could not update', errorMessage(err));
    }
  };

  const scan = async () => {
    if (!image || scanning) return;
    setScanning(true);
    setScanError('');
    try {
      const res = await fetch(image, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      setReport(await geminiService.checkAuthenticity(blob));
    } catch (err) {
      setScanError(errorMessage(err, 'The photo could not be analysed. Please try again.'));
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xl" title={product.title} description={product.style ? `${product.style}${artisan ? ` · by ${artisan.name}` : ''}` : undefined}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-parchment-soft">
          <SafeImage src={image} alt={product.title} className="max-h-[60dvh] min-h-48 w-full" imgClassName="!object-contain" loading="eager" />
        </div>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {product.style && <Badge tone="gold">{product.style}</Badge>}
            {product.is_verified && <Badge tone="success" icon={BadgeCheck}>Verified by Mewar Sync</Badge>}
            {!isOwner && (
              <button type="button" onClick={toggleLike} aria-pressed={liked} className={cx('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium', liked ? 'border-maroon/40 bg-maroon-soft text-maroon' : 'border-line bg-surface text-ink-soft hover:border-gold')}>
                <Heart aria-hidden className="size-4" fill={liked ? 'currentColor' : 'none'} /> {likes.length}
                <span className="sr-only">{liked ? 'Unlike' : 'Like'} this piece</span>
              </button>
            )}
          </div>

          {isOwner ? (
            <p className="ms-num font-display text-3xl font-semibold">{formatINR(product.price)}</p>
          ) : (
            <p className="rounded-md bg-parchment-soft/70 px-3 py-2 text-sm text-ink-soft">Prices are shared by the artisan — send a message to ask.</p>
          )}

          {product.description && (
            <div>
              <h3 className="mb-1.5 font-sans text-sm font-semibold uppercase tracking-wider text-gold-deep">Story</h3>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{stripMarkdownEmphasis(product.description)}</p>
            </div>
          )}

          {artisan && (
            <div className="flex items-center gap-3 rounded-lg border border-line-soft p-3">
              <Avatar name={artisan.name} src={artisan.profile_picture} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{artisan.name}</p>
                <p className="truncate text-sm text-ink-muted">{artisan.category || 'Artisan'}</p>
              </div>
              {user.role === 'VISITOR' && <Button size="sm" icon={MessageSquare} onClick={() => { onClose(); openMessenger(artisan); }}>Message</Button>}
            </div>
          )}

          <div className="rounded-lg border border-line-soft p-4">
            {!report && !scanning && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">Curious whether this piece is hand-painted? Ask the AI for an opinion based on the listing photo.</p>
                <Button variant="secondary" icon={ShieldCheck} onClick={scan}>Check authenticity</Button>
                {scanError && <p role="alert" className="text-sm text-danger">{scanError}</p>}
              </div>
            )}
            {scanning && <Spinner label="Examining the photo" />}
            {report && <AuthenticityResult report={report} />}
          </div>
        </div>
      </div>
    </Modal>
  );
};
