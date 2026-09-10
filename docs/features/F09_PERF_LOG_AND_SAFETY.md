# F09_PERF_LOG_AND_SAFETY — reproducibilidad + honestidad sin cluttear la UI

> Goal: toda inferencia juzgada es medible y honestamente etiquetada — SIN ensuciar la UI. Jury: Track2 perf log + honest names + safety.
> Regla de oro: el usuario ve **tiers + mascota + ⓘ detalles**; el jurado encuentra **nombres exactos en 1 tap** (ⓘ), README, PERF_LOG, PDF y slate del video.

## Frontend alone
- Pill de tier en cada pantalla IA (`🟢 CIBI ▾`) + `ⓘ detalles` (bottom-sheet): mapeo tier→modelos exactos + quants + engine + HW + ctx + fallback activo. Offline badge siempre. Disclaimer: "Extracción de inventario de equipamiento. No es diagnóstico clínico." (chat/revisar/informe + README + slate video).
- Switch idioma UI ES/EN (Ajustes): no toca pipeline.

## Backend alone (DRF, zero inference)
- `GET /api/observations/:id/` replica `tier_cards[] + perf_spans[]` para verificar sin el teléfono. Gate clínico (F03, keyword 422) + `requirements.txt` sin IA.

## Both together
`spans on-device → adjuntos a la inspección/informe → POST como metadata → auditoría server` — medir nunca es inferir.

## QVAC calls (qué logueamos — JSONL, 1 fila por span)
```json
{"ts":"2026-09-10T14:02:11Z","device":"Galaxy S25 Ultra (SM-S938B)","tier":"CIBI","model":"qvac/MedPsy-1.7B-GGUF","quant":"Q4_K_M","engine":"llamacpp-completion","phase":"load|translate|completion|ocr|embed|ragSearch","prompt_chars":412,"tokens_in":0,"tokens_out":187,"ttft_ms":940,"throughput_tps":11.4,"load_ms":3200,"ctx_size":4096,"image_no_upscale":"on","mode":"offline|peer","peer_id":null,"ok":true}
```
- Fuentes: eventos `loadModel` (load_ms), `completion().events` (tokens/TTFT/throughput), `translate().stats`, confianzas `ocr()`.
- Rosters exactos (canónico en F10): 🟢 on-device (TranslatePsy-EuroNano + VisionPsy-Flash-Q8 + OCR_LATIN + MedPsy-1.7B-Q4_K_M + GTE-small); 🔵/🟣 peer (MedPsy-4B-Q8 + Qwen oficial pineado; forks Uncensored excluidos — ver F10).

## Schema
`PerfSpan{ts, device, tier, model, quant, engine, phase, tokens_in/out, ttft_ms, throughput_tps, load_ms, ctx_size, mode, peer_id, ok}`.

## Acceptance (P0)
- [ ] `PERF_LOG.jsonl` ≥1 fila por modelo Psy desde el device físico, con campo `tier`.
- [ ] ⓘ detalles visible en chat/revisar/informe/ajustes con mapeo exacto.
- [ ] `LICENSE` (MIT/Apache-2.0) + HW specs + setup + tabla remote-API ("none" IA; peers LAN declarados) en README.
