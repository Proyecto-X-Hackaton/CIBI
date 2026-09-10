# F01_MULTILINGUAL_CAPTURE — chat ES/PT → EN normalizado (composer WhatsApp + tiers)

> Goal: la ingeniera habla/escribe natural en ES/PT en un chat experto; el pipeline trabaja en EN; el original siempre se conserva. Jury: Track1 capture + Track2 TranslatePsy centrality.
> UX locked: composer estilo WhatsApp (un input redondeado con 📷 + 🎙️ dentro + botón enviar ➤), selector de asistente 🟢/🔵/🟣 con mascota (sin nombres de modelos en la vista principal), switch de idioma UI ES/EN en Ajustes.

## Frontend alone (Expo + `@qvac/sdk`)
- Pantalla `SCREEN_01_CAPTURE.html`: burbujas IA/usuario + guía experta + chips de confianza (`Reported` etc., nunca nombres de modelos) + `ⓘ detalles` (único punto con mapeo exacto tier→modelos).
- Composer: `input[Escribe… + 📷 + 🎙️] + ➤`. Voz: mantener 🎙️ (Parakeet-TDT on-device; typed fallback si falla). Foto: 📷 con gate "foto autorizada".
- Selector tiers en header (`🟢 CIBI ▾`) + tierbar con mascota (`assets/mascot-cibi|pro|super.png`): `🟢 CIBI · rápido · en tu teléfono` / `🔵 CIBI Pro · mejor calidad · peer 🔒` / `🟣 CIBI Super · máximo razonamiento · peer 🔒`. Preselección 🟢 CIBI. Cambiar de tier nunca borra: genera v+1.
- Idioma UI (ES/EN) en Ajustes: solo cambia strings; la captura siempre acepta ES/PT y normaliza a EN internamente.

## Backend alone (DRF, zero inference)
- `POST /api/inspections/` + `POST /api/observations/` aceptan `{raw_text_original, lang, raw_text_en, source:'voice'|'text'|'photo'}`. Sin transcripción ni traducción server-side. Devuelven IDs para marcar SYNCED. (Alias legacy `/api/visits/` deprecated.)

## Both together
`composer → (ASR on-device) → TranslatePsy on-device → borrador inspección en SQLite (PENDING) → [online] POST → SYNCED` — el chat nunca bloquea por red; badge `SIN CONEXIÓN · GUARDADO LOCAL`.

## QVAC calls (secuencial, unload entre cada uno)
1. ASR opcional: `loadModel({modelSrc: PARAKEET_TDT_0_6B_V3_Q8_0, modelType:'parakeet-transcription'})` → `transcribe({audioChunk})` (fallback: solo texto).
2. Normaliza: `loadModel({modelSrc: BERGAMOT_ES_EN / BERGAMOT_PT_EN, modelType:'nmt', modelConfig:{engine:'Bergamot', from:'es'|'pt', to:'en'}})` → `translate({modelId, text})`. Guarda `{text_original, lang_detected, text_en}`.
- Spans perf por llamada (load_ms, ttft_ms, tokens, throughput, **tier**) → F09.

## Schema
`Inspection{id, customer_name, city, country, author, observed_at, status:BORRADOR|PENDING|SYNCED}` → `Observation{inspection_id, source_type, lang, raw_original, raw_en, synthetic:true}`.

## Acceptance (P0)
- [ ] Modo avión: voz/texto ES → EN guardado local, visible en Revisar; sample PT normaliza sin pérdida.
- [ ] Sin nombres de modelos en el chat (solo 🟢/🔵/🟣 + ⓘ detalles); `ⓘ` abre el mapeo exacto tier→modelos.
- [ ] Toggle ES/EN cambia UI, no rompe pipeline ES/PT→EN.
- [ ] Perf log con spans translate + tier; backend `grep` sin inferencia.
