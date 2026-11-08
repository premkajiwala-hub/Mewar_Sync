import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal hash router: `#/ledger`, `#/artisans/abc123`. Keeps browser
 * back/forward and refresh working without a server-side route table.
 */
function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  const path = raw.split('?')[0] || '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash === target) return;
  if (opts.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function useHashPath(): [string, (path: string, opts?: { replace?: boolean }) => void] {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((p: string, opts?: { replace?: boolean }) => navigate(p, opts), []);
  return [path, go];
}

/** Splits `/artisans/abc` into ['artisans', 'abc']. */
export function pathSegments(path: string): string[] {
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}
