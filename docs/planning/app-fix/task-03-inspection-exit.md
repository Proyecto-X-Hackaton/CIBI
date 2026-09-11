# Task 03 — Inspection exit (Salir) that works

## Goal
One obvious, ≥48px, always-working exit from the wizard. Fixes the #1 usability blocker.

## Steps
1. `App.tsx`: replace `exitbar` footer (padding 10, font 12) with 56px-min-height button: `<ChevronLeft> Salir a Inicio` + subtitle `borrador guardado local`. Keep `setWizard(null)` but precede with `refreshPendings()`. Add `accessibilityRole="button"`, `hitSlop`.
2. `ChatCaptureScreen.tsx:151`: turn `‹ Salir · Paso 1 de 2` header into a real `TouchableOpacity` calling the same exit (prop `onExit` from App shell, or `setWizard(null)` directly). Minimum 48px height.
3. `ReviewScreen` ghost button already calls `setWizard(null)` — keep, enlarge to 52px, relabel via i18n key.
4. Confirm-no-loss: drafts are already write-through in SQLite, so exit needs no confirm dialog; add `Alert` only if `busy != null` ("Modelo trabajando — salir de todos modos?").

## Files
- Edit: `frontend/App.tsx`, `frontend/src/screens/ChatCaptureScreen.tsx`, `frontend/src/screens/ReviewScreen.tsx`

## Acceptance
- [ ] Salir tappable first try on physical device, ≥48px tall, exits to Inicio.
- [ ] Draft messages survive exit → re-enter via Continuar chat.
- [ ] No dead `Text`-only Salir anywhere.
