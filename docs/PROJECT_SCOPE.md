# PROJECT_SCOPE — CIBI (Customer Installed-Base Intelligence, on-device)

> One workflow, three tracks. Status: PLANNING ONLY (no code yet).
> Sources: `track_detail(general/track1/track2)` + `hackathon_rules` + QVAC docs (Expo, JS/TS SDK, Python SDK, Psy models, RAG, translation, multimodal, OCR, transcription). Full context loaded 2026-09-09.

## 1. Unifying concept (locked)

**Offline-first mobile app for hospital field visits that turns one visit into trusted installed-base intelligence on the phone, with an optional trusted QVAC peer for higher-quality assistance when a local workstation is reachable.** The phone remains complete and useful with no network.

Single happy path (the only story the 5-min video tells):

1. Engineer opens visit → speaks/types in Spanish or Portuguese → **TranslatePsy** normalizes to English for the pipeline (original always kept).
2. Snaps photo of equipment label/room (only where permitted) → **VisionPsy-Nano-460M-Flash** describes modality + **ONNX OCR** extracts label text.
3. **MedPsy-1.7B** parses domain language (MR/CT/ultrasound, manufacturer, qty, age) into structured JSON with confidence per field: `Confirmed | Reported | Estimated | Unknown`.
4. App asks 1–2 follow-up questions for the most valuable missing field, runs duplicate check, stores locally.
5. Informe + Red + panel actualizados al instante — con cero conectividad.

Optional enhancement, never a dependency: when the engineer explicitly trusts a reachable local QVAC peer, the phone can request a second structuring/guidance pass from a larger workstation model. The offline phone result remains available immediately and is never silently replaced.

Why it fuses without feeling forced: Track 1's brief *already asks* for conversational capture, multilingual teams (São Paulo example), and photo/label handling. Psy models plug genuine gaps; they are the pipeline, not decoration.

## 2. What "done" means (MVP slice — ruthless)

### P0 — must demo live on a physical phone, offline, in Spanish (48h)
- [ ] F01 multilingual capture: typed ES/PT → TranslatePsy → EN normalized + original kept (P0); voice (Parakeet/Whisper) is stretch, typed fallback carries the demo
- [ ] F02 photo capture: 1 photo → VisionPsy-Nano-Flash description + OCR blocks
- [ ] F03 structuring: MedPsy → JSON `{customer, city, country, items[{modality, manufacturer, model, qty, age_text, age_years}]}`, per-field confidence
- [ ] F04 validation: local catalog match + machine-specific photo priorities/staff questions + 1–2 follow-ups for the top missing field + duplicate warning (embedding similarity) + confidence chips
- [ ] F05 offline store+sync: on-device SQLite queue → Django REST upsert when online; works fully offline
- [ ] F06 Informe: reporte versionado por sede con items, confianza, frescura, historial + PDF offline
- [ ] F07 geo map: Region → Country → City → Customer drill-down (static tiles / offline list + map when online)
- [ ] F08 dashboard lite: counts by modality, aging (>7y), incomplete, recently updated + 1 NL query ("clientes en Brasil con MR de más de 7 años")
- [ ] F09 perf log + safety: structured log (model load, prompts, tokens, TTFT, throughput) + "no es diagnóstico clínico" disclaimer + offline badge
- [ ] Video ≤5 min (Spanish) + public repo + README with base declaration + MIT/Apache-2.0 LICENSE + setup + HW specs

### P1 — only if P0 is green on-device
- Optional trusted-peer quality mode: workstation-local MedPsy-4B and an exact, documented Qwen model candidate, using only a supported QVAC/P2P delegation surface.
- Peer result comparison, peer perf rows, speaker diarization note, multi-photo compare, LoRA fine-tune note, full NL analytics grammar.

### Explicitly removed
- Barcode/QR/DataMatrix reading, GTIN lookup, serial lookup, and online search fallback. Machine identification is photo/OCR + the bundled local catalog.

### OUT OF SCOPE (explicitly cut for 48h)
- Teams bot, real hospital data, real diagnosis or clinical claims, cloud inference of any kind, inference through Django or an arbitrary HTTP/OpenAI proxy, peer mode as a requirement for the judged flow, emulator support, iOS+Android parity (declare ONE primary test device), production-grade vector DB, auth/roles beyond a demo PIN.

## 3. Track coverage map

| Requirement | Where it lives |
|---|---|
| General: real problem, on-device/P2P inference, works where cloud can't | Hospital basement, no signal, complete phone path; optional trusted QVAC peer when reachable (F01–F05) |
| General: QVAC SDK, preferably QVAC models | `@qvac/sdk` owns phone inference; any peer enhancement must also use the supported QVAC/P2P path; 3 Psy models (F01–F03) |
| Track 1: Capture→Understand→Structure→Validate→Store→Visualize→Insight | F01→F02→F03→F04→F05→F06/F07/F08, exactly in order |
| Track 1: MVP (NL capture, extraction, storage, customer view, aggregation) | F01, F03, F05, F06, F08 |
| Track 1: synthetic data only | `backend/seed_synthetic.py` — fictional hospitals/manufacturers only |
| Track 2: ≥1 Psy model central | 3 Psy models ARE the pipeline (F01–F03) |
| Track 2: `@qvac/sdk` for all inference+RAG | Phone path is the judged baseline; no Python inference; Django = CRUD/sync only. Optional peer must use `@qvac/sdk` and be disclosed (see TECH_STACK) |
| Track 2: useful offline, honest names, open license, HW specs, perf log, full workflow | F05, F09, COMPLIANCE doc |
| Track 2 medical safety | Equipment-entity extraction only + disclaimer, no diagnosis (F03, F09) |

## 4. Biggest risks (jury-weighted order)
1. **Technical-35%: 3 small models on one phone.** Mitigation: sequential load→infer→unload, Flash variant (64 visual tokens), Q4 quantizations, declared fallback to 2 models (TranslatePsy + VisionPsy) if MedPsy chokes. D1 is entirely this.
2. **Scope-48h:** Mitigation: P0 above is the ceiling. Two screens for capture, one for informe, one for red/panel. Nothing else.
3. **MedPsy framing:** Mitigation: never diagnose; say "extracción de entidades de equipamiento" in every doc + UI + video.
4. **Video story:** Mitigation: one arc — "una visita se vuelve inteligencia confiable, sin conexión".

## 5. Naming / doc rules (this repo)
- Folders: `kebab-case` (`docs/features`, `docs/ui-ux-plan`).
- Docs: `SCREAMING_SNAKE_CASE.md`.
- Feature docs must each cover: frontend alone, backend alone, both together, QVAC calls, schema, acceptance criteria.
- UI previews: plain `.html` mockups + `.md` mermaid flows in `docs/ui-ux-plan`. No real code until planning is signed off.
