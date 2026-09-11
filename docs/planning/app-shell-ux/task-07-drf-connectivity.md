# Task 07 — DRF connectivity (phone → PC backend)

## Goal
Typing the PC's LAN IP in Ajustes actually connects: health green, outbox pushes without 400/404.

## Root causes (verified — stacked, all must be fixed)
1. **Backend has no endpoints.** `config/urls.py` exposes ONLY `admin/` + `api/health/`. `api/views.py` and `api/models.py` are empty stubs. The app POSTs to `/api/inspections/`, `/api/observations/`, `/api/planned-visits/` and GETs `/api/sites/`, `/api/dashboard/summary/` → all 404 even on a perfect network.
2. **`ALLOWED_HOSTS = []`** (`config/settings.py:28`). With `DEBUG=True` Django serves localhost only; requests to the PC's LAN IP (e.g. `http://192.168.x.x:8000`) → `400 DisallowedHost`. The app's `checkHealth` returns false → generic "Sin servidor".
3. **Android blocks cleartext HTTP.** `app.json` has no `usesCleartextTraffic`; Android 9+ silently drops `http://` LAN traffic → timeout, same generic alert. Fix via `expo-build-properties` (`android.usesCleartextTraffic: true`) + prebuild. (HTTPS on LAN is out of scope for 48h.)
4. **Ops unknowns on the PC side**: `runserver` defaults to `127.0.0.1` (unreachable from phone — must be `0.0.0.0:8000`); PC firewall may block inbound 8000; phone and PC must share the same Wi-Fi/LAN.
5. **Blind error UX**: `checkHealth`/`pushOutbox` swallow the cause (`catch → false/break`). A 400, 404, timeout, and unreachable host all show the same "Sin servidor", making this undebuggable on-device.

## Steps
1. Backend (CRUD only, zero inference — grep gate stays):
   - `ALLOWED_HOSTS = ['*']` (demo only, comment as such).
   - Minimal models mirroring the app payload: `Inspection(client_uuid PK, customer, city, country, author, observed_at, status, synthetic, updated_at)`, `Observation(inspection FK, structured_json, confidence_map, tier, provenance)`, `PlannedVisit(planned_uuid PK, site_id, date_label, date, reason, status, synthetic)`. `makemigrations + migrate`, register in `admin.py` (jury "trusted data" story).
   - Endpoints: `POST /api/inspections/` (upsert by `client_uuid`), `POST /api/planned-visits/` (upsert), `POST /api/observations/` (create), `POST /api/sync/push/` (accept `{entity, payload}`, 200), `GET /api/sites/` + `GET /api/dashboard/summary/` (aggregate from DB, empty-safe). All accept/return `synthetic` untouched.
2. App: `expo-build-properties` add `android.usesCleartextTraffic: true`; `npx expo prebuild`; document the exact run command.
3. App diagnostics: `checkHealth` returns `{ok, reason}` (`timeout | http_400 | http_404 | unreachable | ok`) and Settings shows the reason + attempted URL + a 4-step checklist (same Wi-Fi / `0.0.0.0:8000` / firewall / IP). `pushOutbox` surfaces per-row HTTP status instead of silent break.
4. Runbook (README + Settings helper text): PC runs `python manage.py runserver 0.0.0.0:8000`, phone uses `http://<PC-LAN-IP>:8000`, verify from phone browser first (`http://IP:8000/api/health/` should show `{"status":"ok"}`).

## Files
- Edit: `backend/config/settings.py`, `backend/config/urls.py`, `backend/api/models.py`, `backend/api/views.py`, `backend/api/admin.py`, new migration
- Edit: `frontend/app.json` (via build-properties), `frontend/src/api/backend.ts`, `frontend/src/screens/SettingsScreen.tsx`
- Deps: none (no new backend libs — allowlist unchanged)

## Acceptance
- [ ] Phone browser to `http://PC-IP:8000/api/health/` returns `{"status":"ok"}`.
- [ ] Ajustes → Guardar + sincronizar: green, pushed count matches outbox, rows visible in DRF admin.
- [ ] Wrong IP / stopped server → specific reason shown (not generic "Sin servidor").
- [ ] `grep -ri "torch|transformers|openai" backend/` still empty (excluding comments); `qvac_compliance_check` PASS.
