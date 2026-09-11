# Task 05 — Light mockups, contrast QA, both-theme hallway test

## Goal
Prove both themes before the jury does. Depends on Tasks 01–04.

## Steps
1. Add a light `:root` variable block to all 7 HTML mockups in `docs/ui-ux-plan/` (mechanical swap of the values from Task 01; no layout changes).
2. Hallway-test **both** themes on a phone browser: chat, revisar, informe, sedes, ajustes.
3. Compliance-critical contrast pass in both themes (screenshots, attach to PR):
   - Disclaimer banner "Extracción de inventario de equipamiento. No es diagnóstico clínico."
   - Confidence chips + freshness badges + offline badge at body text sizes.
4. Record the demo video in dark mode (default) for visual consistency.

## Files
- Edit: `docs/ui-ux-plan/SCREEN_*.html` (theme variables only).

## Acceptance
- [ ] Both themes hallway-tested on-device; findings fixed or filed.
- [ ] Disclaimer + chips legible in both themes (screenshot pair in PR).
- [ ] Video records the dark default; light mode never appears unless the toggle is demoed.
