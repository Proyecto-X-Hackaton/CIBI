# F04_VALIDATION_AND_DEDUP — follow-ups, duplicates, confidence, freshness

> Goal: turn observations into *trusted* data. Jury: Track1 "Intelligent Validation" + Innovation trust-delta.

## Frontend alone (Expo + `@qvac/sdk`)
- **Follow-ups (max 2):** rule picks the most valuable missing field (manufacturer > age > qty) → MedPsy generates ONE question ("¿Fabricante del CT?") → answer patches JSON, confidence upgrades `Unknown→Reported`.
- **Dedup:** `loadModel({GTE small embedding})` → `ragIngest` local workspace of existing items for this customer → `ragSearch` new item → similarity >0.85 surfaces "¿Es el mismo MR que…?" with merge/keep-both. Fallback: keyword overlap if embedding model unloaded. Built-in RAG workspace is prototype-grade per docs — fine for 48h, disclosed.
- **Confidence/freshness chips:** per item `Confirmed|Reported|Estimated|Unknown` + `fresh (<30d) | stale (>180d)` based on `observed_at`. Stale rows get "re-verificar" nudge.

## Backend alone (DRF, zero inference)
- Stores `supersedes`, `merged_into`, `confidence`, `observed_at`; `GET /api/customers/:id/360/` returns history + freshness computed from dates (arithmetic, not AI). Duplicate candidates from the phone are stored as links, never auto-merged server-side.

## Together
`structured JSON → local follow-up loop → local dedup search → user resolves → POST with links → 360 shows lineage` — trust is built on-device, audited on-server.

## Acceptance (P0)
- [ ] "Two CTs" triggers ≤2 questions and upgrades confidence on answer.
- [ ] Re-submitting the same MR warns instead of duplicating.
- [ ] 360 shows where each fact came from + when.
