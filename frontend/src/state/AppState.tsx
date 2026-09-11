// AppState.tsx — tiny global store (no nav lib needed for 48h).
// Tabs: Inicio | Panel | Red | Ajustes. Wizard (chat/revisar/informe) has no tabs.

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TierId } from '../qvac/TIER_ROSTER';
import type { UiLang } from '../i18n/strings';
import { ensureSeed } from '../db/seed';
import { pendingCount } from '../db/database';
import { checkPeerHealth, DEFAULT_PEER_BASE, peerSupportsTier, type PeerHealth } from '../qvac/peerClient';

const UI_LANG_KEY = '@cibi:ui-lang';
const TIER_KEY = '@cibi:tier';
const PEER_BASE_KEY = '@cibi:peer-base';

export type TopTab = 'home' | 'panel' | 'network' | 'settings';
export type Wizard = { name: 'chat'; inspectionId: string } | { name: 'review'; inspectionId: string } | { name: 'report'; inspectionId: string } | null;

interface AppState {
  tab: TopTab;
  setTab: (t: TopTab) => void;
  wizard: Wizard;
  setWizard: (w: Wizard) => void;
  tier: TierId;
  setTier: (t: TierId) => void;
  selectTier: (t: TierId) => Promise<boolean>;
  peerBase: string;
  setPeerBase: (s: string) => void;
  peerStatus: PeerHealth | null;
  refreshPeer: (base?: string) => Promise<PeerHealth>;
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
  const [tier, setTierState] = useState<TierId>('CIBI');
  const [peerBase, setPeerBaseState] = useState(DEFAULT_PEER_BASE);
  const [peerStatus, setPeerStatus] = useState<PeerHealth | null>(null);
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

  const setTier = (next: TierId) => {
    setTierState(next);
    AsyncStorage.setItem(TIER_KEY, next).catch(() => {});
  };

  const setPeerBase = (next: string) => {
    const clean = next.trim().replace(/\/+$/, '');
    setPeerBaseState(clean || DEFAULT_PEER_BASE);
    AsyncStorage.setItem(PEER_BASE_KEY, clean || DEFAULT_PEER_BASE).catch(() => {});
  };

  const refreshPeer = async (base = peerBase): Promise<PeerHealth> => {
    const status = await checkPeerHealth(base);
    setPeerStatus(status);
    return status;
  };

  const selectTier = async (next: TierId): Promise<boolean> => {
    if (next === 'CIBI') {
      setTier(next);
      return true;
    }
    const status = await refreshPeer();
    if (!peerSupportsTier(status, next)) return false;
    setTier(next);
    return true;
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(UI_LANG_KEY);
        if (saved === 'es' || saved === 'en') setUiLang(saved);
        const savedTier = await AsyncStorage.getItem(TIER_KEY);
        if (savedTier === 'CIBI' || savedTier === 'CIBI_PRO' || savedTier === 'CIBI_SUPER') setTierState(savedTier);
        const savedPeer = await AsyncStorage.getItem(PEER_BASE_KEY);
        const initialPeer = savedPeer?.trim() || DEFAULT_PEER_BASE;
        setPeerBaseState(initialPeer.replace(/\/+$/, ''));
        checkPeerHealth(initialPeer).then(setPeerStatus).catch(() => {});
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
    <Ctx.Provider value={{ tab, setTab, wizard, setWizard, tier, setTier, selectTier, peerBase, setPeerBase, peerStatus, refreshPeer, uiLang, setUiLang: persistUiLang, online, pendings, refreshPendings, backendBase, setBackendBase, detailsOpen, setDetailsOpen, ready }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
