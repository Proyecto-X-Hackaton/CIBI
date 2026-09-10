# F07_GEO_MAP_VIEW — Mis sedes: buscar, filtrar, actuar (lista offline primero)

> Goal: responder en <10s "¿a dónde voy mañana?" sin conexión. Lista plana ordenada por urgencia, agrupada por País → Ciudad (satisface el drill-down Track 1 sin árbol navegable pesado). Termina en el **informe en ≤2 taps**.

## Frontend alone
- Sección **Mis sedes** en pantalla 04 (`SCREEN_04_MAP_DASHBOARD.html`, sin segmento `Red | Panel`): buscador + chips-filtro `[Todas][Brasil][>7 años][Incompletas][Sin visitar 60d]` + lista plana ordenada por urgencia (envejecido > incompleto > stale > reciente), con **cabeceras pegajosas de agrupación `País → Ciudad`** (ej. `Brasil › São Paulo (3 sedes)`) que colapsan/expanden. El filtro País/Ciudad salta a la cabecera en 1 tap — equivale al drill-down Región → País → Ciudad → Cliente del brief, sin árbol separado.
- Cada fila: `🏥 nombre · ciudad` + 1 línea de motivo (`2 MR 8–10 años · contactar ingeniería`) + badge frescura (`hace 42d` / `fresco`) + badge `📅 mañana` si hay `PlannedVisit` + link `Ver informe ›`. La cabecera de grupo muestra conteo (`Alpha +2`) para lectura geográfica rápida.
- `react-native-maps` solo si hay tiempo, como link secundario `Ver mapa ›` (tiles online-only). Sin geocoding (ni on-device ni server). Coords ficticias del seed solo para markers.

## Backend alone
- `GET /api/sites/?country=&city=&flag=aging_7y|incomplete|stale&sort=urgency` devuelve filas planas con `urgency_reason` + `GET /api/geo/summary/` devuelve conteos para los chips. Coords estáticas del seed; sin geo-API externa (si se añade, se declara en README y el mapa pasa a enhancement online-only; la lista sigue siendo lo juzgado).

## Both together
La lista carga la demo offline desde SQLite; online refresca del server con el mismo orden por urgencia. El mapa es garnish y lee las mismas filas.

## QVAC calls
- Ninguna.

## Schema
`SiteRow{site_id, name, city, country, counts{MR,CT,US}, aging_7y+, incomplete_fields, last_visit_days, urgency_reason, report_id, synthetic:true}`.

## Acceptance (P0)
- [ ] Brasil filtrado muestra "ir a Alpha mañana: 2 MR 8–10 años" offline, <10s, bajo cabecera `Brasil › São Paulo`.
- [ ] Buscar + 1 tap llega al informe; informe → equipo en ≤2 taps totales.
- [ ] Cabeceras País → Ciudad visibles y colapsables (trazabilidad al drill-down Track 1 § Geographic Map).
- [ ] Sin conexión la lista completa funciona; el mapa puede faltar sin romper nada.
