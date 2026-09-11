# Task 05 — ES/EN toggle that actually works

## Goal
`Ajustes → Idioma` flips every screen instantly + persists. Fixes dead toggle.

## Steps
1. Extend `src/i18n/strings.ts`: add keys for tabs, home, chat (placeholder, CTA, step, tier), review, report, panel, network, settings, exit, disclaimer. Keep `UiLang='es'|'en'`.
2. Create `src/i18n/useStrings.ts`: `useStrings()` reads `uiLang` from `useApp()` and returns `STR[uiLang]`. No screen imports `STR` directly.
3. Replace hardcoded Spanish in: `App.tsx` (tabs, exit), `HomeScreen`, `ChatCaptureScreen` (placeholder, hello message, CTAs), `ReviewScreen`, `ReportScreen`, `PanelScreen`, `NetworkScreen`, `SettingsScreen`, `atoms.tsx` (OfflineBadge pending/offline labels).
4. Persist: `AppState` loads `uiLang` from AsyncStorage `@cibi:ui-lang` on boot, saves on `setUiLang`. Install `@react-native-async-storage/async-storage`.
5. Capture language stays ES/PT→EN regardless of UI lang (F01) — add helper text in both languages.

## Files
- New: `frontend/src/i18n/useStrings.ts`
- Edit: `frontend/src/i18n/strings.ts`, `frontend/src/state/AppState.tsx`, all screens + atoms
- Deps: `@react-native-async-storage/async-storage`

## Acceptance
- [ ] Toggle ES↔EN in Ajustes re-renders all tabs + wizard instantly.
- [ ] Kill + relaunch → language persists.
- [ ] No hardcoded `Inicio/Panel/Red/Ajustes` literals outside strings.ts.
