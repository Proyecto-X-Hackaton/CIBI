// AppState.tsx — tiny global store (no nav lib needed for 48h).
// Tabs: Inicio | Panel | Red | Ajustes. Wizard (chat/revisar/informe) has no tabs.

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TierId } from '../qvac/TIER_ROSTER';
import type { UiLang } from '../i18n/strings';
import { ensureSeed } from '../db/seed';
import { pendingCount } from '../db/database';

const UI_LANG_KEY = '@cibi:ui-lang';

export type TopTab = 'home' | 'panel' | 'network' | 'settings';
export type Wizard = { name: 'chat'; inspectionId: string } | { name: 'review'; inspectionId: string } | { name: 'report'; inspectionId: string } | null;

interface AppState {
  tab: TopTab;
  setTab: (t: TopTab) => void;
  wizard: Wizard;
  setWizard: (w: Wizard) => void;
  tier: TierId;
  setTier: (t: TierId) => void;
  uiLang: UiLang;
  setUiLang: (l: UiLang) => void;
  online: boolean;
  pendings: number;
  refreshPendings: () => void;
  backendBase: string;
  setBackendBase: (s: string) => void;
  detailsOpen: boolean;
  setDetailsOpen: (b: boolean) => void;
  ready: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<TopTab>('home');
  const [wizard, setWizard] = useState<Wizard>(null);
  const [tier, setTier] = useState<TierId>('CIBI');
  const [uiLang, setUiLang] = useState<UiLang>('es');
  const [online, setOnline] = useState(true);
  const [pendings, setPendings] = useState(0);
  const [backendBase, setBackendBase] = useState('http://10.0.2.2:8000');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const refreshPendings = () => {
    pendingCount().then(setPendings).catch(() => {});
  };

  const persistUiLang = (l: UiLang) => {
    setUiLang(l);
    AsyncStorage.setItem(UI_LANG_KEY, l).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(UI_LANG_KEY);
        if (saved === 'es' || saved === 'en') setUiLang(saved);
      } catch {}
      try {
        await ensureSeed();
      } catch {}
      refreshPendings();
      setReady(true);
    })();
    const t = setInterval(async () => {
      try {
        const s = await Network.getNetworkStateAsync();
        setOnline(!!s.isConnected && s.isInternetReachable !== false);
      } catch {}
      refreshPendings();
    }, 5000);
    Network.getNetworkStateAsync().then((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false)).catch(() => {});
    return () => clearInterval(t);
  }, []);

  return (
    <Ctx.Provider value={{ tab, setTab, wizard, setWizard, tier, setTier, uiLang, setUiLang: persistUiLang, online, pendings, refreshPendings, backendBase, setBackendBase, detailsOpen, setDetailsOpen, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
