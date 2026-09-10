# F06_REPORT_VIEW — informe versionado + PDF offline + share

> Goal: "Hospital Alpha — São Paulo": parque por modalidad con qty, edad, confianza, frescura + historial + PDF compartible. Jury: Track1 customer view (informe) + MVP.
> UX locked (`ui-ux-plan/SCREEN_03_REPORT.html`): header `Informe · Hospital Alpha / vX · 🟢 CIBI` (sin modelos) + `ⓘ detalles`; selector `Generar con [🟢 CIBI|🔵 CIBI Pro|🟣 CIBI Super]`; stack de acciones consistente (3 botones mismo tamaño): `⟳ Re-generar informe` (primary verde) / `📄 Exportar PDF · compartir` (secondary azul) / `Editar inspección · añadir evidencia` (ghost). La inspección origen NUNCA se bloquea.

## Frontend alone
- Render desde cache SQLite offline: tabla parque, badges fresh/stale, timeline `informe vX + inspección + foto`, versionado v1..n con diff al re-generar (usuario elige, nunca reemplazo silencioso).
- **PDF offline:** `expo-print` (plantilla HTML local) → archivo en teléfono → `expo-sharing` share sheet (WhatsApp/archivos/drive). Funciona en avión. Contenido fijo: portada sede+fecha, banner "No es diagnóstico clínico", tabla + confianza/frescura, procedencia `{tier, peer}`, resumen perf, `synthetic:true`, historial de versiones. Cero inferencia al exportar.
- Acciones siempre disponibles: ver/editar inspección, añadir evidencia, generar/re-generar con el asistente que quieras.

## Backend alone
- `GET /api/reports/:id/` agrega items entre inspecciones: qty, edad min–max, confianza dominante, frescura máx. Pura aritmética ORM. Sirve metadata de versiones; el PDF lo genera el teléfono.

## Both together
Misma regla de roll-up documentada una vez, implementada dos veces (teléfono offline / server online), testeada contra seed. El teléfono no computa nada nuevo aquí: renderiza agregado server online / local offline.

## QVAC calls
- Ninguna directa (vista + PDF son render). El tier que generó cada versión queda en `provenance`; re-generar con 🔵/🟣 invoca el flujo F10 y crea v+1.

## Schema
`Report{inspection_id, version, tier, items[{modality, qty, age_range, confidence}], freshness, history[{kind:informe|inspección|foto, ts, tier}], pdf_ref}`.

## Acceptance (P0)
- [ ] Registro canónico Alpha renderiza la tabla Track1.
- [ ] Drill-down a inspecciones + timestamps; offline = misma vista desde cache.
- [ ] 3 botones mismo tamaño/jerarquía; PDF se exporta en avión, se abre, y WhatsApp aparece en el sheet.
- [ ] Cero nombres de modelos en la vista (tier + ⓘ); mapeo exacto en ⓘ/README/PERF_LOG.
