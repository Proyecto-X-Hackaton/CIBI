# F08_DASHBOARD_AND_NL_ANALYTICS — insights + refresh opportunities

> Goal: prove observations become *actionable*. Jury: Track1 Dashboard + Innovation metric.

## Frontend alone (Expo + `@qvac/sdk`)
- Cards: by-modality counts, by-age (>7y, >10y), incomplete-record list, recently-updated, confidence/freshness distribution, **refresh-opportunity card** ("2 MR 8–10y en Alpha → oportunidad de renovación") + **trust-delta** ("3 campos Reported→Confirmed esta semana").
- NL query (1 pattern, on-device): "clientes en Brasil con MR de más de 7 años" → embedding/RAG retrieval over local aggregate rows → MedPsy formats the answer + cites customer IDs. RAG ground = local SQLite rows fed as context (no server inference).

## Backend alone
- `GET /api/dashboard/summary/` pre-computes the same cards with ORM filters (modality, age_years__gte, confidence, updated_at). NL query never hits the server as AI — if online, server just returns rows; ranking/formatting stays on-device.

## Together
Dashboard renders server summary online / local summary offline; NL box always runs locally against whichever rows are cached.

## Acceptance (P0)
- [ ] Seed contains 1 aging-MR opportunity; card appears with customer link.
- [ ] Canonical NL query returns Alpha with citation, offline.
