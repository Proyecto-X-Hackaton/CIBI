# Task 01 — Lucide icons, zero emojis in UI

## Goal
Replace every emoji icon in `*.tsx` with `lucide-react-native` vectors. Depends on nothing. Unblocks Design score.

## Steps
1. `npx expo install lucide-react-native react-native-svg` (Expo-supported, works with SDK 54).
2. Create `frontend/src/components/Icon.tsx`: thin wrapper re-exporting only used icons (`Home, LayoutDashboard, Map, Settings, Camera, Mic, Send, X, ChevronLeft, ChevronRight, Search, Calendar, FileText, RefreshCw, Info, WifiOff, AlertTriangle, Lightbulb, Hospital` → check lucide names, no emoji fallback).
3. Replace in: `App.tsx` tabs + exitbar, `ChatCaptureScreen` composer + tier bar + bubbles, `Home/Panel/Network/Review/Report/Settings` cards/heroes/chips. Tier dots become colored `View` + `Icon`, not emoji.
4. Allowed emoji remainder: `TIER_ROSTER.emoji` data field only (rendered as colored dot, never as icon) + PDF template text. Everything else must render via `<Icon>`.
5. Gate: `rg -n "🏠|📊|🗺|⚙|📷|🎙|➤|👋|🤖|💡|🏥|📅|🔍|⚠" frontend/src --glob '*.tsx'` returns zero hits.

## Files
- New: `frontend/src/components/Icon.tsx`
- Edit: `App.tsx`, all `src/screens/*.tsx`, `src/components/atoms.tsx`
- Deps: `package.json` (+ lucide-react-native, react-native-svg)

## Acceptance
- [ ] No emoji renders as an icon on any screen (visual pass on device).
- [ ] All touch targets wrapping icons ≥44px.
- [ ] `typecheck` green.
