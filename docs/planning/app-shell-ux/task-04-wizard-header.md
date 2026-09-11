# Task 04 — iOS-style wizard header (shared component)

## Goal
One shared `WizardHeader` used by chat, review, and report: real back chevron + title, not a text-only "‹ Salir". The bottom "Exit to home, draft saved locally" bar is deleted.

## Design (locked by user request)
- `WizardHeader({ step, title, onBack })`: 56px row — left 48px `ChevronLeft` icon button (iOS-style back), center step/title text (`Paso 1 de 2 · Chat`), right slot (see Task 05).
- Back behavior reuses Task 01 stack: chat→Inicio, review→chat, report→review (or Inicio if arrived directly — track entry point via wizard param, default Inicio).
- `App.tsx`: delete the `exitbar` footer entirely (drafts are write-through in SQLite; the bar was the workaround for missing back nav, now redundant).
- Apply to `ReviewScreen` (replaces plain `Revisar inspección` title row) and `ReportScreen` (replaces `‹ Inspecciones` text row) with matching heights/padding so the wizard feels like one flow.
- i18n: new keys (`wizardStep1`, `wizardStep2`, `wizardReport`, `back`) in `strings.ts` ES/EN; `useStrings()` only, no literals.

## Files
- New: `frontend/src/components/WizardHeader.tsx`
- Edit: `frontend/App.tsx` (delete exitbar), `ChatCaptureScreen.tsx`, `ReviewScreen.tsx`, `ReportScreen.tsx`, `src/i18n/strings.ts`

## Acceptance
- [ ] All three wizard steps show the same header anatomy; back chevron ≥48px, works first tap.
- [ ] No "Exit to home" footer anywhere; no text-only back affordances.
- [ ] ES/EN toggle flips header strings.
