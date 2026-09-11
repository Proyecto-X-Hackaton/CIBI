import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';
import type { ThemeTokens } from './tokens';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(fn: (t: ThemeTokens) => T): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(fn(theme)), [theme, fn]);
}
