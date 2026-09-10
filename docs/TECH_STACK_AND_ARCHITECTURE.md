# TECH_STACK_AND_ARCHITECTURE — CIBI

> Verdict on "React + Python mandatory?": **NO — not in any brief.** Verified against `track_detail(general)`, `track_detail(track1)`, `track_detail(track2)`, `hackathon_rules`. The only hard stack rule is: **QVAC SDK for inference, on-device/P2P, no cloud inference (instant DQ)**; Track 2 additionally names **`@qvac/sdk` (JS/TS) for all core inference + RAG**. So the proposed stack below is not required — but it is *optimal* for compliance, and we lock it.

## 1. Locked stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **React Native + Expo SDK 54** (`blank-typescript@sdk-54`), TypeScript | Only QVAC mobile path (JS/TS SDK → Expo). Web-capable for dashboard fallback, but **judged flow runs on a physical device** (llamacpp cannot run on emulators). |
| On-device AI | **`@qvac/sdk` (^0.19.0) in the app, nothing else** | Track 2 literal requirement. The phone is the complete, judged offline path; all core inference + RAG works without a network. |
| Optional trusted peer | **Separate QVAC peer runner on the workstation** | P1 quality enhancement only. It may run larger local models through the supported QVAC/P2P path; it is never Django, never cloud, and never required for capture→informe. |
| Backend | **Python + Django REST Framework** | Team choice. Role is **structured repository + sync + aggregation ONLY (zero inference)**. Cloud-hosting a non-inference API is explicitly allowed. Provides admin + ORM for Customer/Observation/Equipment fast. |
| On-device store | **expo-sqlite (queue + cache) → DRF / Postgres (or SQLite on server for 48h)** | Offline-first: capture works with airplane mode; sync upserts when online. |
| Map | Offline list drill-down first; `react-native-maps` tiles only as enhancement | Basement has no tiles; list must carry the demo. |
| License | **MIT or Apache-2.0** (Track 2 demands open permissive; General does not — Track 2 wins) | Add `LICENSE` + HW specs + setup + perf log. |

> DRF vs FastAPI note: FastAPI would be lighter for 48h, but DRF admin pays off for the jury's "trusted data" story (audit trail view). Keep DRF, but cap it at ~6 endpoints (see §4). No ML libraries in backend requirements — a reviewer must be able to `grep -ri "torch|transformers|openai" backend/` and get zero hits outside comments.

## 2. The one integration rule (DQ guardrail)

```
PHONE (Expo + @qvac/sdk)          OPTIONAL PEER (workstation)       DRF SERVER
┌────────────────────────┐        ┌────────────────────────┐      ┌────────────────────┐
│ mic/camera/text input  │        │ QVAC runtime, separate  │      │ CRUD only:         │
│  → TranslatePsy        │        │ process, local models   │      │ visits/items/sync/  │
│  → VisionPsy + OCR     │        │ MedPsy-4B / Qwen*       │      │ aggregates         │
│  → MedPsy-1.7B         │        │ supported P2P only      │      │ NEVER inference    │
│  → catalog + RAG       │        └───────────▲────────────┘      └─────────▲──────────┘
│  → SQLite outbox       │                    │ optional peer result       │ JSON only
└───────────┬────────────┘                    │                            │
            ├── offline result ──────────────┘                            │
            └─────────────────────────────────────────────────────────────┘
                         * exact Qwen model/quant must be pinned before use
```

- QVAC worker runs **in the app process** (Bare worker over `bare-rpc`, `react-native-bare-kit`) for the primary path. The phone remains useful in airplane mode.
- The optional peer is **not the backend**. It must use a supported QVAC/P2P delegation surface and `@qvac/sdk`; the current QVAC docs confirm local/P2P applications and peer model distribution, but peer inference must be verified before implementation. If that surface is unavailable, omit peer mode rather than route inference through Django.
- The peer receives the minimum permitted payload by default: normalized text, OCR text, on-device VisionPsy summary, candidate JSON, and catalog entry IDs. Raw photos/audio stay on the phone unless an explicit trusted-peer policy enables them.
- `qvac serve --openai` / OpenAI-compatible server is a development convenience only — **never the judged peer path**.
- Python SDK (`tetherto-qvac-sdk`) is **not used in the judged flow** (Track 2 says `@qvac/sdk`). Document this choice explicitly so a juror doesn't flag "two SDKs".
- Django receives already-structured JSON and provenance; it never receives a prompt to infer, loads a model, or selects a model.

## 3. QVAC runtime facts baked into the design (from docs)
- **Physical device only — primary target: Android** (`expo run:android --device`); emulators fail on llamacpp. Declare ONE exact device model (e.g. Galaxy S25 Ultra SM-S938B, iOS deferred) + quantizations in F09.
- `app.json` plugins: `expo-build-properties` (Android `minSdkVersion: 29`) + `@qvac/sdk/expo-plugin`; `npx expo prebuild` required.
- `qvac.config.json` enables **only needed plugins** (`llamacpp-completion`, `nmt`, `whisper/parakeet`, `onnx-ocr`, `embeddings`) to keep the bundle lean.
- Model lifecycle is always `loadModel → infer → unloadModel`, **one model resident at a time** (RAM < 4GB kills parallel loads). Every inference screen shows load/TTFT/throughput into the perf log.
- **VisionPsy-Nano Flash vs Base**: separate weights+mmproj pairs; Flash needs `modelConfig.image_no_upscale: 'on'`, Base leaves it unset. Wrong pairing silently degrades quality — F02 pins the pair.
- **RAG**: built-in workspace (`ragIngest`/`ragSearch`) is *prototype-only* per docs; production path is external DB (SQLite-vector/Chroma). For 48h: built-in workspace on-device for dedup, NL filter, and retrieval from the bundled equipment catalog.
- **Peer boundary**: the phone's local result is returned immediately; an optional peer result is an enhancement with a timeout and automatic local fallback. The peer must not make the offline workflow dependent on a network.
- Node ≥22.17, Python ≥3.10, `qvac doctor` green on the phone and workstation.

## 4. Model roster (exact `@qvac/sdk` constants — verified against SDK 0.19.0 registry, 2026-09-10)

| Role | Constant (`@qvac/sdk`) | Resolves to | Size | Runs on | Fallback |
|---|---|---|---|---|---|
| Normalize ES→EN | `BERGAMOT_ES_EN` (engine `nmtcpp-translation`) | `bergamot-esen … intgemm.bin` | ~32MB | phone CPU | keep original, flag `untranslated` |
| Normalize PT→EN | `BERGAMOT_PT_EN` | `bergamot-pten … intgemm.bin` | ~32MB | phone CPU | same |
| See label/room | `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` + `MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0`, `image_no_upscale:'on'` | `qvac/VisionPsy-Nano-460M-Flash-GGUFs` pair | ~437+109MB | phone GPU, else CPU | OCR-only path |
| Read label text | `OCR_LATIN` (engine `ggml-ocr`) | `latin_g2.gguf` | ~15MB | phone CPU | VisionPsy description only |
| Hear engineer (stretch) | `PARAKEET_TDT_0_6B_V3_Q8_0` | parakeet-tdt-0.6b-v3 | ~750MB | phone | typed input (voice is stretch) |
| Structure entities | `HEALTHCARE_1_7B_MEDICAL_Q4_K_M` (= `qvac/MedPsy-1.7B-GGUF` → `medpsy-1.7b-q4_k_m-imat.gguf`) | llamacpp, ctx 4096 | ~1.28GB | phone | VisionPsy+regex structuring, disclose downgrade |
| Optional peer structuring | `HEALTHCARE_4B_MEDICAL_Q4_K_M` (= MedPsy-4B, 2.7GB; Q8_0 = 4.7GB) | exact ctx tested on peer | 2.7–4.7GB | trusted workstation peer | phone 1.7B result |
| Optional peer fluency | Qwen3.5-4B GGUF (`lmstudio-community/Qwen3.5-4B-GGUF`, Apache-2.0) | exact file+quant pinned at peer setup | ~2–3GB | trusted workstation peer | MedPsy-4B or phone result |
| Dedup / NL filter | `GTE_LARGE_FP16` (engine `llamacpp-embedding`, 1024-dim) | gte-large fp16 | ~670MB | phone | keyword overlap scoring |

## 5. API contract (DRF owns storage, app owns intelligence)

```
POST /api/inspections/            {customer_name, city, country, observed_at, author}
POST /api/planned-visits/         {client_uuid, site_id, date_label: manana|prox_semana|fecha, date, reason, status: planned|done|cancelled, synthetic:true}
GET  /api/planned-visits/         → lista para "Esta semana" (orden por fecha)
POST /api/observations/           {inspection_id, raw_text_original, raw_text_en, photo_ref,
                                   structured_json, confidence_map, model_cards[], perf_spans[],
                                   inference_provenance}
GET  /api/reports/:id/          → informe: items + confianza + frescura + historial de versiones
GET  /api/geo/?level=country|city → drill-down aggregates
GET  /api/dashboard/summary/      → by_modality, aging_7y+, incomplete, recent
POST /api/sync/push/  +  GET /api/sync/pull/?since=
```

Every `structured_json` carries `confidence: Confirmed|Reported|Estimated|Unknown` per item/field, `source: voice|text|photo|ocr|catalog`, and `synthetic: true` for observed demo records.

`inference_provenance` records `{mode: offline|peer, model, quant, context_size, runtime, device, peer_id?, fallback_reason?}`. A peer result must never overwrite a local result without an explicit user-visible choice.

## 6. Data entities (mirrors Track 1 §2 field list)
`Customer(facility, city, country)` → `Visit` → `Observation(raw, normalized, author, date, source_type)` → `EquipmentItem(modality, manufacturer, model, qty, age_text, age_years, confidence, freshness)` + `PerfSpan(model, quant, device, mode, load_ms, ttft_ms, tokens_in/out, throughput_tps)`.
`PlannedVisit(planned_uuid, site_id, date_label, date, reason, status:planned|done|cancelled, synthetic:true)` es compromiso local (sin calendario OS en P0): se crea con 1 tap desde Sedes, vive en SQLite + outbox, sube por CRUD. Completarla = iniciar inspección linkeada (`inspection.planned_uuid`).

`EquipmentCatalogEntry(entry_id, modality, manufacturer, family, aliases, point_of_interest[], photo_priority[], staff_question[], age_marker[], catalog_version)` is bundled locally and is reference knowledge, not a hospital observation. Catalog matches and guidance are deterministic facts first; a model may summarize them but may not invent missing machine-specific facts.
