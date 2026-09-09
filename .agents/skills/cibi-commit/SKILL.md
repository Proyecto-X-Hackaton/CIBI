---
name: cibi-commit
description: Write and send git commits for the CIBI repo (Proyecto-X-Hackaton/CIBI). Use when the user asks to commit, write a commit message, stage changes, or push in this project. Enforces Conventional Commits, compliance grep gates, and never-auto-push policy.
---

# CIBI Commit Skill

Write and send commits for **CIBI** (Customer Installed-Base Intelligence, on-device hackathon project). Repo: `https://github.com/Proyecto-X-Hackaton/CIBI`, branch `main`.

## Workflow

1. **Inspect** what changed:
   ```sh
   git --no-optional-locks status --short
   git --no-pager diff --staged
   git --no-pager diff
   ```
2. **Run compliance gates BEFORE staging** (project rule — a commit must never break these):
   - If `backend/` exists and has files: `grep -riE "torch|transformers|openai" backend/` → must be empty (zero AI libs in backend).
   - No cloud-inference calls anywhere in `frontend/` outside `@qvac/sdk` usage.
   - No real hospital/manufacturer names — synthetic/fictional data only (`synthetic:true` on records).
   - No secrets, tokens, `.env`, device serials, or signing keys staged.
   If a gate fails, STOP, report the offending lines to the user, do not commit.
3. **Stage selectively.** Prefer explicit `git add <paths>` over `git add -A`. Group unrelated changes into separate commits (e.g., one commit for `docs/features/F05…`, another for `frontend/` scaffold).
4. **Draft the message** per the conventions below and show it to the user verbatim before committing, unless they said "commit and push" / clearly want it done in one go.
5. **Commit**:
   ```sh
   GIT_EDITOR=true git commit -m "<subject>" -m "<body>"
   ```
6. **Push only on explicit request.** Default is local commit only. When pushing: `git push origin main`. Never force-push. Never create branches unless asked.

## Message conventions

Conventional Commits, English, imperative mood.

```
<type>(<scope>): <subject ≤50 chars, no trailing period>

<body: why, not what; wrap at ~72 chars; only when the "why" isn't obvious>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`.

**Scopes** (use the project's own vocabulary):

| Scope | Use for |
|---|---|
| `frontend` | Expo/React Native app code (`frontend/`) |
| `backend` | DRF CRUD/sync/aggregates (`backend/`) |
| `qvac` | `@qvac/sdk` integration, model configs, `qvac.config.json`, lifecycle/perf logging |
| `docs` | Planning docs in `docs/`; use feature sub-scope when a feature doc changes, e.g. `docs(F05): …` |
| `ui` | Screens/mockups (`docs/ui-ux-plan/`, Spanish UI strings) |
| `compliance` | LICENSE, README base declaration, PERF_LOG, risk register, disclaimers |
| `video` | Video script/slates/recording assets |
| `repo` | `.gitignore`, CI, editor config, skills |

**Body content that matters for this project** — mention when applicable:
- Which P0/P1 feature (F01–F09) the change advances.
- Compliance implications (offline path preserved? disclaimer added? synthetic data?).
- Device/perf notes if a model or quant changed (e.g., "switches VisionPsy to Q4_K_M — RAM-bound on declared device").

## Examples

```
docs(F05): define offline outbox sync contract

SQLite queue → DRF upsert so capture survives airplane mode (P0).
Server receives already-structured JSON only; zero inference backend-side.
```

```
feat(qvac): sequential load→infer→unload with perf spans

One model resident at a time (RAM < 4 GB on target device). Logs
load_ms, TTFT and throughput to PERF_LOG.jsonl per F09.
```

```
chore(repo): add MIT LICENSE and README base declaration

Track 2 requires open license + pre-existing-base disclosure; omission is DQ.
```

## Guardrails

- Never amend/rebase pushed commits; stack a fixup commit instead.
- Never commit `node_modules/`, `.expo/`, `ios/build`, `android/app/build`, model weight files (`.gguf`, `.onnx`), or raw user speech text in logs — log metrics, not PII.
- Keep commits coherent with the 48h plan phases (D1 device slice → D2 trust/UI → D3 video); when a commit unblocks a milestone, say so in the body.
- If the working tree mixes planning docs and code, split them into separate commits.
