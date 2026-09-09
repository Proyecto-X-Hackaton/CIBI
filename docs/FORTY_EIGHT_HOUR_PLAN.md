# FORTY_EIGHT_HOUR_PLAN — CIBI (Sep 9 08:00 → Sep 11 08:00 Panama)

> Generated from `hackathon_plan(track1)` + jury weights (Technical 35 / Innovation 25 / Impact 20 / Design 10 / Completion 10). Teams locked Sep 9 08:00. Deliver: public repo + ≤5min video link (no login). All times America/Panama.

## D1 — Prove it runs on the phone (Technical 35%)
- **AM:** repo skeleton (`frontend/`, `backend/`, `docs/`), README base declaration, LICENSE (MIT), `qvac doctor` green on 2 dev machines, `seed_synthetic.py` with 6 fictional hospitals (incl. Hospital Alpha–São Paulo). `compliance_check` PASS gate.
- **PM:** on-device pipeline vertical slice: ES text → TranslatePsy → MedPsy JSON → SQLite → Customer-360 screen. Sequential `load→infer→unload` + first `PERF_LOG.jsonl` rows. **Go/no-go:** if MedPsy-1.7B-Q4 fails twice on declared device, lock fallback (TranslatePsy + VisionPsy, regex structuring) and note it honestly in README. No backend AI, ever. Do not start peer work until this passes.
- **Exit:** airplane-mode video of the slice on the physical device (30s, unedited).

## D2 AM — Trust + novelty (Innovation 25 + Impact 20%)
- Confidence chips (Confirmed/Reported/Estimated/Unknown), freshness badges, 1–2 follow-up questions for top missing field, local machine-catalog guidance, embedding dedup warning, "trust delta" metric + aging-refresh opportunity card (the corporate-juror hook). Seed the >10y MR customer.
- Only after the offline slice is green: verify whether the QVAC/P2P peer-delegation surface is available. If yes, add optional workstation MedPsy-4B/Qwen comparison with provenance and perf logging; if not, cut it without changing P0.

## D2 PM — Design 10% (2–4 screens, Spanish)
- Build from `docs/ui-ux-plan/*.html`: 01 Capture → 02 Review/Validate → 03 Customer-360 → 04 Map/Dashboard. Offline badge + model cards + disclaimer on every AI screen. Hallway-test HTML on a phone browser first (30 min).

## D3 AM — Completion 10% (rehearse + deliver)
- Offline rehearsal in the exact video location; full dry run with airplane mode ON.
- Record ≤5min Spanish video, one arc with timestamps: 0:00 problema (sótano sin señal) → 0:45 captura ES/PT + foto → 2:30 estructuración + validación → 3:30 Customer-360 + mapa → 4:15 dashboard oportunidad + perf log + disclaimer → 4:50 cierre offline.
- Deliver checklist: public repo, LICENSE, README (setup + HW + models/quants + remote-API table + base declaration), `PERF_LOG.jsonl`, video link without login, `judge_feedback` self-score ≥6 everywhere, final `compliance_check` PASS, backend `grep` gate (no torch/transformers/openai), synthetic-only `grep` (no real hospital names), and optional peer disclosure/model perf only if the verified QVAC/P2P path ships.

## Role split (1–4 people)
- **On-device owner:** Expo + `@qvac/sdk`, perf log, physical device. **Backend owner:** DRF CRUD/sync/aggregates + admin. **Flow owner:** HTML mockups → screens, video script. If solo: D1 phone → D2 backend → D2 PM UI → D3 video, in that order; cut P1 first.
