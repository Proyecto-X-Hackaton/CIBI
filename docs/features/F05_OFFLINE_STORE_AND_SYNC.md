# F05_OFFLINE_STORE_AND_SYNC — SQLite outbox → repositorio DRF (inspecciones + informes)

> Goal: 100% útil sin conectividad; sincroniza cuando puede. Jury: Track2 "useful offline" + Track1 Store.
> Vocabulario: **inspección** (entidad editable) → **informes v1..n** (reportes versionados por inspección). Endpoint canónico `/api/inspections/` (alias legacy `/api/visits/` deprecated).

## Frontend alone (Expo)
- `expo-sqlite` (única fuente de verdad estructurada) + `expo-file-system` (binarios). **Nada vive solo en memoria**: cada turno del chat, foto, audio y edición se escribe en SQLite/archivos en la misma interacción (write-through), así cerrar/matar la app nunca pierde un borrador.
- Tablas: `inspections{client_uuid PK, customer, city, country, author, observed_at, status:BORRADOR|PENDING|SYNCED, updated_at}` · `messages{inspection_id, seq, role:user|assistant, text_original, lang, text_en, audio_ref NULL, created_at}` · `photo_evidence{inspection_id, photo_ref, authorized, ocr_json, vision_json}` · `audio_clips{inspection_id, seq, file_ref, transcript_state}` · `observations{…structured_json, confidence_map}` · `report_versions{inspection_id, version, tier, json, provenance}` · `planned_visits{planned_uuid PK, site_id, date_label:manana|prox_semana|fecha, date, reason, status:planned|done|cancelled, synthetic:true}` · `outbox{client_uuid, entity:inspection|report|planned_visit, payload, status:PENDING|SYNCED, attempts, updated_at}`.
- Binarios: `FileSystem.documentDirectory/cibi/media/{photos,audio}/<client_uuid>-<seq>.<jpg|m4a>`; en SQLite solo el `*_ref` + hash + bytes. Límite P0: 1 foto por inspección (F02), audios cortos; si falta espacio, se bloquea grabar con mensaje (nunca se corrompe lo guardado).
- Boot/restore: al abrir, `SELECT` borradores + PENDING → Home muestra `Borrador / PENDING` y el chat restaura el historial completo (mensajes + fotos + audios). Crash-recovery: escrituras en transacción; outbox reintenta con backoff; conflicto: `updated_at` server gana, lo local se re-encola como nueva observación (nunca overwrite silencioso).
- Home/chat/revisar/informe/red leen local primero. Badge `SIN CONEXIÓN` vía `expo-network`. PDF (F06) se genera del JSON local: funciona en avión.

## Backend alone (DRF)
- Endpoints: `POST /api/inspecciones/`… canónico EN: `POST /api/inspections/`, `POST /api/observations/`, `POST /api/sync/push/`, `GET /api/sync/pull/?since=`, `GET /api/reports/:id/` (metadata de versiones + provenance, el PDF se genera en el teléfono). Upserts por `client_uuid`; agregados por ORM (conteos, cero IA). `seed_synthetic.py` carga sedes ficticias; admin = audit trail.
- DB: Postgres si hay, si no SQLite — documentar la elección (vale para 48h).

## Both together
`outbox PENDING → online → push → 200 con ids → SYNCED → pull → refresca informes/red` — la demo alterna modo avión a mitad de flujo.

## QVAC calls
- Ninguna en este feature (store/sync es CRUD). Los spans F09 viajan como metadata adjunta, no se computan aquí.

## Schema
`Inspection{client_uuid, customer, city, country, author, observed_at, status}` + `ReportVersion{inspection_id, version, tier, structured_json, provenance{tier, mode, peer_id}, perf_refs}` + `Outbox{payload, status, attempts}`.

## Acceptance (P0)
- [ ] Inspección → informe con modo avión ON de principio a fin.
- [ ] Agendar visita (Sedes → 📅 Mañana) offline persiste tras matar la app y aparece en Inicio → Esta semana con [Iniciar inspección].
- [ ] Iniciar inspección desde una agendada la marca done y linkea `inspection.planned_uuid`.
- [ ] Matar la app a mitad del chat (antes de sync) → al reabrir, borrador intacto: mensajes + foto + audio + tabla parcial.
- [ ] Reconectar sincroniza sin duplicados (idempotencia por `client_uuid`).
- [ ] Server sin dependencias IA (`requirements.txt` gate limpio).
