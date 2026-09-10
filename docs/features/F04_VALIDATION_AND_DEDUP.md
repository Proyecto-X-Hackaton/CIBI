# F04_VALIDATION_AND_DEDUP — follow-ups, duplicados, confianza, frescura

> Goal: convertir inspecciones en datos *confiables*. Jury: Track1 "Intelligent Validation" + trust-delta de Innovación.
> UX locked: follow-ups (≤2) viven en el chat y en Revisar como pregunta del asistente (tier pill, sin modelos). Dedup advierte, nunca auto-fusiona. La inspección sigue editable aunque ya tenga informe.

## Frontend alone (Expo + `@qvac/sdk`)
- **Follow-ups (máx 2):** regla elige el campo más valioso (fabricante > edad > qty) → el asistente genera UNA pregunta ("¿Fabricante del CT?") → la respuesta parchea el JSON, confianza sube `Unknown→Reported`.
- **Dedup:** embedding pequeño + workspace RAG local con items existentes de la sede → `ragSearch` del item nuevo → similitud >0.85 muestra "¿Es el mismo MR que…?" con ver/fusionar/mantener-ambos. Fallback: overlap de keywords. RAG built-in es prototype-grade — disclosed.
- **Chips confianza/frescura:** por item `Confirmed|Reported|Estimated|Unknown` + `fresh (<30d) | stale (>180d)` desde `observed_at`. Stale → nudge "re-verificar".

## Backend alone (DRF, zero inference)
- Guarda `supersedes, merged_into, confidence, observed_at`; el endpoint de informe devuelve historial + frescura por fechas (aritmética, no IA). Candidatos de duplicado del teléfono se guardan como links, nunca auto-merge server-side.

## Both together
`JSON estructurado → loop follow-up local → dedup local → usuario resuelve → POST con links → informe muestra linaje` — la confianza se construye on-device, se audita en server.

## QVAC calls
- `loadModel({GTE small embedding})` → `ragIngest` workspace local por sede → `ragSearch` por item nuevo → `unloadModel`. Pregunta generada por el tier activo (prompt constreñido F03).

## Schema
`Validation{observation_id, followups[{question, answer, patched_field}], duplicates[{candidate_id, similarity, resolution:fusionado|ambos}], confidence_map, freshness}`.

## Acceptance (P0)
- [ ] "Two CTs" dispara ≤2 preguntas y sube confianza al responder.
- [ ] Re-enviar el mismo MR advierte en vez de duplicar.
- [ ] El informe muestra de dónde vino cada dato + cuándo.
