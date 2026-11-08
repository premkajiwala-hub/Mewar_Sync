import React, { createContext, useContext } from 'react';
import type { UserProfile } from '../../types';

export interface AppContextValue {
  user: UserProfile;
  /** Increments whenever records change elsewhere (e.g. a voice entry), so pages refetch. */
  dataVersion: number;
  notifyDataChanged: () => void;
  navigate: (path: string) => void;
  openMessenger: (artisan?: UserProfile) => void;
  /** Artisans only: opens the new-entry form from anywhere. */
  openNewEntry?: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ value, children }: { value: AppContextValue; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
