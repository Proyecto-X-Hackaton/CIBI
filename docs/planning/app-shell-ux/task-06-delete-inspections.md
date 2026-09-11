# Task 06 — Delete inspections (proposal + sync-safe)

## Goal
Users can delete inspections without corrupting Panel/Red aggregates or future sync.

## Proposed UX (recommendation — confirm before build)
- **Visible trash icon-button** (44px, `Trash2` icon) on each inspection card header row, next to status. NOT long-press-only (undiscoverable; hallway-test risk) — long-press on the card triggers the same sheet as a bonus.
- Tap → `Alert` confirm ("Eliminar «Hospital X»? Se borran chat, fotos, informe y pendientes de subida. Datos sintéticos de demo también se pueden eliminar.") → [Cancelar / Eliminar (destructive red)].
- Deletion is local-first and total: `deleteInspection(client_uuid)` removes `inspections`, `messages`, `photo_evidence` + media files under `cibi/media/photos|audio`, `audio_clips`, `observations`, `report_versions`, and PENDING `outbox` rows for that uuid; then `refreshPendings()` + list reload. Panel/Red recompute from SQLite so aggregates stay consistent automatically.
- **Sync safety**: enqueue an `inspection_delete` tombstone row in `outbox` (`{client_uuid, deleted_at, synthetic:true}`) so a future backend DELETE endpoint (or the Task 07 backend work) can honor it; `pushOutbox` routes unknown entities to `/api/sync/push/` already, so no client change needed beyond the entity name. Never silently resurrect via pull (pull is unimplemented — note in code).
- Seed demo data deletable like anything else (it's just rows); empty states already exist from app-fix Task 02.

## Files
- Edit: `frontend/src/db/database.ts` (new `deleteInspection()`), `frontend/src/screens/HomeScreen.tsx` (trash button + confirm), `src/i18n/strings.ts` (confirm copy ES/EN)

## Acceptance
- [ ] Delete → card disappears, Panel/Red counts drop, pending badge drops, no crash on re-enter.
- [ ] Media files for that inspection removed from disk (verify via file listing).
- [ ] Outbox holds an `inspection_delete` tombstone; push doesn't error on it.
- [ ] Deleting the seeded demo inspection leaves clean empty states (no Alpha ghosts).
