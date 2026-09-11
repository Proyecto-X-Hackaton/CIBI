# Task 04 — Real QVAC AI in chat (no templated replies)

## Goal
Chat assistant replies grounded in on-device inference with honest loading + fallback disclosure. Fixes "responses are made up".

## Steps
1. `sendText()`: keep `normalizeToEnglish()` but wire `onProgress` to `busy` state as staged text: `Traduciendo 40% → Estructurando con MedPsy… → Listo`. After translate, call `structureEntities({text_en})` (MedPsy-1.7B, sequential load→infer→unload) for the new message + merge with `matchCatalog()` guidance. Reply format: `Anoté X (MedPsy Q4_K_M, load 1200ms) + Guía catálogo + follow-up`. On model failure, reply labels `regex-fallback, sin modelo` explicitly — never silent template.
2. Photo path: already calls `describePhoto()+readLabelText()` — surface their real results + `topConfidence` + `load_ms` from `recentSpans(1)`. On failure: "Visión no disponible — guardada como evidencia".
3. Composer: disable send while `busy`, show per-stage `ActivityIndicator` + cancel-safe (ignore late resolve after unmount).
4. Tier bar: tapping ⓘ opens `TierDetailsSheet` (already); tier pills show live model names from `TIER_ROSTER`, not mascots.
5. Perf: every turn already logs via `qvacClient`; add `refreshPendings()` + `recentSpans` read to render `load/TTFT` line under assistant bubble.

## Files
- Edit: `frontend/src/screens/ChatCaptureScreen.tsx` (only)

## Acceptance
- [ ] With models present: reply cites real `text_en` + MedPsy items + catalog version.
- [ ] With models absent (airplane first run): reply says fallback explicitly, draft still saved.
- [ ] `PERF_LOG.jsonl` gains `translate` + `completion` rows per turn.
