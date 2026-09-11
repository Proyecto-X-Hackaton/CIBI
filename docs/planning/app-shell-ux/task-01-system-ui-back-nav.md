# Task 01 — System UI: nav-bar overlap + hardware back navigation

## Goal
The app respects the Android 3-button navigation bar (no overlap) and the hardware back button navigates instead of killing the app.

## Root causes (verified)
1. `App.tsx` uses RN `SafeAreaView` + hardcoded `paddingTop: StatusBar.currentHeight` + `tabbar paddingBottom: 18`. No `react-native-safe-area-context` (not installed). On devices with 3-button nav / gesture bar / edge-to-edge, the bottom 18px guess is wrong → tab bar and bottom-anchored content (chat composer, exit bar) sit under the system bar.
2. Zero `BackHandler` usage anywhere → system back = default = finish activity = app "closes", feels like no navigation system.

## Steps
1. `npx expo install react-native-safe-area-context expo-navigation-bar`.
2. `App.tsx`: wrap root in `SafeAreaProvider`; replace RN `SafeAreaView` with `useSafeAreaInsets()`-driven padding: root `paddingTop: insets.top`, tab bar `paddingBottom: max(insets.bottom, 12)`. Keep dark bg.
3. `app.json`: add `androidNavigationBar: { visible: 'sticky', backgroundColor: '#101016' }` so the bar matches the theme and never overlays content unexpectedly.
4. New `src/utils/backNav.ts`: single `BackHandler` subscription in `Shell` implementing the nav stack the app pretends to have:
   - wizard `report` → back to `review`; `review` → back to `chat`; `chat` → exit wizard to Inicio (draft already in SQLite);
   - no wizard + `tab !== 'home'` → `setTab('home')`;
   - no wizard + `tab === 'home'` → allow default (system exits; optionally double-press-to-exit toast — P1, skip if time).
5. Every bottom-anchored surface (chat composer, review/report CTAs, tab bar) gets `paddingBottom` from insets, not constants. `ScrollView`s get `contentContainerStyle.paddingBottom = insets.bottom + 24`.

## Files
- Edit: `frontend/App.tsx`, `frontend/app.json`, all `src/screens/*.tsx` (padding only)
- New: `frontend/src/utils/backNav.ts`
- Deps: `react-native-safe-area-context`, `expo-navigation-bar`

## Acceptance
- [ ] With 3-button nav enabled: tab bar, composer, CTAs fully above the system bar on a physical device.
- [ ] Hardware back: report→review→chat→Inicio→(exit). Never closes mid-wizard.
- [ ] Gesture-nav devices unchanged (insets = 0-ish, same look as today).
