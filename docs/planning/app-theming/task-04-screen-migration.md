# Task 04 — Migrate all surfaces to themed styles

## Goal
Every screen renders from tokens; zero hardcoded colors. Depends on Tasks 01–02. Runs alongside screen development — each new screen is born themed.

## Surface inventory (all must use `useThemedStyles`)
Tabs (Inicio / Panel / Red / Ajustes) · wizard chat + composer · Revisar · Informe · ⓘ `TierDetailsSheet` · tier pills + mascot bar · confidence chips (`Confirmed | Reported | Estimated | Unknown`) · freshness badges · offline badge · search/filter chips · tier-to-model mapping sheet.

## Steps
1. Convert each surface's `StyleSheet.create` to `useThemedStyles((t) => …)`, mapping mockup `:root` variables to token names 1:1.
2. Run the gate: no `#[0-9A-Fa-f]{3,6}` hex may appear in any `*.tsx` outside `frontend/theme/`. Fix every hit.
3. Explicitly out of scope: PDF export stays a fixed white print-friendly template regardless of app theme (PDFs are documents, not UI). Add one disclosure line in F06/README so it is never filed as a bug.

## Files
- Edit: all screen/component files as they are built.

## Acceptance
- [ ] Hex grep gate clean (only `frontend/theme/` matches).
- [ ] Toggling theme flips every listed surface with no leftover dark-only or light-only screen.
- [ ] PDF output byte-identical regardless of active app theme.
