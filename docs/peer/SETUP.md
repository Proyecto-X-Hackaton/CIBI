# Peer QVAC workstation setup — Fedora 44 / RX 9070 XT / 128 GB RAM

> Status: planning/ops only. This PC is the **optional peer** (P1, non-judged): a local QVAC instance for a 2nd pass with bigger models. The phone (green tier) is the judged flow and works fully offline — this setup never replaces it.
> Gate per F10: peer delegation must be verified via `@qvac/sdk` (surface QVAC/P2P); if no delegation API exists, the peer is omitted rather than proxied through Django/OpenAI. `qvac serve --openai` is a **dev convenience only, never the judged peer path**.

## 0. Host requirements (Fedora 44)

| Requirement | Value on this PC | Check |
|---|---|---|
| OS | Fedora 44 Workstation | `cat /etc/os-release` |
| GPU | AMD Radeon RX 9070 XT (RDNA4, 16 GB VRAM) | `lspci \| grep -iE "vga\|3d"` |
| Vulkan | ≥ 1.4 via RADV (mesa-vulkan-drivers) | `vulkaninfo --summary` |
| Node | ≥ 22.17 | `node --version` |
| RAM | 128 GB (system), 16 GB VRAM | `free -h` |
| Disk | ≥ 5 GB free per model (full roster ≈ 16 GB total) | `df -h /` |

RDNA4 note: RX 9070 XT needs Mesa ≥ 24.3 (gfx1201). Fedora 44 ships Mesa 26.x + RADV with Vulkan 1.4 support — OK out of the box. If you later see no RADV device, update Mesa: `sudo dnf upgrade mesa-*`.

## 1. One-time system prep (run on the PC)

```sh
# Vulkan runtime + tools (RADV for AMD)
sudo dnf install -y vulkan-loader mesa-vulkan-drivers vulkan-tools

# Ensure GPU driver group membership (Fedora usually does this automatically)
sudo usermod -aG render,video $USER
# re-login after this (or `newgrp render video`) so the session picks it up

# Node.js if not installed (Fedora 44 ships Node 24.x — fine for SDK 0.19.0)
node --version || sudo dnf install -y nodejs

# Verify Vulkan sees the GPU
vulkaninfo --summary        # expect "RADV" + "Radeon RX 9070 XT", API version >= 1.4
```

## 2. Install the CLI (brings `@qvac/sdk` as a dependency)

```sh
sudo npm install -g @qvac/cli
qvac --help                 # sanity: commands listed
qvac doctor                 # exit 0 = host passes; --json for machine-readable
```

If non-root global npm is preferred (`npm config get prefix` outside `/usr/*`), drop the `sudo`.

## 3. Project config on the PC

The CLI worked from any directory, but keep one config per use case:

```sh
mkdir -p ~/cibi-peer && cd ~/cibi-peer
```

Copy `qvac.config.json` from this repo (`docs/peer/qvac.config.json`) into `~/cibi-peer/`. It declares:

- **Blue tier (peer structuring)**: `HEALTHCARE_4B_MEDICAL_Q8_0` (MedPsy-4B Q8_0, ~4.7GB) — default LLM (upgraded from Q4_K_M: better anchor quality, still fits VRAM)
- **Super tier (peer fluency)**: `QWEN3_5_9B_MULTIMODAL_Q6_K` (Qwen3.5-9B, ~7.5GB) — verified against the SDK 0.19.0 registry (2026-09-11). Qwen never anchors alone: MedPsy-4B anchors entities, Qwen reasons over text/OCR/candidate. Photo modality stays with green VisionPsy. Blue+super ≈ 12.2GB VRAM, fits the RX 9070 XT 16GB. Projector pairs `MMPROJ_QWEN3_5_9B_MULTIMODAL_BF16/F16` exist if vision is ever added to the peer.
- **Dev parity with the phone (green roster)**: Bergamot ES→EN + PT→EN, VisionPsy-Nano-Flash pair, OCR_LATIN, Parakeet, MedPsy-1.7B, GTE embeddings — so dev builds can iterate against the PC instead of the phone
- The `plugins` key is intentionally omitted: QVAC uses its built-in plugins by default, covering all nine configured model entries

Models download lazily on first request (all entries `preload:false` — no preloading by choice: the server starts instantly and only uses VRAM/RAM for models actually requested; downloads are resumable).

## 4. Deploy the server (dev-only)

```sh
cd ~/cibi-peer
qvac serve --openai          # loopback dev: http://localhost:11434/v1/* (+ /qvac/v1/* surface)
```

For the physical phone to reach it over LAN (dev builds only):

```sh
# API key is mandatory for non-loopback binding
printf '%s' "$(openssl rand -hex 24)" > ~/.qvac/peer.key   # or write any long secret
chmod 600 ~/.qvac/peer.key
sudo firewall-cmd --permanent --add-port=11434/tcp && sudo firewall-cmd --reload
qvac serve --openai --host 0.0.0.0 --api-key-file ~/.qvac/peer.key
```

## 5. Smoke test

```sh
curl http://localhost:11434/v1/models
curl http://localhost:11434/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"healthcare-4b-medical-q8-0","messages":[{"role":"user","content":"Extract equipment entities from: two GE MRI units, one 3T, age 8 years"}]}'
# embeddings + QVAC translation surface:
curl http://localhost:11434/v1/embeddings -H 'Content-Type: application/json' -d '{"model":"embed","input":"resonancia magnetica"}'
curl http://localhost:11434/qvac/v1/translate -H 'Content-Type: application/json' \
  -d '{"model":"translate-es","text":"resonancia magnetica"}'
```

Record spans (load_ms, TTFT, tokens, throughput) into `PERF_LOG.jsonl` rows with `mode:"peer"` + this HW (`Build.MODEL`/PC model, RX 9070 XT, 128 GB RAM) — same schema as F09.

## 6. Troubleshooting observed on first serve (Fedora, sudo global install)

- **`EPERM: operation not permitted, chmod '.../bare-runtime-linux-x64/bin/bare'`** — the CLI was installed with `sudo`, so the bare worker binary is root-owned and the runtime cannot chmod it. Fix (pick one):
  ```sh
  sudo chown -R muffin:muffin /usr/local/lib/node_modules/@qvac   # quick fix
  # or cleanly reinstall under the user prefix:
  sudo npm uninstall -g @qvac/cli && npm config set prefix ~/.local && npm install -g @qvac/cli
  ```
- **NMT preload fails with `Invalid discriminator value. Expected 'Bergamot' | 'IndicTrans' → at modelConfig.engine`** — `serve.models` entries for Bergamot require an explicit config: `"config": { "engine": "Bergamot", "from": "es", "to": "en" }`. Fixed in `qvac.config.json` (both translate entries).
- **`ffmpeg not on PATH`** — warning only; affects video / mp3-opus-aac-flac speech endpoints, none of this roster. Install optionally (`ffmpeg` via RPM Fusion).
- **No preload by design** — every entry is `preload:false`: server starts instantly; the first request naming a model blocks while it loads (one-time cold start, then resident). Benchmarks should exclude the first call or label it `cold`.
- **Duplicate blue entry** — keep ONE blue alias (the Q8_0 one); if an older `medpsy-4b` Q4_K_M entry lingers in the PC config, delete it (or `preload:false` + never request it).

## 7. What is NOT configured here

- Cloud inference, Django/OpenAI proxying, emulator setups → banned (DQ guardrail)
- `serve --openai` in the judged path/video → dev only
- Super tier: `qwen3-5-9b-multimodal-q6-k` (`QWEN3_5_9B_MULTIMODAL_Q6_K`) ships in `qvac.config.json` (verified in SDK 0.19.0 registry); enablement still waits on the `@qvac/sdk` delegation gate
- Super tier wiring depends on the verified `@qvac/sdk` delegation API (F10 gate); if missing, blue is the peer ceiling