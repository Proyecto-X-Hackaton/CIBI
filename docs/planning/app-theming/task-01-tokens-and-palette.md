# Task 01 — Theme tokens (dark + light palettes)

## Goal
One `tokens.ts` with semantic color names shared by every screen. Dark values come from the existing mockups; light values are new and contrast-checked. No screen ever hardcodes a hex.

## Steps
1. Create `frontend/theme/tokens.ts` exporting `DarkTheme` and `LightTheme` objects with identical keys:
   `bg, surface, border, text, muted, green, blue, amber, purple, statusBar`
2. Dark values (from `docs/ui-ux-plan` mockups `:root`):
   `bg #0B0B0F · surface #16161E · border #26262F · text #F2F2F5 · muted #A7A7B3 · green #22C55E · blue #3B82F6 · amber #F59E0B · purple #A78BFA · statusBar 'light'`
3. Light values (new — darken accents ~20% for contrast on white, do not reuse dark accents blindly):
   `bg #F7F7FA · surface #FFFFFF · border #E2E2E8 · text #14141A · muted #5A5A66 · green #15803D · blue #1D4ED8 · amber #B45309 · purple #7C3AED · statusBar 'dark'`
4. Verify body text and muted text each reach ~4.5:1 contrast against `bg` and `surface` in both themes (use any contrast checker, record the ratios in the PR).

## Files
- New: `frontend/theme/tokens.ts`

## Acceptance
- [ ] Both palettes share identical token keys (TypeScript type enforces it).
- [ ] Contrast ratios recorded; text/muted pass ~4.5:1 on bg and surface in both themes.
- [ ] No other file created or touched in this task.
