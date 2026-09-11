# Task 05 — Review CTA moves into the header (3-box layout)

## Goal
Delete the bottom `Pasar a revisar →` button; the header becomes `[back] [steps] [review]` per the requested 3-box horizontal layout.

## Design (locked by user request)
- `WizardHeader` right slot on chat step: compact primary button `Revisar` + `ClipboardCheck` (or `ArrowRight`) icon, 44px min, `onPress → setWizard({name:'review'})`.
- Depends on Task 04 (header component must exist first); implement as `right` prop so review/report steps can host their own primary actions later (e.g. report's Export — out of scope here, slot stays empty).
- Delete `ChatCaptureScreen` bottom `cta` block; keep composer (input+attach+send) as the only bottom element (also fixes Task 01/02 crowding).
- Disabled state: review button always enabled (review handles empty-evidence state already with "Sin entidades"); no dead ends.

## Files
- Edit: `frontend/src/components/WizardHeader.tsx` (right slot), `frontend/src/screens/ChatCaptureScreen.tsx` (delete bottom cta, pass right prop)
- Icon: add `ClipboardCheck` (verify name in installed lucide version) to `Icon.tsx` map

## Acceptance
- [ ] Chat has no bottom CTA; header shows back + steps + Revisar button in one 56px row.
- [ ] Revisar reachable in one tap from chat; BackHandler + header back both return to chat (Task 01).
- [ ] No layout overflow at 360px width (Spanish "Revisar" is short — safe).
