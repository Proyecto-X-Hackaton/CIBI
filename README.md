# CIBI

Customer Installed-Base Intelligence — offline-first field-visit capture with on-device AI (`@qvac/sdk`). Full README (video, models, HW specs) lands at delivery; this is the working runbook.

## Backend LAN runbook (phone → PC, task-07)

The DRF backend is CRUD/sync only — zero inference (no AI libraries in `backend/requirements.txt`). All judged inference runs on the phone via `@qvac/sdk`.

1. PC: `cd backend && .venv/bin/python manage.py migrate && .venv/bin/python manage.py runserver 0.0.0.0:8000`
   - `0.0.0.0` is required: the default `127.0.0.1` is unreachable from the phone.
   - Optional (jury "trusted data" view): `.venv/bin/python manage.py createsuperuser`, then `/admin/`.
2. Phone and PC on the same Wi-Fi; PC firewall must allow inbound port 8000.
3. From the **phone browser** first: `http://<PC-LAN-IP>:8000/api/health/` must return `{"status":"ok"}`.
4. In the app: Ajustes → Servidor DRF → `http://<PC-LAN-IP>:8000` → Guardar + sincronizar. Failures show a specific reason (timeout / HTTP 400 / HTTP 404 / unreachable) + attempted URL + LAN checklist.
5. `ALLOWED_HOSTS = ['*']` in `backend/config/settings.py` is demo/LAN-only — never deploy like that.

Endpoints: `GET /api/health/` · `POST /api/inspections/` (upsert by `client_uuid`) · `POST /api/planned-visits/` (upsert) · `POST /api/observations/` (create, also accepts the phone's `report` payload) · `POST /api/sync/push/` (`{entity, payload}`; honors `inspection_delete` tombstones from task-06) · `GET /api/sites/` · `GET /api/dashboard/summary/`.

## Android cleartext note

`app.json` sets `android.usesCleartextTraffic: true` via `expo-build-properties` so a physical Android can reach `http://<PC-LAN-IP>:8000` (Android 9+ blocks cleartext by default). After changing it: `cd frontend && npx expo prebuild && npm run android` (rebuild + reinstall the dev build on the device). HTTPS on LAN is out of scope for 48h.
