# Task 02 — Real SQLite data, zero hardcoded demo content

## Goal
Every number/list on screen derives from `expo-sqlite` observations + `planned_visits`. Seed stays as synthetic fallback with badge, never as the presented truth.

## Steps
1. `PanelScreen`: drop `useState({MR:3...})` initial false totals. Init zeros + `loading` flag. Aggregate from `listInspections()+getLatestObservation()`. Show "Sin datos — crea una inspección" empty state. Add `synced/pending` from `pendingCount()`.
2. `NetworkScreen`: stop importing `SEED_SITES` as truth. Build site list from `listInspections()` grouped by customer/city/country + counts from latest observations. Seed sites shown only under "Demo sintético" section when DB is empty. Hero "Próxima acción" derives from max-aging item (>7y) or most-incomplete inspection; `Agendar` uses that site_id, not hardcoded Alpha.
3. `ReportScreen`: `customer` init `null`, loaded from `getInspection()`. No 'Hospital Alpha' default. Empty state when no versions.
4. `ReviewScreen`: dedup `existingLabels` built from other inspections' items (same modality), not hardcoded `MR-2-jun`. Remove `'two CTs'` fallback — empty text → "Sin entidades" state.
5. `HomeScreen`: implement `Sin informe` (inspections with zero report_versions) and `Re-verificar` (items with Unknown/Estimated) filters for real.
6. Every synthetic row renders "sintético" badge (already in schema `synthetic:1`).

## Files
- Edit: `PanelScreen.tsx`, `NetworkScreen.tsx`, `ReportScreen.tsx`, `ReviewScreen.tsx`, `HomeScreen.tsx`, maybe `db/database.ts` (add `listObservationsForDedup` helper).

## Acceptance
- [ ] Fresh install with empty DB (comment out `ensureSeed` temporarily): all screens show empty states, zero Alpha mentions.
- [ ] Create 1 inspection → Panel/Red/Informe update without reload.
- [ ] No `Hospital Alpha` literal in any screen except seed.ts.
