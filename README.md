# CIBI — Customer Installed-Base Intelligence (on-device)

Offline-first mobile app for hospital field visits: **one visit → trusted installed-base intelligence, entirely on-device** via `@qvac/sdk` on a physical Android phone. The Django REST backend is CRUD/sync/aggregates only — **zero inference outside the phone**.

> ⚠️ **Alcance médico:** "Extracción de inventario de equipamiento. No es diagnóstico clínico."
> Equipment-inventory entity extraction ONLY. This app makes no diagnostic, symptom or treatment claims (ES/PT/EN). Confidence labels (`Confirmed | Reported | Estimated | Unknown`) are data-quality signals, never clinical assertions.

## Demo video (≤5 min, Spanish)

<!-- TODO(video): replace with the public link (no login) before submitting -->
- **Link:** _PENDIENTE — insertar enlace público sin login antes de la entrega_

## Pre-existing base (declared per hackathon T&C)

The only project the team had built / had access to **before** the 48h window (Sep 9 08:00 → Sep 11 08:00, America/Panama):

- **[Proyecto-X-Hackaton/QVAC-MCP](https://github.com/Proyecto-X-Hackaton/QVAC-MCP)** — shared Model Context Protocol server (Python + FastMCP + UV) that exposes QVAC documentation, track briefs and compliance-check tools to coding agents. It is agent tooling/docs access only: **no app code, no screens, no backend, no model pipeline from it is reused in CIBI.**

Everything in this repository — planning docs, Expo/React Native frontend, DRF backend, synthetic seed, video — was produced inside the 48h hackathon window. No other pre-existing codebase was used.

## Submission targets

One repo fusing three tracks: **General** (sovereign intelligence at the edge — basement-no-signal, sensitive data never leaves the phone), **Track 1** (Capture→Understand→Structure→Validate→Store→Visualize→Insight), **Track 2** (official Psy models — MedPsy / VisionPsy / TranslatePsy — ARE the pipeline, `@qvac/sdk` for all inference + RAG).

## Happy path (the judged user workflow, fully offline)

1. Engineer speaks/types in ES/PT → **TranslatePsy** normalizes to EN (original kept).
2. Snap 1 permitted photo → **VisionPsy-Nano-460M-Flash** (modality) + **ONNX OCR** (label text).
3. **MedPsy-1.7B** structures equipment entities (MR/CT/US, maker, qty, age) with per-field confidence.
4. App asks ≤2 follow-ups, warns on duplicates, stores locally.
5. Customer-360 + geo drill-down + dashboard update with **zero connectivity** (airplane mode demo).

Optional, never judged: a second pass from a reachable **local** QVAC peer (workstation, `@qvac/sdk`) with larger models — always opt-in, versioned (v+1, never silent replace), with local fallback. Never cloud.

## Architecture (THE integration rule)

```
PHONE (Expo + @qvac/sdk)              SERVER (DRF, no AI)
TranslatePsy / VisionPsy / MedPsy  →  receives structured JSON only
embeddings + RAG workspace         ←  serves aggregates
SQLite outbox ──HTTP JSON──────────▶  NEVER calls any model
```

Cloud inference = instant DQ. The non-AI REST API may be hosted anywhere (here: LAN demo).

## On-device model roster (exact names, quantizations, engines)

Canonical `TIER_ROSTER` / `qvac.config.json` — verified against `@qvac/sdk` ^0.19.0 (2026-09-10):

| Pipeline role | Exact model constant | Quant / format | QVAC engine |
|---|---|---|---|
| TranslatePsy ES→EN | `BERGAMOT_ES_EN` | Bergamot NMT | nmt |
| TranslatePsy PT→EN | `BERGAMOT_PT_EN` | Bergamot NMT | nmt |
| VisionPsy (image understanding) | `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` + matched mmproj pair (Flash; `image_no_upscale:'on'`) | Q8_0 GGUF + mmproj | llamacpp (multimodal) |
| OCR (nameplate text) | `OCR_LATIN` | ONNX detector/recognizer | onnx-ocr |
| MedPsy (entity structuring) | `HEALTHCARE_1_7B_MEDICAL_Q4_K_M` (MedPsy-1.7B) | Q4_K_M GGUF | llamacpp-completion |
| Embeddings | `GTE_LARGE_FP16` | FP16 | embeddings |
| Voice input (optional P1 stretch; typed input is P0) | `PARAKEET_TDT_0_6B_V3_Q8_0` | Q8_0 | whisper/parakeet |
| Peer enhancement (optional, NOT in judged flow) | `HEALTHCARE_4B_MEDICAL_Q4_K_M` + Qwen3.5-4B GGUF | Q4_K_M | local workstation via `@qvac/sdk` |

Lifecycle is always `loadModel → infer → unloadModel`, one model resident at a time. The built-in RAG workspace (`ragIngest`/`ragSearch`) is used for prototyping only, as documented by QVAC — disclosed here per T&C.

## Hardware specs

| Tier | Hardware |
|---|---|
| Judged (phone) | Physical Android 13 device, 12 GB RAM (exact `Build.MODEL` recorded in `PERF_LOG.jsonl` at smoke test). `minSdkVersion` 29. llamacpp fails on emulators — a physical device is required; Expo Go unsupported, dev build via `npx expo prebuild`. |
| Optional peer | Local workstation running a QVAC instance via `@qvac/sdk` (larger MedPsy-4B). Never cloud, never in the judged flow. |

Dev environment: Node ≥ 22.17, Python ≥ 3.10, `qvac doctor` green.

## Remote APIs & third-party services (full disclosure)

| Remote call | When | AI inference? |
|---|---|---|
| _None in the judged flow_ — capture → structure → validate → store → visualize works in airplane mode | always | — |
| LAN-only DRF server (`http://<PC-LAN-IP>:8000`) | opt-in sync when Wi-Fi exists | **No** — CRUD/sync/aggregates only, zero AI libraries |
| Local QVAC peer (workstation on same LAN) | opt-in quality pass, versioned, local fallback | Yes, but on a local machine via `@qvac/sdk` — never cloud |

No cloud APIs, no third-party SDKs, no analytics/telemetry. Sensitive data never leaves the phone unless the user explicitly syncs structured (non-AI) records to their own LAN server.

## Performance log

`PERF_LOG.jsonl` (delivery artifact): one JSONL row per inference span —
`{ts, device, tier, model, quant, engine, phase, prompt_chars, tokens_in, tokens_out, ttft_ms, throughput_tps, load_ms, ctx_size, mode: offline|peer, peer_id, ok}`
— covering model load, prompts, token counts, TTFT and throughput for every model above. The same `TIER_ROSTER` feeds the UI ⓘ details, this README and the PDF report so names can never diverge.

## Data policy

**Synthetic data only:** fictional hospitals, sites and manufacturers; every record carries `synthetic: true` (seed: `frontend/src/db/seed.ts`). No real patient or hospital data. One permitted photo per visit stays on-device.

## Setup

1. Prereqs: Node ≥ 22.17, Python ≥ 3.10, QVAC CLI with `qvac doctor` green, a physical Android device (USB debugging enabled) on the same Wi-Fi as your PC for the optional sync demo.
2. Frontend (phone): `cd frontend && npm install && npx expo prebuild && npx expo run:android --device`
   - `app.json` already includes `expo-build-properties` (Android `minSdkVersion: 29`, `usesCleartextTraffic: true`) and `@qvac/sdk/expo-plugin`.
3. Backend (optional LAN sync): see runbook below. `backend/requirements.txt` contains **no AI libraries** (grep gate: `torch|transformers|openai` must return empty).

## Backend LAN runbook (phone → PC)

The DRF backend is CRUD/sync only — zero inference (no AI libraries in `backend/requirements.txt`). All judged inference runs on the phone via `@qvac/sdk`.

1. PC: `cd backend && .venv/bin/python manage.py migrate && .venv/bin/python manage.py runserver 0.0.0.0:8000`
   - `0.0.0.0` is required: the default `127.0.0.1` is unreachable from the phone.
   - Optional (jury "trusted data" view): `.venv/bin/python manage.py createsuperuser`, then `/admin/`.
2. Phone and PC on the same Wi-Fi; PC firewall must allow inbound port 8000.
3. From the **phone browser** first: `http://<PC-LAN-IP>:8000/api/health/` must return `{"status":"ok"}`.
4. In the app: Ajustes → Servidor DRF → `http://<PC-LAN-IP>:8000` → Guardar + sincronizar. Failures show a specific reason (timeout / HTTP 400 / HTTP 404 / unreachable) + attempted URL + LAN checklist.
5. `ALLOWED_HOSTS = ['*']` in `backend/config/settings.py` is demo/LAN-only — never deploy like that.

Endpoints: `GET /api/health/` · `POST /api/inspections/` (upsert by `client_uuid`) · `POST /api/planned-visits/` (upsert) · `POST /api/observations/` (create, also accepts the phone's `report` payload) · `POST /api/sync/push/` (`{entity, payload}`; honors `inspection_delete` tombstones) · `GET /api/sites/` · `GET /api/dashboard/summary/`.

## Android cleartext note

`app.json` sets `android.usesCleartextTraffic: true` via `expo-build-properties` so a physical Android can reach `http://<PC-LAN-IP>:8000` (Android 9+ blocks cleartext by default). After changing it: `cd frontend && npx expo prebuild && npm run android` (rebuild + reinstall the dev build on the device). HTTPS on LAN is out of scope for 48h.

## License

[Apache-2.0](LICENSE) — open permissive license as required by Track 2.
