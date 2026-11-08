import React from 'react';
import { cx } from '../../lib/cx';
import { SafeImage } from './SafeImage';

/**
 * Mewar Sync emblem — a geometric sun (the Suryavanshi sun of Mewar's royal
 * crest) set inside a cusped jharokha arch.
 */
export function Emblem({ className, title }: { className?: string; title?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 48 48" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path
        d="M24 2c3 3.4 6.7 4.6 9.5 6.4 3.6 2.3 5.2 5.4 5.6 8.6.4 3 1.9 4.6 4.4 5.7V46H4.5V22.7c2.5-1.1 4-2.7 4.4-5.7.4-3.2 2-6.3 5.6-8.6C17.3 6.6 21 5.4 24 2z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M24 2c3 3.4 6.7 4.6 9.5 6.4 3.6 2.3 5.2 5.4 5.6 8.6.4 3 1.9 4.6 4.4 5.7V46H4.5V22.7c2.5-1.1 4-2.7 4.4-5.7.4-3.2 2-6.3 5.6-8.6C17.3 6.6 21 5.4 24 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <g transform="translate(24 29)">
        {rays.map(deg => (
          <path key={deg} d={deg % 60 === 0 ? 'M0-13.5l1.9 6h-3.8z' : 'M0-11l1.4 4.2h-2.8z'} transform={`rotate(${deg})`} fill="currentColor" />
        ))}
        <circle r="5.6" fill="currentColor" />
        <circle r="2.4" fill="var(--color-maroon)" />
      </g>
    </svg>
  );
}

export function Wordmark({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <Emblem className={cx('size-8 shrink-0', tone === 'light' ? 'text-gold' : 'text-gold')} />
      <span className={cx('font-brand text-[1.3rem] font-semibold leading-none tracking-tight', tone === 'light' ? 'text-white' : 'text-ink')}>
        Mewar <span className={tone === 'light' ? 'text-gold-light' : 'text-indigo'}>Sync</span>
      </span>
    </span>
  );
}

/** Fine-line divider with a small lotus-diamond at its centre. */
export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx('flex items-center gap-2.5 text-gold/80', className)}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
      <svg viewBox="0 0 10 10" className="size-2"><path d="M5 0l5 5-5 5-5-5z" fill="currentColor" /></svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  );
}

/** Outline of a cusped arch, used as a quiet frame in empty states. */
export function ArchMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M40 6c4 4.5 9 6 12.6 8.5 4.8 3 6.9 7.2 7.4 11.4.5 4 2.5 6.1 5.8 7.6V74H14.2V33.5c3.3-1.5 5.3-3.6 5.8-7.6.5-4.2 2.6-8.4 7.4-11.4C31 12 36 10.5 40 6z" />
      <path d="M40 14c3 3.3 6.6 4.4 9.2 6.2 3.5 2.2 5 5.2 5.4 8.3.4 2.9 1.8 4.4 4.2 5.5V68H21.2V34c2.4-1.1 3.8-2.6 4.2-5.5.4-3.1 1.9-6.1 5.4-8.3C33.4 18.4 37 17.3 40 14z" opacity=".55" />
    </svg>
  );
}

/** CSS clip-path for a cusped (jharokha) arch top, for image frames. */
export const ARCH_CLIP = 'polygon(0% 100%, 0% 22%, 8% 14%, 16% 9%, 26% 5%, 38% 2%, 50% 0%, 62% 2%, 74% 5%, 84% 9%, 92% 14%, 100% 22%, 100% 100%)';

export function ArchImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  return (
    <div className={cx('overflow-hidden bg-parchment', className)} style={{ clipPath: ARCH_CLIP }}>
      <SafeImage src={src} alt={alt} className="size-full" />
    </div>
  );
}
