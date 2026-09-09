# F02_PHOTO_ASSISTED_CAPTURE — label/room photo → modality + OCR text

> Goal: one permitted photo yields modality guess + label text to pre-fill the record. Jury: Track1 stretch (photo-assisted) + Track2 VisionPsy centrality.

## Frontend alone (Expo + `@qvac/sdk`)
- `expo-camera` / `expo-image-picker`, single photo, on-device only (never uploaded for inference).
- QVAC calls:
  1. `loadModel({modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, modelConfig:{ctx_size:1024, projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, image_no_upscale:'on'}})` — **Flash pair + flag must match** (Base pair `_1`-suffixed leaves flag unset; mixing silently degrades quality).
  2. `completion({history:[{role:'user', content:'Identify imaging modality and transcribe visible label data as JSON.', attachments:[{path: photoPath}]}]})` → `{modality_guess, manufacturer_guess, model_guess, label_text_free}`.
  3. `unloadModel`, then `loadModel({modelSrc: OCR_LATIN, modelType:'ocr'})` → `ocr({image: photoPath})` → `blocks[{text, bbox, confidence}]`.
- Merge rule: OCR text wins for serials/models; VisionPsy wins for modality/scene. Both carry confidence; conflicts surface as `Estimated`, never `Confirmed`.
- Consent gate: checkbox "foto autorizada" before shutter; photo stored as local `photo_ref`, uploaded as file only for the record (no server-side vision).

## Backend alone (DRF, zero inference)
- `POST /api/observations/` accepts `{photo_ref, ocr_blocks, vision_guess}` as opaque data. Serves the file back for Customer-360. No `ocr()` / vision calls server-side.

## Together
`photo → VisionPsy + OCR on-device → merged hints → pre-filled Review screen → user confirms → outbox → POST` — backend never sees the photo until after structuring.

## Acceptance (P0)
- [ ] 1 label photo → modality + ≥1 OCR block surfaced in Review, offline.
- [ ] Flash/Base pair + `image_no_upscale` matches; wrong-pair combo documented as tested or avoided.
- [ ] No-permission path (skip photo) still completes the visit.
