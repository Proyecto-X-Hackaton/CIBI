# F03_STRUCTURED_EXTRACTION — MedPsy entities + confidence (NO diagnosis)

> Goal: domain language → Track 1 §2 field set with per-field confidence. **Safety: equipment-entity extraction ONLY. Never symptoms, diagnosis, treatment.** Banned words in prompts/outputs: diagnóstico, síntoma, tratamiento (+ EN/PT equivalents).

## Frontend alone (Expo + `@qvac/sdk`)
- `loadModel({modelSrc:'hf://qvac/MedPsy-1.7B-GGUF', modelType:'llm', modelConfig:{ctx_size:4096}})` → `completion()` with constrained prompt: "Extract ONLY customer/facility, city, country, items[{modality, manufacturer, model, qty, age_text, age_years}], output strict JSON, unknown→null, add confidence per field (Confirmed|Reported|Estimated|Unknown). This is equipment inventory, not medical advice."
- Prefer structured-output / JSON-mode if the SDK exposes it; else validate + repair-parse locally, retry once with "return ONLY JSON".
- Example: "three MR, two CT, four ultrasounds, two MR 8–10y" → 3 items with qty + age ranges, missing manufacturer/model → `null + Unknown`.
- Every screen with MedPsy output shows: "Extracción de inventario de equipamiento. No es diagnóstico clínico."

## Backend alone (DRF, zero inference)
- Validates JSON schema, stores `structured_json + confidence_map + model_card{model, quant, device}`. Rejects records with banned clinical claims (keyword gate) and returns 422 with reason — governance without inference.

## Together
`text_en + vision/ocr hints → MedPsy JSON on-device → schema check locally → outbox → POST → server re-validates → 360 aggregates` — extraction never touches the server as compute.

## Acceptance (P0)
- [ ] Canonical sentence (Hospital Alpha, 3 MR / 2 CT / 4 US, 2 MR 8–10y) parses to exact counts + ages with honest Unknowns.
- [ ] Incomplete input ("two CTs", no maker) still yields a valuable record.
- [ ] Disclaimer visible; banned-word gate passes.
