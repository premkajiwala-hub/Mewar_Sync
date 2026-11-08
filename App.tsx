import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Camera, FileText, Image as ImageIcon, Landmark, Languages, LayoutDashboard, Map as MapIcon,
  Package, Plus, Settings, ShieldCheck, Users, Wallet,
} from 'lucide-react';
import type { UserProfile } from './types';
import { storage, type AuthState } from './services/storage';
import { htmlLangFor, t } from './services/i18n';
import { pathSegments, useHashPath } from './lib/router';
import { localDateKey } from './lib/dates';
import { VOICE_ENABLED } from './lib/features';
import { AppShell, type NavSection } from './components/layout/AppShell';
import { AppProvider } from './components/layout/AppContext';
import { AuthPortal } from './components/Auth/AuthPortal';
import { Button } from './components/ui/Button';
import { Emblem } from './components/ui/Ornaments';
import { Spinner } from './components/ui/Surface';
import { useToast } from './components/ui/Toast';

const ArtisanDashboard = lazy(() => import('./components/Artisan/Dashboard').then(m => ({ default: m.ArtisanDashboard })));
const RoyalLedger = lazy(() => import('./components/Artisan/RoyalLedger').then(m => ({ default: m.RoyalLedger })));
const Inventory = lazy(() => import('./components/Artisan/Inventory').then(m => ({ default: m.Inventory })));
const UdhaarTracker = lazy(() => import('./components/Artisan/UdhaarTracker').then(m => ({ default: m.UdhaarTracker })));
const LedgerReports = lazy(() => import('./components/Artisan/LedgerReports').then(m => ({ default: m.LedgerReports })));
const MyGallery = lazy(() => import('./components/Artisan/MyGallery').then(m => ({ default: m.MyGallery })));
const ScanToList = lazy(() => import('./components/Artisan/ScanToList').then(m => ({ default: m.ScanToList })));
const ProfileSettings = lazy(() => import('./components/Artisan/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const Marketplace = lazy(() => import('./components/Visitor/Marketplace').then(m => ({ default: m.Marketplace })));
const ArtisanGallery = lazy(() => import('./components/Visitor/ArtisanGallery').then(m => ({ default: m.ArtisanGallery })));
const ArtisanProfile = lazy(() => import('./components/Visitor/ArtisanProfile').then(m => ({ default: m.ArtisanProfile })));
const TranslatorBridge = lazy(() => import('./components/Communication/TranslatorBridge').then(m => ({ default: m.TranslatorBridge })));
const AuthenticityScanner = lazy(() => import('./components/Tourist/AuthenticityScanner').then(m => ({ default: m.AuthenticityScanner })));
const LocationPhotoManager = lazy(() => import('./components/Admin/LocationPhotoManager').then(m => ({ default: m.LocationPhotoManager })));
const Messenger = lazy(() => import('./components/Communication/Messenger').then(m => ({ default: m.Messenger })));
const AIChatbot = lazy(() => import('./components/Communication/AIChatbot').then(m => ({ default: m.AIChatbot })));
const VoiceAssistant = lazy(() => import('./components/Voice/MewarAssistant').then(m => ({ default: m.VoiceAssistant })));
const LedgerEntryForm = lazy(() => import('./components/Artisan/LedgerEntryForm').then(m => ({ default: m.LedgerEntryForm })));

function navFor(user: UserProfile): NavSection[] {
  const lang = user.preferredLanguage;
  if (user.role === 'SHOPKEEPER') {
    return [
      {
        title: t('workshop', lang),
        items: [
          { path: '/overview', label: t('overview', lang), icon: LayoutDashboard },
          { path: '/ledger', label: t('ledger', lang), icon: BookOpen },
          { path: '/inventory', label: t('inventory', lang), icon: Package },
          { path: '/udhaar', label: t('udhaar', lang), icon: Wallet },
          { path: '/reports', label: t('reports', lang), icon: FileText },
        ],
      },
      {
        title: t('showcase', lang),
        items: [
          { path: '/gallery', label: t('gallery', lang), icon: ImageIcon },
          { path: '/scan', label: t('scan', lang), icon: Camera },
        ],
      },
      { title: t('account', lang), items: [{ path: '/settings', label: t('settings', lang), icon: Settings }] },
    ];
  }
  if (user.role === 'ADMIN') {
    return [
      { title: t('admin', lang), items: [{ path: '/place-photos', label: t('placePhotos', lang), icon: Landmark }] },
      { title: t('account', lang), items: [{ path: '/settings', label: t('settings', lang), icon: Settings }] },
    ];
  }
  return [
    {
      title: t('discover', lang),
      items: [
        { path: '/explore', label: t('explore', lang), icon: MapIcon },
        { path: '/artisans', label: t('artisans', lang), icon: Users },
      ],
    },
    {
      title: t('tools', lang),
      items: [
        { path: '/translator', label: t('translator', lang), icon: Languages },
        { path: '/authenticity', label: t('authenticity', lang), icon: ShieldCheck },
      ],
    },
    { title: t('account', lang), items: [{ path: '/settings', label: t('settings', lang), icon: Settings }] },
  ];
}

function homeFor(user: UserProfile): string {
  return user.role === 'SHOPKEEPER' ? '/overview' : user.role === 'ADMIN' ? '/place-photos' : '/explore';
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Emblem className="size-14 text-gold-deep" />
      {children}
    </div>
  );
}

const PageFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Spinner label="Loading page" />
  </div>
);

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading', user: null });
  const [path, go] = useHashPath();
  const [dataVersion, setDataVersion] = useState(0);
  const [messenger, setMessenger] = useState<{ open: boolean; artisan?: UserProfile }>({ open: false });
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const toast = useToast();

  useEffect(() => storage.onAuthChange(setAuth), []);

  const user = auth.status === 'signed_in' ? auth.user : null;

  useEffect(() => {
    document.documentElement.lang = htmlLangFor(user?.preferredLanguage);
  }, [user?.preferredLanguage]);

  // Route guard: unknown or role-inappropriate routes go to the role's home.
  const sections = useMemo(() => (user ? navFor(user) : []), [user?.role, user?.preferredLanguage]);
  const allowedRoots = useMemo(() => new Set(sections.flatMap(s => s.items.map(i => pathSegments(i.path)[0]))), [sections]);
  const segments = pathSegments(path);
  const root = segments[0] ?? '';
  useEffect(() => {
    if (!user) return;
    if (!allowedRoots.has(root)) go(homeFor(user), { replace: true });
  }, [user, root, allowedRoots, go]);

  // Live unread-message badge.
  useEffect(() => {
    if (!user || user.role === 'ADMIN') return;
    return storage.onChatSessions(user.id, user.role, sessions => {
      setUnread(sessions.reduce((sum, s) => sum + ((user.role === 'SHOPKEEPER' ? s.unread_count_artisan : s.unread_count_visitor) || 0), 0));
    });
  }, [user?.id, user?.role]);

  // Close the previous days' galla (idempotent), on sign-in and when the date rolls over.
  useEffect(() => {
    if (user?.role !== 'SHOPKEEPER') return;
    let lastDay = '';
    const run = () => {
      const today = localDateKey();
      if (today === lastDay) return;
      lastDay = today;
      storage.closeDailySummaries(today).catch(() => { lastDay = ''; });
    };
    run();
    const timer = window.setInterval(run, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [user?.id, user?.role]);

  const notifyDataChanged = useCallback(() => setDataVersion(v => v + 1), []);
  const openMessenger = useCallback((artisan?: UserProfile) => setMessenger({ open: true, artisan }), []);

  const handleLogout = useCallback(async () => {
    await storage.logout();
    setMessenger({ open: false });
    setEntryFormOpen(false);
    go('/', { replace: true });
  }, [go]);

  if (auth.status === 'loading') {
    return (
      <FullScreenMessage>
        <Spinner label="Opening your workshop" />
      </FullScreenMessage>
    );
  }

  if (auth.status === 'profile_missing') {
    return (
      <FullScreenMessage>
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-semibold">We couldn’t load your profile</h1>
          <p className="text-ink-muted">Your sign-in worked, but the account profile is missing or could not be reached. Check your connection, or sign out and register again.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
          <Button onClick={handleLogout}>Sign out</Button>
        </div>
      </FullScreenMessage>
    );
  }

  if (!user) return <AuthPortal />;

  const activeItem = sections.flatMap(s => s.items).find(i => pathSegments(i.path)[0] === root);
  const pageTitle = root === 'artisans' && segments[1] ? 'Artisan profile' : activeItem?.label ?? '';
  const isArtisan = user.role === 'SHOPKEEPER';

  const renderPage = () => {
    // Never render (or load data for) a page outside this role; the guard above redirects.
    if (!allowedRoots.has(root)) return <PageFallback />;
    switch (root) {
      case 'overview': return <ArtisanDashboard />;
      case 'ledger': return <RoyalLedger />;
      case 'inventory': return <Inventory />;
      case 'udhaar': return <UdhaarTracker />;
      case 'reports': return <LedgerReports />;
      case 'gallery': return <MyGallery />;
      case 'scan': return <ScanToList />;
      case 'settings': return <ProfileSettings />;
      case 'explore': return <Marketplace />;
      case 'artisans': return segments[1] ? <ArtisanProfile artisanId={segments[1]} /> : <ArtisanGallery />;
      case 'translator': return <TranslatorBridge />;
      case 'authenticity': return <AuthenticityScanner />;
      case 'place-photos': return <LocationPhotoManager />;
      default: return <PageFallback />;
    }
  };

  return (
    <AppProvider
      value={{
        user,
        dataVersion,
        notifyDataChanged,
        navigate: go,
        openMessenger,
        openNewEntry: isArtisan ? () => setEntryFormOpen(true) : undefined,
      }}
    >
      <AppShell
        user={user}
        sections={sections}
        activePath={path}
        pageTitle={pageTitle}
        onNavigate={go}
        onLogout={handleLogout}
        onOpenMessages={user.role === 'ADMIN' ? undefined : () => openMessenger()}
        unreadMessages={unread}
        primaryAction={isArtisan && root !== 'ledger' && root !== 'overview' ? <Button icon={Plus} size="sm" onClick={() => setEntryFormOpen(true)}>New entry</Button> : undefined}
      >
        <Suspense fallback={<PageFallback />}>
          <div key={root} className="animate-fade-in">{renderPage()}</div>
        </Suspense>
      </AppShell>

      <Suspense fallback={null}>
        {isArtisan && VOICE_ENABLED && <VoiceAssistant />}
        {isArtisan && entryFormOpen && (
          <LedgerEntryForm
            open
            onClose={() => setEntryFormOpen(false)}
            onSaved={message => {
              setEntryFormOpen(false);
              notifyDataChanged();
              toast.success(message);
            }}
          />
        )}
        {messenger.open && (
          <Messenger currentUser={user} targetArtisan={messenger.artisan} onClose={() => setMessenger({ open: false })} />
        )}
        <AIChatbot role={user.role} raised={isArtisan && VOICE_ENABLED} />
      </Suspense>
    </AppProvider>
  );
};

export default App;
