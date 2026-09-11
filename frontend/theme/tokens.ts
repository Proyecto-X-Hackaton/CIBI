// Task 01 — semantic theme tokens. No screen may hardcode a hex; import from here via useTheme().
export type ThemeTokens = {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  green: string;
  blue: string;
  amber: string;
  purple: string;
  /** Text/icon on solid green accent fills (CTA buttons, send). */
  onAccent: string;
  statusBar: 'light' | 'dark';
};

export const DarkTheme: ThemeTokens = {
  bg: '#0B0B0F',
  surface: '#16161E',
  border: '#26262F',
  text: '#F2F2F5',
  muted: '#A7A7B3',
  green: '#22C55E',
  blue: '#3B82F6',
  amber: '#F59E0B',
  purple: '#A78BFA',
  onAccent: '#04120A',
  statusBar: 'light',
};

export const LightTheme: ThemeTokens = {
  bg: '#F7F7FA',
  surface: '#FFFFFF',
  border: '#E2E2E8',
  text: '#14141A',
  muted: '#5A5A66',
  green: '#15803D',
  blue: '#1D4ED8',
  amber: '#B45309',
  purple: '#7C3AED',
  onAccent: '#FFFFFF',
  statusBar: 'dark',
};

/** Text on fixed-dark fills (blue buttons, confidence chips). Same in both themes. */
export const ON_DARK = '#FFFFFF';

/** Confidence chip fills. Fixed dark pills with white text — identical in both themes. */
export const CONFIDENCE_COLORS: Record<string, string> = {
  Confirmed: '#15803D',
  Reported: '#6D28D9',
  Estimated: '#B45309',
  Unknown: '#52525B',
};
