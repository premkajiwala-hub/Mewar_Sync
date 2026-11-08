import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, MessageSquare, Settings, X, type LucideIcon } from 'lucide-react';
import type { UserProfile } from '../../types';
import { cx } from '../../lib/cx';
import { Avatar } from '../ui/Surface';
import { IconButton } from '../ui/Button';
import { Wordmark } from '../ui/Ornaments';
import { t } from '../../services/i18n';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

interface AppShellProps {
  user: UserProfile;
  sections: NavSection[];
  activePath: string;
  pageTitle: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onOpenMessages?: () => void;
  unreadMessages?: number;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

const ROLE_LABEL: Record<string, string> = { SHOPKEEPER: 'Artisan', VISITOR: 'Visitor', ADMIN: 'Administrator' };

function SidebarContent({ user, sections, activePath, onNavigate, onLogout }: Pick<AppShellProps, 'user' | 'sections' | 'activePath' | 'onNavigate' | 'onLogout'>) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div aria-hidden className="ms-jaali pointer-events-none absolute inset-x-0 bottom-0 h-56 opacity-40 [mask-image:linear-gradient(to_top,black,transparent)]" />
      <div className="px-5 pb-5 pt-5">
        <Wordmark />
      </div>
      <nav aria-label="Main" className="ms-scroll-thin relative flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {sections.map(section => (
          <div key={section.title}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const active = activePath === item.path || activePath.startsWith(`${item.path}/`);
                return (
                  <li key={item.path}>
                    <a
                      href={`#${item.path}`}
                      onClick={e => {
                        e.preventDefault();
                        onNavigate(item.path);
                      }}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-[background-color,color] duration-200',
                        active ? 'bg-indigo/[0.08] text-indigo' : 'text-ink-soft hover:bg-black/[0.04] hover:text-ink'
                      )}
                    >
                                            <item.icon aria-hidden className={cx('size-[18px] shrink-0 transition-colors', active ? 'text-indigo' : 'text-ink-muted group-hover:text-ink')} />
                      <span className="truncate">{item.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="relative border-t border-black/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <Avatar name={user.name} src={user.profile_picture} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <IconButton icon={LogOut} size="sm" label={t('signOut', user.preferredLanguage)} onClick={onLogout} />
        </div>
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  const { user, pageTitle, onOpenMessages, unreadMessages = 0, primaryAction, children, onNavigate, onLogout } = props;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Close the mobile drawer on navigation and move focus to the new page
  // (not on first load, so the skip link stays the first tab stop).
  const lastPath = useRef(props.activePath);
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
    if (lastPath.current === props.activePath) return;
    lastPath.current = props.activePath;
    mainRef.current?.focus({ preventScroll: true });
    mainRef.current?.scrollTo({ top: 0 });
  }, [props.activePath]);

  useEffect(() => {
    if (!drawerOpen) return;
    const first = drawerRef.current?.querySelector<HTMLElement>('a,button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const nodes = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('a,button'));
        if (nodes.length === 0) return;
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes[nodes.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }} className="sr-only z-[3000] rounded-xl bg-white px-4 py-2 font-semibold text-indigo shadow-raised focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="ms-glass-side hidden w-[256px] shrink-0 lg:block">
        <SidebarContent {...props} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[900] lg:hidden">
          <div aria-hidden className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[4px]" onClick={() => setDrawerOpen(false)} />
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation" className="ms-glass-strong absolute inset-y-0 left-0 flex w-[min(86vw,300px)] animate-rise-in flex-col rounded-r-[22px]">
            <IconButton icon={X} label="Close menu" size="sm" className="absolute right-3 top-4 z-10" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }} />
            <SidebarContent {...props} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="ms-glass-bar relative z-30 shrink-0">
          <div className="flex h-14 items-center gap-1.5 px-3 sm:px-5 lg:px-8">
            <IconButton ref={menuButtonRef} icon={Menu} label="Open menu" className="lg:hidden" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)} />
            <p aria-hidden className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink lg:invisible">{pageTitle}</p>
            {primaryAction && <div className="hidden sm:block">{primaryAction}</div>}
            {onOpenMessages && (
              <button
                type="button"
                onClick={onOpenMessages}
                className="relative inline-flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-black/5 hover:text-ink"
                aria-label={unreadMessages > 0 ? `${t('messages', user.preferredLanguage)}, ${unreadMessages} unread` : t('messages', user.preferredLanguage)}
              >
                <MessageSquare aria-hidden className="size-[18px]" />
                {unreadMessages > 0 && (
                  <span aria-hidden className="ms-num absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-maroon px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </button>
            )}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-black/5"
              >
                <Avatar name={user.name} src={user.profile_picture} size={32} />
              </button>
              {menuOpen && (
                <div role="menu" className="ms-glass-strong absolute right-0 top-12 w-60 animate-scale-in overflow-hidden rounded-2xl p-1.5">
                  <div className="mb-1 border-b border-black/[0.06] px-3 pb-2.5 pt-1.5">
                    <p className="truncate text-sm font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  </div>
                  <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/5" onClick={() => onNavigate('/settings')}>
                    <Settings aria-hidden className="size-4 text-ink-muted" /> {t('settings', user.preferredLanguage)}
                  </button>
                  <button role="menuitem" type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft" onClick={onLogout}>
                    <LogOut aria-hidden className="size-4" /> {t('signOut', user.preferredLanguage)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="ms-scroll-thin relative flex-1 overflow-y-auto outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageContainer({ children, wide = false, className }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cx('mx-auto w-full px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8', wide ? 'max-w-[1400px]' : 'max-w-6xl', className)}>
      {children}
    </div>
  );
}
