# F10_MACHINE_KNOWLEDGE_AND_PEER_ASSISTANCE — catalog guidance + optional local quality boost

> Status: planning only. Barcode/QR/DataMatrix reading and online search are explicitly removed.
> Goal: help the engineer collect better evidence without allowing a small model to invent machine-specific facts.

## Product boundary

The app has two execution modes:

1. **Offline baseline (P0):** the phone performs the complete workflow with `@qvac/sdk`, a bundled equipment catalog, and local RAG. Capture→understand→structure→validate→store→360 works in airplane mode.
2. **Trusted peer enhancement (P1):** if the user explicitly enables a reachable workstation peer, a larger QVAC model may produce a second structuring/guidance pass. This is optional and must never block or silently replace the phone result.

The peer is a separate QVAC process, not the Django backend. It is permitted only if the available QVAC/P2P delegation surface is verified. A local `qvac serve --openai` proxy or an arbitrary REST model endpoint is not the judged integration path.

The primary data source is still the permitted equipment photo, OCR, and staff answers. The catalog provides reference guidance; it does not turn an uncertain observation into a confirmed fact.

## Frontend alone (Expo + `@qvac/sdk`)

- Bundle a versioned `EquipmentCatalogEntry[]` with aliases for modality, manufacturer, family, and model.
- Match OCR/typed text with exact aliases first, then local embedding similarity, then modality-level fallback. Show `Sin coincidencia` rather than inventing a model.
- After a match, show in Spanish:
  - **Puntos de interés:** where the nameplate, console, table, probes, injector, or other useful labels are normally located.
  - **Prioridad de fotos:** the next one or two photos that increase model/age/quantity confidence.
  - **Preguntas al personal:** the highest-value missing facts, limited to two questions.
- Catalog facts are rendered from structured fields. `MedPsy` may summarize retrieved facts, but the UI keeps catalog provenance visible.
- The capture/review screen always shows `Modo sin conexión` or `Asistencia de equipo local`, the active model card, confidence chips, and the medical-scope banner.
- If peer mode is enabled, display both results or an explicit user choice: `Resultado del teléfono` versus `Resultado del equipo local`.
- No barcode camera, QR reader, GTIN lookup, serial lookup, or online fallback is included.

## Backend alone (DRF, zero inference)

- Django stores observations, catalog version, inference provenance, peer status, confidence, and user-selected result.
- Django may serve or persist a catalog version as ordinary JSON, but it does not match models, generate guidance, call a model, or choose between models.
- The backend accepts only structured results and declared provenance. It must not receive a prompt for inference.
- The workstation peer runner is a separate service/process and has no Django inference dependency. Backend `requirements.txt` remains free of AI libraries.

## Both together

```text
photo + text
    │
    ├─ phone: VisionPsy + OCR + local catalog match
    │       └─ deterministic POI/photo/question guidance
    │
    ├─ phone: MedPsy-1.7B → immediate structured candidate
    │
    ├─ optional trusted QVAC peer:
    │       normalized text + OCR + candidate + catalog IDs
    │       → larger local model → second candidate
    │
    └─ user confirms → SQLite outbox → DRF structured JSON + provenance
```

The phone stores the local candidate before attempting peer assistance. A peer timeout, disconnect, unsupported model, or malformed response falls back to the local result with a visible reason.

By default, raw photo and audio remain on the phone. The peer payload contains normalized text, OCR blocks, the on-device VisionPsy summary, the candidate JSON, and catalog entry IDs. Sending raw media requires an explicit trusted-peer policy and is not required for P0.

## QVAC calls and model policy

### Phone baseline

- `loadModel → infer → unloadModel` for TranslatePsy, VisionPsy-Nano, OCR, MedPsy-1.7B, embeddings, and local RAG.
- `ragIngest`/`ragSearch` use the bundled catalog and existing customer observations locally. This built-in workspace is prototype-grade and must be disclosed.
- Every span records model, quantization, device, load time, TTFT, token counts, throughput, and `mode: offline`.

### Optional peer

- Run the exact QVAC model through `@qvac/sdk` on the declared workstation.
- Candidate models:
  - `MedPsy-4B-GGUF`: exact QVAC registry identifier, quantization, and context setting must be pinned. The tested 80,000 context window is a benchmark setting, not a product guarantee.
  - The planned “Qwen 3.8” model: resolve this to the exact official model name and quantization before documenting or loading it. It is not a Psy model and cannot replace the Psy model in the Track 2 story.
- Log peer model load, prompt/input and output token counts, TTFT, throughput, context setting, workstation hardware, connection mode, and fallback reason.
- Use only a verified QVAC/P2P delegation mechanism. QVAC documentation currently confirms local/P2P applications and peer model distribution; the inference-delegation API must be verified before this mode is implemented.

## Schema

```json
{
  "catalog": {
    "entry_id": "catalog.ct.family.example",
    "catalog_version": "2026-09-09"
  },
  "guidance": {
    "point_of_interest": ["Placa lateral inferior del gantry"],
    "photo_priority": ["Foto macro de la placa", "Foto amplia para contar equipos"],
    "staff_question": ["¿En qué año se instaló?"],
    "source": "catalog"
  },
  "inference_provenance": {
    "mode": "offline",
    "model": "MedPsy-1.7B-GGUF",
    "quant": "Q4_K_M",
    "context_size": 8192,
    "runtime": "@qvac/sdk",
    "device": "declared-phone",
    "peer_id": null,
    "fallback_reason": null
  }
}
```

Reference catalog entries are not customer observations. Observations in the demo remain synthetic and carry `synthetic: true`; catalog facts are versioned reference knowledge and never include real hospital records or patient data.

## Acceptance criteria

### P0 — offline

- [ ] Airplane-mode capture→360 works with the catalog bundled on the phone.
- [ ] A recognized alias shows model-specific points of interest, photo priorities, and at most two staff questions.
- [ ] An unknown model falls back to modality-level guidance and remains `Reported`/`Unknown`; it is never presented as a confirmed model.
- [ ] Guidance cites the catalog entry and does not claim diagnosis, symptoms, or treatment.
- [ ] No barcode/QR/DataMatrix permissions or online lookup code exists.

### P1 — only after P0 is green

- [ ] Peer mode is explicitly opt-in and clearly labeled.
- [ ] The phone produces and stores a usable local result before peer assistance starts.
- [ ] Peer inference uses the verified QVAC/P2P path and `@qvac/sdk`, not Django or an OpenAI-compatible proxy.
- [ ] Disconnect, timeout, unsupported model, and malformed output all return to the local result.
- [ ] Peer model names, quantizations, context settings, workstation hardware, and perf spans appear in the UI/README/`PERF_LOG.jsonl`.
- [ ] The video and README disclose that peer assistance is optional and that the offline phone path is the judged baseline.
