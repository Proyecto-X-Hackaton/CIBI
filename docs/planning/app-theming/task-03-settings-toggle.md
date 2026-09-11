# Task 03 — Appearance toggle in Settings

## Goal
User-facing theme switch. Depends on Task 02.

## Steps
1. In Settings (`SCREEN_05_SETTINGS.html` → real screen), add an `Apariencia` segmented control with three options: `🌙 Oscuro | ☀️ Claro | 📱 Sistema`.
2. Wire to `setMode()` from `useTheme()`. No theme names, hex values, or jargon in the UI — user strings only.
3. Update the `SCREEN_05_SETTINGS.html` mockup with the new control first; hallway-test on a phone browser.

## Files
- Edit: Settings screen, `docs/ui-ux-plan/SCREEN_05_SETTINGS.html`

## Acceptance
- [ ] Three options visible; tapping applies the theme instantly across all screens.
- [ ] Choice persists across app kill (AsyncStorage key from Task 02).
