# F03_STRUCTURED_EXTRACTION — entidades de equipamiento + confianza (NO diagnóstico)

> Goal: lenguaje de dominio → set de campos Track 1 §2 con confianza por campo. **Safety: equipment-entity extraction ONLY. Nunca síntomas, diagnóstico, tratamiento.** Baneadas en prompts/outputs: diagnóstico, síntoma, tratamiento (+ equivalentes EN/PT).
> UX locked: el usuario elige asistente (🟢/🔵/🟣), nunca modelos. 🟢 corre en el teléfono; 🔵/🟣 generan una 2ª pasada en peer (v+1 con diff, nunca reemplazo silencioso). Un Psy siempre ancla entidades (Track 2).

## Frontend alone (Expo + `@qvac/sdk`)
- Prompt constreñido: "Extract ONLY customer/facility, city, country, items[{modality, manufacturer, model, qty, age_text, age_years}], strict JSON, unknown→null, confidence per field (Confirmed|Reported|Estimated|Unknown). Equipment inventory, not medical advice."
- JSON-mode si el SDK lo expone; si no, validar + reparar-parse local, 1 reintento "return ONLY JSON".
- Ejemplo: "three MR, two CT, four ultrasounds, two MR 8–10y" → 3 items con qty + edades, maker/model faltante → `null + Unknown`.
- Toda pantalla con salida muestra: "Extracción de inventario de equipamiento. No es diagnóstico clínico." + pill del tier en uso + `ⓘ detalles`.

## Backend alone (DRF, zero inference)
- Valida schema, guarda `structured_json + confidence_map + provenance{tier, mode:offline|peer, peer_id}`. Rechaza claims clínicos (keyword gate) con 422 — gobernanza sin inferencia. El mapeo tier→modelos exactos se verifica en README/PERF_LOG, no en el request.

## Both together
`text_en + hints visión/lectura → JSON on-device (🟢) → check local → outbox → POST → [opcional peer 🔵/🟣: 2ª pasada → diff → usuario elige v+1] → informes agregan` — la extracción nunca es cómputo del server.

## QVAC calls
- 🟢: `loadModel({modelSrc: HEALTHCARE_1_7B_MEDICAL_Q4_K_M, modelType:'llm', modelConfig:{ctx_size:4096}})` (= `qvac/MedPsy-1.7B-GGUF` → `medpsy-1.7b-q4_k_m-imat.gguf`, ~1.28GB, Q4_K_M) → `completion()` → `unloadModel`.
- 🔵/🟣 (peer, P1): mismo pipeline de captura on-device; el peer recibe `{text_en, ocr_blocks, vision_summary, candidate_json, catalog_ids}` y devuelve 2º candidato (MedPsy-4B anclando + Qwen razonando). Qwen nunca estructura solo.
- Spans con `{tier, model, quant, ctx, ttft, throughput}` → F09.

## Schema
`StructuredReport{observation_id, version, tier, items[{modality, manufacturer, model, qty, age_text, age_years, confidence, source}], provenance{tier, mode, peer_id, fallback_reason}}`.

## Acceptance (P0)
- [ ] Frase canónica (Alpha, 3 MR / 2 CT / 4 US, 2 MR 8–10y) → conteos + edades exactos con Unknowns honestos.
- [ ] Input incompleto ("two CTs") igual rinde registro valioso.
- [ ] Disclaimer visible; banned-word gate pasa; UI sin nombres de modelos (solo tier + ⓘ).
