# Task 06 — Contrast QA + final gates

## Goal
Prove fixes on the physical device before delivery.

## Steps
1. Touch targets: audit all `TouchableOpacity` — min 44px (Salir/header/CTAs 48-56px). Fix `exitbar`, `tab`, `send`, `attach`, `chip`, `tier` styles.
2. Offline pass: airplane-mode capture→chat→review→report→panel on physical Android. Screenshot offline badge + disclaimer + confidence chips.
3. Gates: `tsc --noEmit` green, emoji grep clean, backend grep clean (no model libs), `qvac_compliance_check` PASS, `judge_feedback` all ≥6.
4. Update `README` top (video link placeholder + HW specs + model table from TIER_ROSTER) only if time — compliance artifact, not P0 for this fix batch.

## Files
- Edit: styles across screens (no logic)
- Evidence: screenshots + PERF_LOG rows

## Acceptance
- [ ] Salir + send + tabs all ≥44px, verified on device.
- [ ] Airplane-mode full flow works, no false data.
- [ ] Both compliance tools PASS.
