# F09_PERF_LOG_AND_SAFETY — reproducibility + medical guardrails

> Goal: every judged inference is measurable and honestly labeled. Jury: Track2 perf log + honest names + safety.

## What we log (JSONL, one row per span, stored with the observation + exportable)
```json
{"ts":"2026-09-10T14:02:11Z","device":"Galaxy S25 Ultra (SM-S938B)","model":"qvac/MedPsy-1.7B-GGUF","quant":"Q4_K_M","engine":"llamacpp-completion","phase":"load|translate|completion|ocr|embed|ragSearch","prompt_chars":412,"tokens_in":0,"tokens_out":187,"ttft_ms":940,"throughput_tps":11.4,"load_ms":3200,"ctx_size":4096,"image_no_upscale":"on","ok":true}
```
- Sources: `loadModel` progress events (load_ms), `completion().events` (`completionStats` → tokens/TTFT/throughput), `translate().stats`, `ocr()` block confidences.
- `GET /api/observations/:id/` echoes `model_cards[] + perf_spans[]` so the juror can verify without the phone.

## Honest-names checklist (README + UI model cards + video slate)
- Exact model IDs (after `registry` pin), quantization, engine, execution HW (phone model + SoC + RAM), `qvac.config.json` plugins used, fallback disclosures (e.g. "MedPsy→regex fallback on <4GB RAM" if triggered).

## Safety (medical)
- Banners: "Extracción de entidades de equipamiento. No es diagnóstico clínico." on Capture/Review/360 + README + video slate at 4:15. Banned-claim gate in F03. No dosage/symptom/diagnosis strings anywhere in seed or prompts.

## Acceptance (P0)
- [ ] `PERF_LOG.jsonl` has ≥1 row per Psy model from the physical device.
- [ ] Model cards visible in Review screen.
- [ ] `LICENSE` (MIT/Apache-2.0) + HW specs + setup + remote-API table ("none" if fully offline) in README.
