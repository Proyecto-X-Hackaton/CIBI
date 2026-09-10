# AGENTS.md — CIBI (Customer Installed-Base Intelligence, on-device)

> Read this first on every session. This repo fuses General + Track 1 + Track 2 in ONE workflow. Full planning lives in `docs/` — this file is the compressed brief so context never needs re-explaining.

## 1. What this is (locked concept)

Offline-first mobile app for hospital field visits: **one visit → trusted installed-base intelligence, entirely on-device.**

> Peer note (P1, non-judged): the phone baseline above is the judged flow and works fully offline. Optionally the app may request a second pass from a reachable local QVAC instance (workstation peer, `@qvac/sdk`, never cloud/Django) running larger models for better quality — always opt-in, versioned (v+1, never silent replace), with local fallback. Video demos 🟢 offline; peer is enhancement only.

Happy path (the only story the ≤5min Spanish video tells):
1. Engineer speaks/types in ES/PT → **TranslatePsy** normalizes to EN (original kept).
2. Snaps 1 permitted photo → **VisionPsy-Nano-460M-Flash** (modality) + **ONNX OCR** (label text).
3. **MedPsy-1.7B** structures entities (MR/CT/US, maker, qty, age) with per-field confidence `Confirmed | Reported | Estimated | Unknown`.
4. App asks ≤2 follow-ups, warns on duplicates, stores locally.
5. Customer-360 + geo drill-down + dashboard update with zero connectivity.

Track map: General = basement-no-signal + sensitive data never leaves phone. Track 1 = Capture→Understand→Structure→Validate→Store→Visualize→Insight, synthetic data only. Track 2 = 3 Psy models ARE the pipeline (not decoration), `@qvac/sdk` for all inference+RAG, open license, HW specs, perf log, full workflow.

## 2. Locked stack + THE integration rule (DQ guardrail)

| Layer | Choice |
|---|---|
| App | React Native + Expo SDK 54, TypeScript (`blank-typescript@sdk-54`) |
| On-device AI | `@qvac/sdk` (^0.7.0) **only — owns ALL judged inference + RAG** |
| Backend | Python + Django REST — **CRUD/sync/aggregates ONLY, zero inference** |
| Stores | `expo-sqlite` outbox on-device → DRF + Postgres (SQLite OK for 48h) |

```
PHONE (Expo + @qvac/sdk)              SERVER (DRF, no AI)
TranslatePsy / VisionPsy / MedPsy  →  receives structured JSON only
embeddings + RAG workspace         ←  serves aggregates
SQLite outbox ──HTTP JSON──────────▶  NEVER calls any model
```

- **Cloud inference = instant DQ.** Cloud hosting of the non-AI API is allowed.
- Backend `requirements.txt` must contain **no AI libs** (`torch/transformers/openai` → grep gate must be empty).
- Python SDK (`tetherto-qvac-sdk`) is NOT in the judged flow — Track 2 says `@qvac/sdk`. Document, don't mix.
- `qvac serve --openai` is dev-only, never in the judged path.

## 3. QVAC runtime facts (do not rediscover)

- **Physical device only — primary target: Android** (`expo run:android --device`, dev build via prebuild, not Expo Go) — llamacpp fails on emulators. Test device: physical Android 13, 12GB RAM (exact `Build.MODEL` recorded in `PERF_LOG.jsonl` at smoke test); iOS deferred.
- `app.json` plugins: `expo-build-properties` (Android `minSdkVersion: 29`) + `@qvac/sdk/expo-plugin`; then `npx expo prebuild`.
- `qvac.config.json` enables only needed plugins (llamacpp-completion, nmt, whisper/parakeet, onnx-ocr, embeddings).
- Lifecycle is always `loadModel → infer → unloadModel`, **one model resident at a time**; log every span (load_ms, TTFT, tokens in/out, throughput).
- **VisionPsy Flash vs Base**: separate weights+mmproj pairs. Flash → `image_no_upscale:'on'`; Base (`_1`-suffixed) → flag unset. Mismatch silently degrades.
- RAG built-in workspace (`ragIngest`/`ragSearch`) is **prototype-only** per docs — fine here, disclose it.
- Env: Node ≥22.17, Python ≥3.10, `qvac doctor` green.
- Model roster: TranslatePsy-EuroNano (Bergamot ES/PT→EN) · VisionPsy-Nano-460M-Flash Q8_0 (try Q4_K_M if RAM-bound) · ONNX OCR_LATIN · Parakeet-TDT or Whisper+Silero VAD (voice is stretch — typed input is the fallback) · MedPsy-1.7B-GGUF Q4_K_M (fallback: TranslatePsy+VisionPsy+regex, disclosed) · small GTE embedding for dedup.

## 4. Non-negotiable compliance checklist

- [ ] Airplane-mode capture→360 works; video shows the offline toggle + device frame.
- [ ] `LICENSE` = MIT or Apache-2.0 (Track 2 requires open; General doesn't — Track 2 wins).
- [ ] README top: video link (no login) + setup + HW specs + exact model/quant/engine names + remote-API table ("none" if fully offline) + **pre-existing base declaration** (omission = DQ).
- [ ] `PERF_LOG.jsonl` rows per model: load, prompts, tokens, TTFT, throughput.
- [ ] Medical framing: **equipment-entity extraction ONLY**. Banner everywhere (UI + README + video slate): "Extracción de inventario de equipamiento. No es diagnóstico clínico." Banned: diagnóstico/síntoma/tratamiento (+EN/PT).
- [ ] Synthetic data only: fictional hospitals/makers, `synthetic:true` on every record.
- [ ] Before coding AND before delivery: run `qvac_compliance_check` + `judge_feedback` (all criteria ≥6). Tie-break order: Technical → Impact.

## 5. Docs conventions (enforced)

- Folders `kebab-case` (`docs/features`, `docs/ui-ux-plan`). Files `SCREAMING_SNAKE_CASE.md`.
- Feature docs (F01–F09) must each cover: **frontend alone / backend alone / both together / QVAC calls / schema / acceptance criteria**. Don't merge or rename them without asking.
- UI previews: plain `.html` mockups + `.md` mermaid flows in `docs/ui-ux-plan` first; hallway-test HTML on a phone browser before coding screens.
- Key docs: `docs/PROJECT_SCOPE.md` (P0/P1/out-of-scope) · `docs/TECH_STACK_AND_ARCHITECTURE.md` (API contract, entities) · `docs/COMPLIANCE_AND_RISK_REGISTER.md` (matrix + self-scores). (`docs/FORTY_EIGHT_HOUR_PLAN.md` was dropped — do not reference it; D1 phone → D2 trust/design → D3 video lives in PROJECT_SCOPE §4 + COMPLIANCE §2.)
- Delivery artifacts (`LICENSE`, `PERF_LOG.jsonl`, video link, full README, `seed_synthetic.py`) are tracked in the compliance checklist above but intentionally deferred until coding/delivery — README stays minimal for now, do not block planning on it.
- Spanish UI strings (video language). Confidence chips + offline badge + model cards on every AI screen.

## 6. Working agreements for agents

- Planning phase: docs first, no `frontend/` or `backend/` code until the user signs off. When coding starts: smallest diff that keeps P0 green on-device; D1 priority is the 3-model smoke test on THE device, not backend polish.
- **D1 task 0 (gates everything): pin exact model asset IDs via `qvac registry` / HF `qvac` org into the single `TIER_ROSTER` constant** — TranslatePsy ES→EN + PT→EN pair IDs, VisionPsy-Flash weights + matched mmproj pair, OCR_LATIN detector/recognizer IDs, MedPsy-1.7B GGUF Q4_K_M file, GTE embedding ID — then sequential `load→infer→unload` smoke test. No screens before this is green.
- Never add cloud AI calls, emulator-only flows, real hospital data, or clinical claims. Never put inference in `backend/`.
- Prefer `read`/`edit`/`write` over shell for files; use `bash` for `qvac doctor`, `grep` gates, tests. Verify by running, don't assert from memory.
- qvac-mcp tools available: `qvac_index` → `qvac_fetch`, `qvac_search`, `track_brief`/`track_detail`, `hackathon_rules`, `hackathon_plan`, `judge_feedback`, `qvac_compliance_check`. Re-fetch docs when unsure — training data may be stale.
- Deadline: Sep 11 08:00 America/Panama. Public repo + ≤5min video. When in doubt, cut scope (P1 first), never cut compliance artifacts.
