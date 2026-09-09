# F05_OFFLINE_STORE_AND_SYNC — SQLite outbox → DRF repository

> Goal: fully useful with zero connectivity; sync when possible. Jury: Track2 "useful offline" + Track1 Store.

## Frontend alone (Expo)
- `expo-sqlite` tables mirror server entities + `outbox(status:PENDING|SYNCED, payload, attempts)`. Capture→Review→360 all read local first. Persistent `SIN CONEXIÓN` badge via `expo-network`.
- Retry with backoff; conflicts: server `updated_at` wins, local re-queued as new observation (never silent overwrite — trust story).

## Backend alone (DRF)
- Endpoints: `POST /api/visits/`, `POST /api/observations/`, `POST /api/sync/push/`, `GET /api/sync/pull/?since=`. Upserts by `client_uuid`; aggregates computed with ORM (counts, no AI). `seed_synthetic.py` loads 6 fictional facilities; admin shows audit trail.
- DB: Postgres if available, else SQLite — either is fine for 48h; document the choice.

## Together
`outbox PENDING → online → push → 200 with server ids → mark SYNCED → pull → refresh 360/map` — demo toggles airplane mode mid-flow to prove it.

## Acceptance (P0)
- [ ] Full visit → 360 with airplane mode ON from start to finish.
- [ ] Reconnect syncs without duplicates (idempotency keys).
- [ ] Server has zero AI dependencies (`requirements.txt` gate).
