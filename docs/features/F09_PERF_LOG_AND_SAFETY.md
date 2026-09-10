# F09_PERF_LOG_AND_SAFETY — reproducibilidad + honestidad sin cluttear la UI

> Goal: toda inferencia juzgada es medible y honestamente etiquetada — SIN ensuciar la UI. Jury: Track2 perf log + honest names + safety.
> Regla de oro: el usuario ve **tiers + mascota + ⓘ detalles**; el jurado encuentra **nombres exactos en 1 tap** (ⓘ), README, PERF_LOG, PDF y slate del video.

## Frontend alone
- Pill de tier en cada pantalla IA (`🟢 CIBI ▾`) + `ⓘ detalles` (bottom-sheet): mapeo tier→modelos exactos + quants + engine + HW + ctx + fallback activo. Offline badge siempre. Disclaimer: "Extracción de inventario de equipamiento. No es diagnóstico clínico." (chat/revisar/informe + README + slate video).
- Switch idioma UI ES/EN (Ajustes): no toca pipeline.

## ⓘ detalles — spec limpio (una sola fuente de verdad)
- **Un solo componente** `TierDetailsSheet` + **una sola constante** `TIER_ROSTER` (tier → modelos[{nombre, registry_id, quant, engine/plugin, ctx, licencia}] + HW + fallback). Cero strings de modelos hardcodeados por pantalla: chat/revisar/informe/sedes/ajustes importan el mismo sheet.
- **Contenido por tier** (ES, 1 scroll): header `🟢 CIBI · en tu teléfono` (o 🔵/🟣 + `peer <nombre> · verificado`); tabla modelos exactos; `HW: <device o workstation>`; `Modo: offline|peer`; `Fallback activo: …`; mini-resumen perf (últimos load/TTFT/throughput por modelo); licencias; nota `Datos demo sintéticos`.
- **Apertura en 1 tap** desde cualquier pill de tier o `ⓘ`; en 🔵/🟣 bloqueados muestra qué peer/modelo falta para desbloquear. El mismo `TIER_ROSTER` alimenta README (tabla modelos), PDF (pie de procedencia) y `PERF_LOG.jsonl` (campos `tier/model/quant/engine`) — imposible que diverjan.
- Mockups HTML: el `ⓘ` es un `<details>`/overlay estático con el mismo contenido; hallway-test verifica que un usuario lo abre en ≤1 tap.

## Backend alone (DRF, zero inference)
- `GET /api/observations/:id/` replica `tier_cards[] + perf_spans[]` para verificar sin el teléfono. Gate clínico (F03, keyword 422) + `requirements.txt` sin IA.

## Both together
`spans on-device → adjuntos a la inspección/informe → POST como metadata → auditoría server` — medir nunca es inferir.

## QVAC calls (qué logueamos — JSONL, 1 fila por span)
```json
{"ts":"2026-09-10T14:02:11Z","device":"Android 13 · 12GB RAM (test device, Build.MODEL logged at smoke test)","tier":"CIBI","model":"HEALTHCARE_1_7B_MEDICAL_Q4_K_M","quant":"Q4_K_M","engine":"llamacpp-completion","phase":"load|translate|completion|ocr|embed|ragSearch","prompt_chars":412,"tokens_in":0,"tokens_out":187,"ttft_ms":940,"throughput_tps":11.4,"load_ms":3200,"ctx_size":4096,"image_no_upscale":"on","mode":"offline|peer","peer_id":null,"ok":true}
```
- Fuentes: eventos `loadModel` (load_ms), `completion().events` (tokens/TTFT/throughput), `translate().stats`, confianzas `ocr()`.
- Rosters exactos (canónico en TECH_STACK §4): 🟢 on-device (`BERGAMOT_*` + `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` + `OCR_LATIN` + `HEALTHCARE_1_7B_MEDICAL_Q4_K_M` + `GTE_LARGE_FP16`); 🔵/🟣 peer (`HEALTHCARE_4B_MEDICAL_*` + Qwen oficial pineado; forks Uncensored excluidos — ver F10).

## Schema
`PerfSpan{ts, device, tier, model, quant, engine, phase, tokens_in/out, ttft_ms, throughput_tps, load_ms, ctx_size, mode, peer_id, ok}`.

## Acceptance (P0)
- [ ] `PERF_LOG.jsonl` ≥1 fila por modelo Psy desde el device físico, con campo `tier`.
- [ ] ⓘ detalles visible en chat/revisar/informe/ajustes con mapeo exacto, renderizado desde el único `TIER_ROSTER` (mismo contenido en README/PDF/PERF_LOG).
- [ ] `LICENSE` (MIT/Apache-2.0) + HW specs + setup + tabla remote-API ("none" IA; peers LAN declarados) en README.
