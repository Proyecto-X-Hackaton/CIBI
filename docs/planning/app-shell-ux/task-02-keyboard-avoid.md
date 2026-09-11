# Task 02 — Chat input avoids the keyboard

## Goal
Typing in chat works: composer stays above the keyboard, send stays tappable, history stays reachable.

## Root causes (verified)
1. `ChatCaptureScreen` root is a plain `View`; composer is a fixed bottom block. No `KeyboardAvoidingView`, no `softwareKeyboardLayoutMode` in `app.json` → behavior depends on OS default; on the test device the keyboard covers the input.
2. Chat `ScrollView` lacks `keyboardShouldPersistTaps` → taps on send/attach while keyboard is open are swallowed (feels "unusable").
3. No scroll-to-end on keyboard show → latest messages hide behind the keyboard.

## Steps
1. `app.json`: set `"softwareKeyboardLayoutMode": "resize"` (Expo-supported key, guarantees `adjustResize` on Android).
2. `ChatCaptureScreen`: wrap content (below header) in `KeyboardAvoidingView` (`behavior: 'padding'` iOS / `'height'` Android, `keyboardVerticalOffset` = header height + status bar).
3. Chat `ScrollView`: `keyboardShouldPersistTaps="handled"`; add `Keyboard.addListener('keyboardDidShow')` → `scrollToEnd`.
4. Composer bottom padding = `max(insets.bottom, 10)` (combines with Task 01 insets work; order-independent).
5. Smoke test on device: focus input → composer visible → type → send → keyboard dismisses, message appears, list pinned to bottom.

## Lesson learned on-device (do NOT regress)
The test device honors `adjustResize` (legacy nav, no edge-to-edge). Any extra
compensation on top (KAV `height` behavior, manual keyboard-height padding)
DOUBLE-shifts the layout and half-covers the composer. Final state: KAV is a
no-op on Android, composer padding is insets-only, `adjustResize` does the
lifting. Taps/scroll/dismiss fixes stay — those were the real "unusable" cause.

## Files
- Edit: `frontend/src/screens/ChatCaptureScreen.tsx`, `frontend/app.json`

## Acceptance
- [ ] Keyboard open: input + send + attach all visible and tappable, no overlap.
- [ ] Tapping send with keyboard open sends (no swallowed tap).
- [ ] New message arrival / keyboard show pins list to the latest bubble.
