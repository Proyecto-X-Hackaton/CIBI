# Task 02 — Theme provider, persistence, OS chrome

## Goal
App-wide theming that applies instantly, survives app kill, and keeps OS chrome (status/nav bars) in sync. Depends on Task 01.

## Steps
1. Install persistence: `npx expo install @react-native-async-storage/async-storage` (Expo-supported).
2. Create `frontend/theme/ThemeContext.tsx`:
   - `ThemeProvider` at app root, `useTheme()` hook returning `{ theme, mode, setMode }`.
   - Mode type `'dark' | 'light' | 'system'`, **default `'dark'`** (matches video + mockups).
   - Stored key `@cibi:theme-mode`; load before first render (splash holds) to avoid theme flash.
   - `mode === 'system'` follows React Native `useColorScheme()`; otherwise uses the stored mode.
3. Create `frontend/theme/useThemedStyles.ts`: `useThemedStyles((t) => StyleSheet.create({…}))`, memoized on the theme object. This is the only styling pattern screens may use.
4. `frontend/app.json`: set `"userInterfaceStyle": "automatic"` (template default `"light"` is wrong for both themes).
5. Root component: `<StatusBar style={theme.statusBar} />` driven by theme; Android edge-to-edge/nav-bar background derives from `theme.bg`.

## Files
- New: `frontend/theme/ThemeContext.tsx`, `frontend/theme/useThemedStyles.ts`
- Edit: `frontend/app.json`, `frontend/App.tsx` (root wiring only)

## Acceptance
- [ ] Switching `mode` re-renders the whole app with zero reload.
- [ ] Stored mode persists across app kill and relaunch; no light/dark flash on boot.
- [ ] Status bar and nav-bar background match the active theme.
- [ ] PDF export (`expo-print`) is untouched — fixed white template by design (see Task 04).
