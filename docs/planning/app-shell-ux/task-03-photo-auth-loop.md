# Task 03 — Photo consent loop (camera never opens)

## Goal
Tap "Autorizada" → camera opens. Tap "No autorizado" → graceful continue-by-text with an assistant note. No repeat prompts.

## Root cause (verified, matches symptom exactly)
`ChatCaptureScreen.tsx:97-105`: the Alert's `onPress` calls `setTimeout(takePhoto, 300)` where `takePhoto` is the **stale render closure** captured when the Alert was built — in that closure `authorized === false`. So the retry re-enters the `!authorized` branch and re-shows the Alert forever. Camera code is never reached. "No autorizado" (`style: 'cancel'`) just dismisses with no feedback message.

## Steps
1. Remove the state-roundtrip: split into `requestPhotoConsent()` (shows Alert once) and `openCameraFlow()` (permission → `launchCameraAsync` → VisionPsy+OCR → `savePhotoEvidence`). The "Autorizada" handler calls `setAuthorized(true)` then `openCameraFlow()` directly — no `setTimeout`, no stale closure. (Alternative: `authorizedRef`; direct call is simpler and race-free.)
2. "No autorizado" handler posts an assistant message ("Sin foto seguimos con texto — dime modalidad, cantidad y edad") so the flow visibly continues instead of silently stopping.
3. While there: verify `expo-file-system` v19 legacy `copyAsync`/`getInfoAsync` still resolve on-device (both calls already have `.catch` fallbacks to `src`; if removed, migrate to the `File` API). Verify `launchCameraAsync` resolves on the physical device (it does — separate from the closure bug).
4. Keep consent per-inspection (`authorized` state stays) so the prompt appears at most once per inspection.

## Files
- Edit: `frontend/src/screens/ChatCaptureScreen.tsx` (takePhoto block only)

## Acceptance
- [ ] "Autorizada" → camera opens first time, every time; photo → VisionPsy+OCR assistant message.
- [ ] Prompt appears max once per inspection; never loops.
- [ ] "No autorizado" → assistant text fallback message, inspection completable without photo.
