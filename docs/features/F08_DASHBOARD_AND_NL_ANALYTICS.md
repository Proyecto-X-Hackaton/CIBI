# F08_DASHBOARD_AND_NL_ANALYTICS — próxima acción + pregunta útil (de informes)

> Goal: probar que las inspecciones se vuelven *accionables*. Jury: Track1 Dashboard + métrica Innovación.
> UX locked: 1 hero de próxima acción + lista qué-completar + NL por chips; toda respuesta cita sede/informe. Cero jerga (nada de RAG/tier/trust-delta en UI).

## Frontend alone (Expo + `@qvac/sdk`)
- Sección **Próxima acción** en pantalla 04 (arriba, sin segmento): 1 hero (`Hospital Alpha — 2 MR 8–10 años → ofrecer renovación · hablaste con Ing. Ruiz hace 42d`) con botones `[Ver informe]` + `[📅 Agendar]` (chips `[Mañana][Próx. semana]` → estado `📅 Agendada ✓ mañana` + aparece en Inicio → Esta semana). Tercer acceso `Qué decir` como link secundario bajo el hero (guion 2 líneas, no botón).
- Agendar es funcional P0: crea `PlannedVisit` local + outbox (F05); sin calendario OS ni notificaciones en P0.
- Sin grilla de KPIs totales (9 MR / 6 CT no deciden nada). Solo 2 números que empujan acción: `equipos >7 años` + `informes incompletos`, cada uno linkeado a la fila de F07.
- NL por chips (no input vacío): `[MR >7 años en Brasil]` `[Sin visitar 60 días]` `[Incompletos]` + input libre opcional. Resultado = cards tocables con cita (`Alpha · informe v1 · 2 MR 8–10 años ›`). Pie sutil: `Generado en este teléfono · sin conexión` (model-card completa en Ajustes/F09, no aquí).
- Valor: convierte informes en visita de mañana — "qué equipos envejecen, qué informe cerrar, a quién llamar".

## Backend alone
- `GET /api/dashboard/summary/` pre-computa `opportunities[]` rankeadas (aging primero) + `incomplete[]` con filtros ORM. NL nunca pega al server como IA — online el server devuelve filas; ranking/formato queda on-device.

## Both together
Dashboard renderiza summary server online / local offline con el mismo rank; la caja NL siempre corre local contra lo cacheado.

## QVAC calls
- `ragSearch` (GTE-small) sobre filas agregadas locales + `completion()` del tier activo para formatear (prompt constreñido, cita obligatoria de `site_id`+`report_id`). Jerga de tier/RAG solo en spans → F09, nunca en UI.

## Schema
`Opportunity{site_id, report_id, title, reason, contact_hint, script_2lines, synthetic:true}` + `Dashboard{opportunities[], incomplete[], aging_7y+}` + `NLQuery{query, answer, citations[report_id]}`.

## Acceptance (P0)
- [ ] Seed trae 1 oportunidad MR-aging; el hero aparece con `[Ver informe]` + `[📅 Agendar]`, offline; agendar crea `PlannedVisit` visible en Inicio.
- [ ] NL canónica (chip `MR >7 años en Brasil`) devuelve Alpha con cita tocable, offline, sin mostrar RAG/tier.
- [ ] Hero → informe en 1 tap; incompleto → campo faltante en ≤2 taps.
