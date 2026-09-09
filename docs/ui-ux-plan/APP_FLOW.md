# APP_FLOW — screen + data flow (mermaid)

> Navegación: 4 destinos top-level en tabs. Wizard sin tabs. UI en español. Toda pantalla con IA: badge offline + model cards + disclaimer.
> Top-level tabs: `Inicio | (+) Nueva | Red | Ajustes`. Wizard: stepper superior, sin tabbar.

## 1. End-to-end visit flow (the video arc)

```mermaid
flowchart LR
    H[00 HOME<br/>historial + buscar + re-generar] --> W1[01 CHAT-CAPTURA<br/>voz/texto ES-PT + guía experta]
    W1 --> NORM[NORMALIZE<br/>TranslatePsy ES-PT to EN<br/>original siempre guardado]
    NORM --> CHATLOOP{¿Falta campo valioso<br/>o hay foto útil?}
    CHATLOOP -- sí --> GUIDE[Guía catálogo F10<br/>POI + prioridad foto<br/>+ pregunta al personal ≤2]
    GUIDE --> W1
    CHATLOOP -- foto autorizada --> SEEREAD[SEE + READ<br/>VisionPsy-Flash + OCR]
    SEEREAD --> W1
    W1 --> STRUCT[STRUCTURE<br/>MedPsy JSON + confianza]
    STRUCT --> R[02 REVISAR<br/>tabla + duplicado + parches]
    R -->|confirmar| STORE[STORE<br/>SQLite outbox → DRF sync]
    STORE --> FICHA[03 FICHA 360<br/>perfil confiable por sede]
    STORE --> RED[04 RED<br/>drill-down + dashboard lite]
    H --> FICHA
    H --> RED
    RED --> FICHA
    FICHA --> W1
```

## 2. Screen navigation (tabs vs wizard)

```mermaid
stateDiagram-v2
    state Tabs {
        [*] --> Home
        Home --> Ficha360 : abrir sede
        Home --> Red : ver red
        Red --> Ficha360 : drill-down
        Ficha360 --> ChatCaptura : nueva observación
        Home --> ChatCaptura : + nueva visita / continuar borrador
        Home --> Ajustes : configurar peer
        Ajustes --> Home : volver
    }
    state WizardSinTabs {
        ChatCaptura --> Revisar : pasar a revisar
        Revisar --> ChatCaptura : volver al chat
        Revisar --> Ficha360 : confirmar y guardar
        ChatCaptura --> Home : salir / guardar borrador
        Revisar --> Home : salir / guardar borrador
    }
```

Reglas:

* Tabs nunca representan pasos. Solo `Inicio / Nueva / Red / Ajustes`.
* Wizard (`01`, `02`) NO tiene tabbar. Tiene `< Salir`, stepper superior `Paso 1 de 2 / 2 de 2`, CTA inferior `Pasar a revisar / Confirmar y guardar`, y `Guardar borrador`.
* `03 Ficha` NO es `Paso 3`. Es destino persistente desde `Inicio` o `Red`.
* `05 Ajustes` es top-level, no parte del wizard.

## 3. Chat-captura loop (the expert feeling)

```mermaid
sequenceDiagram
    participant U as Ingeniera (ES/PT voz+texto+foto)
    participant A as App Expo + @qvac/sdk
    participant C as Catálogo local F10
    participant L as SQLite local
    U->>A: mensaje voz/texto (Parakeet-TDT/STT + TranslatePsy)
    A->>C: match alias exacto → embedding → fallback modalidad
    C-->>A: POI + prioridad foto + ≤2 preguntas
    A->>A: MedPsy-1.7B resume guía (no inventa modelo)
    A-->>U: burbuja experta + chips confianza + sugerencia foto por equipo
    U->>A: foto autorizada (VisionPsy-Flash + OCR)
    A->>A: parchea JSON candidato + RAG dedup (GTE-small)
    A->>L: guarda borrador + spans perf
    Note over A,L: TTS salida con Expo Speech (STT sigue QVAC). Un modelo residente a la vez: load→infer→unload.
```

## 4. Confidence lifecycle (the trust story)

```mermaid
flowchart TD
    U[Unknown<br/>campo ausente] --> R[Reported<br/>dicho una vez]
    R --> E[Estimated<br/>inferido foto-edad]
    R --> C[Confirmed<br/>revisita o foto+OCR coinciden]
    E --> C
    C --> S polite: STALE?
    S -- >180 días --> RV[re-verificar]
    RV --> C
```

## 5. Offline-first data path + optional peer (P1)

```mermaid
sequenceDiagram
    participant U as Ingeniera
    participant A as App Expo + @qvac/sdk
    participant L as SQLite local
    participant P as Peer QVAC local opcional
    participant S as DRF backend (solo CRUD)
    U->>A: chat ES + foto (modo avión)
    A->>A: TranslatePsy, VisionPsy+OCR, MedPsy
    A->>L: guarda visita + JSON + perf spans (PENDING)
    Note over A,L: Ficha + Red ya funcionan offline
    U->>A: reconecta / habilita peer
    A->>P: solo si opt-in: texto EN + OCR + candidato + catalog IDs (foto/audio solo con permiso explícito)
    P-->>A: segundo candidato (MedPsy-4B / Qwen exacto)
    A-->>U: diff Teléfono vs Equipo local → usuario elige, nunca reemplazo silencioso
    A->>L: guarda elección + provenance {mode: offline|peer}
    U->>A: con internet
    A->>S: POST /api/sync/push/ idempotente (JSON estructurado, cero inferencia)
    S->>A: ids + agregados
    A->>L: marca SYNCED + refresca
```

Peer NO es Django. Django nunca carga modelos. `qvac serve --openai` solo dev.

Previews: `SCREEN_00_HOME.html`, `SCREEN_01_CAPTURE.html` (chat), `SCREEN_02_REVIEW_VALIDATE.html`, `SCREEN_03_CUSTOMER_360.html` (ficha), `SCREEN_04_MAP_DASHBOARD.html`, `SCREEN_05_SETTINGS.html` — abrir en ventana angosta de teléfono; hallway-test antes de codificar.
