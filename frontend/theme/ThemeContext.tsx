import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, LightTheme, type ThemeTokens } from './tokens';

export type ThemeMode = 'dark' | 'light' | 'system';
export const THEME_STORAGE_KEY = '@cibi:theme-mode';

type ThemeCtx = { theme: ThemeTokens; mode: ThemeMode; resolved: 'dark' | 'light'; setMode: (m: ThemeMode) => void };

const Ctx = createContext<ThemeCtx>({ theme: DarkTheme, mode: 'dark', resolved: 'dark', setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((v) => {
        if (v === 'dark' || v === 'light' || v === 'system') setModeState(v);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_STORAGE_KEY, m).catch(() => {});
  }, []);

  const resolved: 'dark' | 'light' = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
  const theme = resolved === 'light' ? LightTheme : DarkTheme;
  const value = useMemo(() => ({ theme, mode, resolved, setMode }), [theme, mode, resolved, setMode]);

  if (!loaded) return null; // splash holds: no theme flash
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
