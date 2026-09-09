# F01_MULTILINGUAL_CAPTURE — voice/text ES/PT → EN normalized

> Goal: engineer speaks or types naturally in Spanish/Portuguese; pipeline works in English; original always preserved. Jury: Track1 capture + Track2 TranslatePsy centrality.

## Frontend alone (Expo + `@qvac/sdk`)
- Screens: big mic button + text field + language auto-chip (ES/PT). Offline-first: everything queued in `expo-sqlite` outbox.
- QVAC calls (sequential, unload between):
  1. Optional ASR: `loadModel({modelSrc: PARAKEET_TDT_0_6B_V3_Q8_0, modelType:'parakeet-transcription'})` → `transcribe({audioChunk})` (or Whisper + Silero VAD if Parakeet too heavy). Streaming via `transcribeStream()` for long dictations.
  2. Normalize: `loadModel({modelSrc: BERGAMOT_ES_EN / BERGAMOT_PT_EN, modelType:'nmt', modelConfig:{engine:'Bergamot', from:'es'|'pt', to:'en'}})` → `translate({modelId, text})`. Keep `{text_original, lang_detected, text_en}`.
- Perf spans recorded per call (load_ms, ttft_ms, tokens, throughput) → F09 log.
- Fallback: if ASR model fails → typed input only (voice is P1-stretch); if NMT fails → flag `untranslated:true`, pipeline continues in original language and MedPsy prompt includes it.

## Backend alone (DRF, zero inference)
- `POST /api/visits/` + `POST /api/observations/` accept `{raw_text_original, lang, raw_text_en, source:'voice'|'text'}`. No translation, no transcription server-side. Stores + returns IDs for the outbox to mark synced.

## Together (sequence)
`mic/text → (ASR on-device) → TranslatePsy on-device → SQLite outbox row (PENDING) → [when online] POST /api/observations/ → mark SYNCED` — capture screen never blocks on network; badge shows `SIN CONEXIÓN · GUARDADO LOCAL`.

## Data
`Observation{visit_id, author, observed_at, source_type, lang, raw_original, raw_en, synthetic:true}`.

## Acceptance (P0)
- [ ] Airplane mode: ES voice/text → EN stored locally, visible in Review screen.
- [ ] PT sample ("Estou no Hospital Alpha em São Paulo…") normalizes without data loss.
- [ ] Perf log has translate span with tokens + throughput.
- [ ] Backend `grep` shows no translation inference.
