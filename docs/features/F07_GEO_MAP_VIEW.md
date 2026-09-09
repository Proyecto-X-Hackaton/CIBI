# F07_GEO_MAP_VIEW — Region → Country → City → Customer

> Goal: navigate the installed base geographically, basement-safe (list first, tiles optional).

## Frontend alone
- Screen 04a: offline-capable drill-down list (Brazil → São Paulo → Hospital Alpha → items). `react-native-maps` only if time; markers derived from stored lat/lng (fictional coords in seed). No geocoding inference on-device or server.

## Backend alone
- `GET /api/geo/?level=country|city&parent=` returns counts by modality per node + customer list. Static seed coords; no external geo API (or disclose it in README table if added — then map becomes online-only enhancement, list stays judged).

## Together
List carries the demo; map is garnish. Both read the same aggregate endpoint/cache.

## Acceptance (P0)
- [ ] Selecting Brazil shows facilities + modality summary, offline.
- [ ] Drill-down reaches one EquipmentItem in ≤4 taps.
