# F10_MACHINE_KNOWLEDGE_AND_PEER_ASSISTANCE — catálogo + tiers + peer QVAC (rostro canónico)

> Status: planning only. Barcode/QR/DataMatrix y búsqueda online EXCLUIDOS.
> Goal: mejor evidencia sin que un modelo pequeño invente datos máquina-específicos; y un boost opcional con peer local — con UX de 1 clic (tiers + mascotas, cero modelos a la vista).
> Rostro canónico de equipos (la UI solo muestra tier + mascota + hint velocidad/calidad; el mapeo exacto vive en ⓘ/README/PERF_LOG):
> - **🟢 CIBI (teléfono, siempre)**: TranslatePsy-EuroNano + VisionPsy-Nano-460M-Flash Q8_0 (+mmproj pareado, `image_no_upscale:'on'`) + OCR_LATIN + MedPsy-1.7B-GGUF Q4_K_M + GTE-small. Rápido, offline, el del video.
> - **🔵 CIBI Pro (peer QVAC)**: MedPsy-4B-Q8 (estructura dominio) + Qwen3.5-4B* (guía/fluidez). *Candidato: pinnear ID registry + quant + ctx + licencia + doctor en peer.
> - **🟣 CIBI Super (peer QVAC)**: Qwen oficial grande* (razonamiento) + MedPsy-4B anclando entidades (Qwen nunca solo). *Solo releases oficiales; forks "Uncensored/Aggressive" EXCLUIDOS (licencia reempaque dudosa + copy anti-moderación incompatible con framing médico + 15–31GB inviable 48h). Mismo modelo hace visión+texto solo si es variante multimodal oficial con projector; si no, VisionPsy mantiene modalidad.

## Frontend alone (Expo + `@qvac/sdk`)
- Catálogo versionado `EquipmentCatalogEntry[]` (alias modalidad/maker/familia/modelo). Match: alias exacto → embedding → fallback modalidad. `Sin coincidencia` antes que inventar.
- Tras match, en español: **POI** (dónde está la placa/consola), **prioridad fotos** (≤2 que más suben confianza), **preguntas al personal** (≤2). Render determinista desde campos; el tier puede resumir pero la procedencia `catálogo v…` queda visible.
- Selector tiers (chat/informe/ajustes, preselección 🟢 CIBI, mascotas `assets/mascot-cibi|pro|super.png`): CIBI Pro / CIBI Super 🔒 sin peer verificado con ese equipo cargado. Cambiar → v+1 con diff, nunca borra v1.
- Peers UI simplificada (Ajustes): `nombre + IP + desbloquea 🔵/🟣 + verificado` + Escanear/Probar/Añadir manual. Detalles técnicos en ⓘ. `qvac serve --openai` solo dev, nunca ruta juzgada.

## Backend alone (DRF, zero inference)
- Django guarda inspecciones, versiones, catalog_version, provenance{tier, mode, peer_id}, perf refs y la elección del usuario. Puede servir el catálogo como JSON plano. Nunca matchea, guía, llama modelos ni elige entre ellos. `requirements.txt` sin IA.

## Both together
```
foto + texto
  ├─ teléfono: visión + lectura + match catálogo → guía determinista
  ├─ teléfono: tier 🟢 → candidato inmediato (siempre disponible)
  ├─ peer QVAC opcional (opt-in): {text_en, ocr, vision_summary, candidate, catalog_ids}
  │     → equipo 🔵/🟣 → 2º candidato
  └─ usuario confirma → SQLite outbox → DRF JSON + provenance
```
- Local primero siempre; timeout/disconnect/modelo-no-soportado/respuesta-mala → fallback local con razón visible. Foto/audio crudos se quedan salvo policy explícita de peer de confianza.

## QVAC calls y política de modelos
- Teléfono: `loadModel → infer → unloadModel` por modelo (TranslatePsy, VisionPsy, OCR, MedPsy-1.7B, embeddings, RAG), 1 residente a la vez; spans con `{tier, model, quant, ctx, device, mode:offline}`.
- Peer: modelos exactos vía `@qvac/sdk` en superficie QVAC/P2P verificada (verificar API de delegación antes de implementar; si no existe, se omite peer antes que proxear por Django/OpenAI). Spans peer con `{tier, model, quant, ctx, HW workstation, mode:peer, peer_id, fallback_reason}`. `ragIngest`/`ragSearch` built-in = prototype, disclosed.

## Schema
```json
{"catalog": {"entry_id": "catalog.ct.family.example", "catalog_version": "2026-09-09"},
 "guidance": {"point_of_interest": ["Placa lateral inferior del gantry"], "photo_priority": ["Macro de placa", "Amplia para conteo"], "staff_question": ["¿Año de instalación?"], "source": "catalog"},
 "inference_provenance": {"tier": "CIBI", "mode": "offline", "peer_id": null, "fallback_reason": null}}
```
(Mapeo tier→modelos exactos en F09/README/PERF_LOG; observaciones demo `synthetic:true`; catálogo = conocimiento referencia, nunca observación.)

## Acceptance criteria
### P0 — offline
- [ ] Avión: captura→informe con catálogo bundled; alias conocido → POI/fotos/≤2 preguntas; desconocido → fallback modalidad (`Reported`/`Unknown`, nunca confirmado inventado); cita catálogo, cero claims clínicos; sin permisos barcode/QR ni lookups online.
### P1 — solo con P0 verde
- [ ] Opt-in explícito; local usable antes del peer; peer vía QVAC/P2P + `@qvac/sdk` (no Django ni proxy OpenAI); todo fallo vuelve al local; tiers/mascotas sin modelos a la vista + ⓘ con mapeo; perf peer + HW en UI(ⓘ)/README/PERF_LOG; video+README declaran peer opcional y 🟢 como baseline juzgado.
