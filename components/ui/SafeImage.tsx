import React, { useEffect, useState } from 'react';
import { safeImageUrl } from '../../lib/text';
import { cx } from '../../lib/cx';
import { Emblem } from './Ornaments';

/**
 * Image that only loads https/blob sources and falls back to a quiet heritage
 * pattern (instead of a broken-image icon) when the source fails to load.
 */
export function SafeImage({ src, alt, className, imgClassName, loading = 'lazy' }: { src?: string; alt: string; className?: string; imgClassName?: string; loading?: 'lazy' | 'eager' }) {
  const url = safeImageUrl(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <div role={alt ? 'img' : undefined} aria-label={alt || undefined} className={cx('ms-jaali flex items-center justify-center bg-gradient-to-br from-gold-soft to-parchment-soft', className)}>
        <Emblem className="size-1/3 max-h-14 max-w-14 text-gold/60" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cx('object-cover', className, imgClassName)}
    />
  );
}
