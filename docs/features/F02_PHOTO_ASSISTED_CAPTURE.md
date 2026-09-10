# F02_PHOTO_ASSISTED_CAPTURE — 1 foto autorizada → modalidad + texto (UI sin modelos)

> Goal: una foto permitida rinde modalidad + texto de placa para pre-rellenar la inspección. Jury: Track1 photo-assisted + Track2 VisionPsy centrality.
> UX locked: la foto sale del composer (📷) o de la guía por equipo; la UI muestra `Texto leído 0.91 · modalidad MR ✓`, nunca `VisionPsy/OCR_LATIN` (eso vive en ⓘ detalles). VisionPsy-Flash-Q8 FORMA PARTE del equipo 🟢 CIBI regular on-device.

## Frontend alone (Expo + `@qvac/sdk`)
- `expo-camera` / `expo-image-picker`, 1 foto, solo on-device (nunca se sube para inferencia; al peer solo con opt-in explícito, ver F10).
- Consent gate: checkbox "foto autorizada por el sitio" antes del shutter; `photo_ref` local.
- Merge: texto leído gana para modelo/serie; visión gana para modalidad/escena. Conflicto → `Estimated`, nunca `Confirmed`. `Confirmed` solo si foto+texto coinciden o hay re-visita.
- Guía por equipo (F10): tras match de catálogo, el chat sugiere `macro de placa + foto amplia` + `≤2 preguntas al personal`, citando `catálogo v…`.

## Backend alone (DRF, zero inference)
- `POST /api/observations/` acepta `{photo_ref, ocr_blocks, vision_guess}` como datos opacos. Sirve el archivo para el Informe. Cero llamadas `ocr()`/visión server-side.

## Both together
`foto → visión + lectura on-device → hints fusionados → pre-rellena Revisar → usuario confirma → outbox → POST` — el backend ve la foto solo después de estructurar, como archivo.

## QVAC calls
1. `loadModel({modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, modelConfig:{ctx_size:1024, projectionModelSrc: MMPROJ_…, image_no_upscale:'on'}})` — **par Flash + flag deben matchear** (par Base `_1` deja el flag unset; mezclar degrada en silencio).
2. `completion({history:[{role:'user', content:'Identify imaging modality and transcribe visible label data as JSON.', attachments:[{path: photoPath}]}]})` → `{modality_guess, manufacturer_guess, model_guess, label_text_free}`.
3. `unloadModel` → `loadModel({modelSrc: OCR_LATIN, modelType:'ocr'})` → `ocr({image: photoPath})` → `blocks[{text, bbox, confidence}]`.
- Roster: este par visión+lectura pertenece al equipo 🟢 (y se reutiliza como base en 🔵/🟣; el peer razona sobre el resultado, no re-fotografía).

## Schema
`PhotoEvidence{observation_id, photo_ref, authorized:bool, modality_guess, text_blocks[{text, confidence}], merged_confidence}`.

## Acceptance (P0)
- [ ] 1 foto de placa → modalidad + ≥1 bloque de texto en Revisar, offline; UI sin nombres de modelos.
- [ ] Par Flash/Base + `image_no_upscale` matchea; combo erróneo documentado o evitado.
- [ ] Sin permiso (saltar foto) la inspección igual se completa.
