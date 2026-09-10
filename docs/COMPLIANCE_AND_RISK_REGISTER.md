# COMPLIANCE_AND_RISK_REGISTER — CIBI

> Self-scored with `judge_feedback` lens + `qvac_compliance_check` (PASS on current design). Re-run both tools before coding and before delivery.

## 1. Compliance matrix (all three tracks, one repo)

| # | Rule (source) | Our answer | Evidence artifact |
|---|---|---|---|
| G1 | Inference on-device or P2P via QVAC SDK; cloud inference = instant DQ (general) | The judged baseline is 100% on the Expo phone via `@qvac/sdk`; optional workstation assistance is allowed only through a verified QVAC/P2P path. Django remains CRUD-only. | `grep`-clean backend + phone perf log + optional peer perf log + airplane-mode video segment |
| G2 | Cloud OK only for non-inference (e.g. UI hosting) | DRF hosting/sync only; no AI keys or model calls. A workstation peer is a separate local QVAC process, not Django or cloud. | `backend/requirements.txt` has no AI libs; architecture doc §§2–3 |
| G3 | Repo accessible + ≤5min video, no login, jury watches first | Public GitHub + unlisted YouTube/drive link on README top | README header |
| G4 | Pre-existing base declared or DQ | README "Base preexistente" section (Expo template + QVAC examples cited) | README |
| T1.1 | Capture→Understand→Structure→Validate→Store→Visualize→Insight | F01→F08 chain, one screen flow | APP_FLOW.md + video timestamps |
| T1.2 | Synthetic data only, no confidential/real competitive info | Fictional hospitals/manufacturers; `synthetic:true` on every record | `seed_synthetic.py` + banner in app |
| T1.3 | MVP: NL capture, extraction, storage, customer view, aggregation | F01, F03, F05, F06, F08 | Demo script |
| T2.1 | ≥1 Psy model central, not cosmetic | 3 Psy models ARE steps 1–3 of the pipeline | F01–F03 + model cards in UI |
| T2.2 | `@qvac/sdk` for ALL core inference + RAG | Phone baseline uses `@qvac/sdk`; optional peer must also use `@qvac/sdk` through verified QVAC/P2P delegation. No Python inference and no arbitrary HTTP proxy. | package/code search + peer path review |
| T2.3 | Useful offline on declared consumer HW | Airplane-mode capture→informe works without the peer; peer mode is a non-blocking enhancement. | F05 + F09 + F10 + video offline segment |
| T2.4 | Disclose all remote APIs / third parties | README lists Expo, DRF host, QVAC/P2P transport/relay if used, and workstation peer; no online search or cloud fallback. | README + F10 |
| T2.5 | Open permissive license REQUIRED | MIT (or Apache-2.0) `LICENSE` file | LICENSE |
| T2.6 | Setup + HW specs for reproducibility | README setup + `qvac doctor` output + device label | README + F09 |
| T2.7 | Honest model/quant/HW names | Exact constants + quants + device in UI + perf log | F09_PERF_LOG |
| T2.8 | Video + structured perf log (load, prompts, tokens, TTFT, throughput) | `PERF_LOG.jsonl` per observation | F09 |
| T2.9 | Full user workflow, not bare SDK call | One visit → intelligence arc | Video + APP_FLOW |
| T2.10 | Medical: limits stated, no clinical claims, safety measures | "Extracción de entidades de equipamiento. No es diagnóstico." everywhere | UI banner + README + video slate |

`qvac_compliance_check` on this design: **PASS** (no cloud-inference pattern; baseline inference is pinned to `@qvac/sdk` on-device, and peer inference is conditional on a verified QVAC/P2P path). The peer delegation surface is still an implementation gate; if it cannot be verified, ship the offline baseline without it.

## 2. Judge self-score (0–10, one fix each — fix before coding if <6)

| Criterion (weight) | Score | Why | One concrete fix |
|---|---|---|---|
| Technical 35 (QVAC on-device genuine?) | 6 | 3-model pipeline is real but unproven on declared phone | D1 AM: smoke-test all 3 loads sequentially on THE device; if MedPsy OOM → lock 2-model fallback now, not D3 |
| Innovation 25 | 8 | Confidence/freshness + model-aware catalog guidance + optional local peer quality mode strengthen the trust story | Show one concrete before/after example: generic guidance offline, then peer-assisted refinement with provenance |
| Impact 20 | 8 | Basement-no-signal + refresh-opportunity story is strong for the corporate juror | Seed 1 "aging MR (>10y) → refresh opportunity" narrative customer for the video |
| Design 10 | 6 | 4 HTML mockups planned, Spanish, offline badge — but untested with a field user | 30-min hallway test of SCREEN_01/02 HTML on a phone browser before coding |
| Completion 10 | 5 | Planning-only today; peer mode and catalog authoring can expand scope | Freeze the catalog to a small curated set; verify peer delegation only after the phone smoke test and keep it removable |

Tie-break order is Technical → Impact → president vote: D1 belongs to the phone, not the backend.

## 3. Top 5 DQ / zero-score risks + mitigations
1. **Accidental cloud inference** (imported AI SDK in backend, map-geocoding LLM, crash-reporter sending prompts) → backend `requirements.txt` allowlist; `grep` gate in FORTY_EIGHT_HOUR_PLAN D3 checklist.
2. **Undeclared base** → README section lists Expo template version + QVAC example files reused, from D1.
3. **Emulator-only demo** → physical-device rule in every feature doc; video shows airplane-mode toggle + device settings frame.
4. **MedPsy framed as diagnosis** → banned-words list ("diagnóstico, síntoma, tratamiento") in F03; disclaimer component in every AI screen.
5. **Perf log vagueness** → F09 pins JSONL schema + measurement points (`loadModel`/`completion`/`translate`/`ocr` stats events) now, not during edit.
6. **P2P mistaken for “anything local”** → do not call a workstation HTTP/OpenAI-compatible endpoint the judged peer path; verify QVAC/P2P delegation and keep the phone baseline independently demoable.
7. **Sensitive media or ungrounded machine advice leaving the phone** → default peer payload to normalized/OCR/structured text + catalog IDs, require explicit peer opt-in, and render catalog provenance plus confidence.
