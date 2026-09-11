// qvacClient.ts — the ONLY module that talks to @qvac/sdk.
// Rules (locked, do not relax):
//  - Sequential load → infer → unload, ONE model resident at a time
//    (RAM < 4GB kills parallel loads). A promise mutex serializes everything.
//  - Every span is logged via perf.logSpan (F09).
//  - No cloud calls, no backend inference: this file never uses fetch/http.
//    P1 peer HTTP is intentionally isolated in peerClient.ts; this module
//    remains the on-device @qvac/sdk path only.
//
// Verified against @qvac/sdk 0.19.0 .d.ts:
//  loadModel({modelSrc, modelType?, modelConfig?, onProgress?}) → modelId
//  downloadAsset({assetSrc, onProgress?})
//  completion({modelId, history, stream?}) → CompletionRun
//    canonical: events (AsyncIterable) + final (Promise); legacy: tokenStream/text/stats
//  translate({modelId, text, from?, to?, modelType?, stream?})
//    → {tokenStream, translations:Promise, text:Promise, stats, requestId}
//  ocr({modelId, image, options?, stream?}) → {blockStream, blocks:Promise, stats}
//  transcribe({modelId, audioChunk}) → Promise<string> (+requestId)
//  ragIngest({modelId, workspace, documents, chunk?})
//  ragSearch({modelId, workspace, query, topK})
//  embed({modelId, text})
//  unloadModel({modelId, clearStorage:false})

import {
  loadModel,
  unloadModel,
  downloadAsset,
  completion,
  translate,
  ocr,
  transcribe,
  ragIngest,
  ragSearch,
  embed,
} from '@qvac/sdk';
import { logSpan, deviceLabel } from './perf';
import type { TierId } from './TIER_ROSTER';

// ---- on-device tier guard (P1 peer is HTTP, not SDK delegation) ----
// @qvac/sdk 0.19.0 has no remote inference-delegation API. The explicit
// LAN adapter lives in peerClient.ts; this guard ensures an accidental peer
// tier passed to the on-device worker can never load a peer model on-phone.
export const PEER_VERIFIED = false; // remote peer verification is separate

/** Requested tier → tier actually runnable on this device. */
export function effectiveTier(requested: TierId): TierId {
  if (requested === 'CIBI') return 'CIBI';
  return PEER_VERIFIED ? requested : 'CIBI';
}

// ---- one-model-at-a-time mutex ----
let queue: Promise<void> = Promise.resolve();

export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

export interface ProgressCb {
  (pct: number | null, stage: string): void;
}

function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  return fn().then((value) => ({ value, ms: Date.now() - t0 }));
}

export async function safeUnload(modelId: string | null): Promise<void> {
  if (!modelId) return;
  try {
    await unloadModel({ modelId, clearStorage: false });
  } catch {
    // unload failure must not break the flow; next load replaces residency
  }
}

// ---- text extraction compatible with both SDK surfaces ----
export async function collectCompletion(run: any): Promise<{ text: string; stats: any }> {
  let text = '';
  try {
    if (run && run.tokenStream) {
      for await (const token of run.tokenStream) text += token;
    } else if (run && run.events) {
      for await (const ev of run.events) {
        if (ev && ev.type === 'contentDelta' && typeof ev.text === 'string') text += ev.text;
      }
    } else if (run && run.text) {
      text = String(await run.text);
    }
  } catch {
    // partial text kept
  }
  let stats: any = undefined;
  try {
    if (run && run.stats) stats = await run.stats;
    else if (run && run.final) stats = (await run.final)?.stats;
  } catch {
    stats = undefined;
  }
  return { text, stats };
}

async function collectTranslation(res: any): Promise<{ text: string; stats: any }> {
  let text = '';
  try {
    if (res && res.tokenStream) {
      for await (const token of res.tokenStream) text += token;
    }
    if (!text && res && res.text) text = String(await res.text);
    if (!text && res && res.translations) {
      const arr = await res.translations;
      text = Array.isArray(arr) ? arr.join('\n') : String(arr ?? '');
    }
  } catch {
    // partial kept
  }
  let stats: any = undefined;
  try {
    if (res && res.stats) stats = await res.stats;
  } catch {
    stats = undefined;
  }
  return { text, stats };
}

export interface LoadedHandle {
  modelId: string;
  load_ms: number;
  /** Resolved tier (effectiveTier) — source of truth for every span. */
  tier: TierId;
}

/** downloadAsset (progress UX) + loadModel, with perf 'load' span. */
export async function acquireModel(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  quant: string;
  engine: string;
  modelType?: string;
  modelConfig?: Record<string, any>;
  ctx_size?: number | null;
  image_no_upscale?: string | null;
  phase?: string;
  prompt_chars?: number;
  onProgress?: ProgressCb;
}): Promise<LoadedHandle> {
  const t0 = Date.now();
  const tier = effectiveTier(opts.tier);
  try {
    opts.onProgress?.(0, 'download');
    await downloadAsset({
      assetSrc: opts.modelConst,
      onProgress: (p: any) => opts.onProgress?.(Math.round(p?.percentage ?? 0), 'download'),
    }).catch(() => {
      // downloadAsset is progress UX; loadModel re-fetches if needed
    });
    opts.onProgress?.(null, 'load');
    const loadParams: any = { modelSrc: opts.modelConst };
    if (opts.modelType) loadParams.modelType = opts.modelType;
    if (opts.modelConfig) loadParams.modelConfig = opts.modelConfig;
    loadParams.onProgress = (p: any) => opts.onProgress?.(Math.round(p?.percentage ?? 0), 'load');
    const modelId: string = await loadModel(loadParams);
    const load_ms = Date.now() - t0;
    await logSpan({
      ts: new Date().toISOString(),
      device: deviceLabel(),
      tier,
      model: opts.modelName,
      quant: opts.quant,
      engine: opts.engine,
      phase: 'load',
      prompt_chars: opts.prompt_chars ?? 0,
      tokens_in: 0,
      tokens_out: 0,
      ttft_ms: null,
      throughput_tps: null,
      load_ms,
      ctx_size: opts.ctx_size ?? null,
      image_no_upscale: opts.image_no_upscale ?? null,
      mode: 'offline',
      peer_id: null,
      ok: true,
    });
    return { modelId, load_ms, tier };
  } catch (e: any) {
    await logSpan({
      ts: new Date().toISOString(),
      device: deviceLabel(),
      tier,
      model: opts.modelName,
      quant: opts.quant,
      engine: opts.engine,
      phase: 'load',
      prompt_chars: 0,
      tokens_in: 0,
      tokens_out: 0,
      ttft_ms: null,
      throughput_tps: null,
      load_ms: Date.now() - t0,
      ctx_size: opts.ctx_size ?? null,
      image_no_upscale: opts.image_no_upscale ?? null,
      mode: 'offline',
      peer_id: null,
      ok: false,
      error: String(e?.message ?? e),
    });
    throw e;
  }
}

export function statsToSpan(stats: any): { tokens_in: number; tokens_out: number; ttft_ms: number | null; throughput_tps: number | null } {
  if (!stats) return { tokens_in: 0, tokens_out: 0, ttft_ms: null, throughput_tps: null };
  return {
    tokens_in: Number(stats.tokensIn ?? stats.promptTokens ?? stats.inputTokens ?? stats.cacheTokens ?? 0) || 0,
    tokens_out: Number(stats.tokensOut ?? stats.completionTokens ?? stats.generatedTokens ?? stats.emittedTokens ?? stats.totalTokens ?? stats.tokens ?? 0) || 0,
    ttft_ms: stats.ttftMs ?? stats.timeToFirstTokenMs ?? stats.timeToFirstToken ?? stats.ttft ?? null,
    throughput_tps: stats.tokensPerSecond ?? stats.throughput ?? stats.tps ?? null,
  };
}

/** Run a text completion with automatic acquire → infer → unload. Serialized. */
export async function runCompletion(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  quant: string;
  engine: string;
  modelConfig?: Record<string, any>;
  ctx_size?: number | null;
  image_no_upscale?: string | null;
  history: Array<{ role: 'user' | 'assistant'; content: string; attachments?: Array<{ path: string }> }>;
  /** Max tokens to generate. Caps runaway outputs on slow phones. */
  predict?: number;
  onProgress?: ProgressCb;
}): Promise<{ text: string; load_ms: number }> {
  return serialized(async () => {
    let modelId: string | null = null;
    try {
      const prompt_chars = opts.history.map((h) => h.content.length).reduce((a, b) => a + b, 0);
      const h = await acquireModel({ ...opts, prompt_chars, onProgress: opts.onProgress });
      modelId = h.modelId;
      opts.onProgress?.(null, 'infer');
      const tier = h.tier;
      const t0 = Date.now();
      const run: any = completion({
        modelId,
        history: opts.history as any,
        stream: true,
        ...(opts.predict != null ? { generationParams: { predict: opts.predict } } : {}),
      });
      const ttftTimer = Date.now();
      void ttftTimer;
      const { text, stats } = await collectCompletion(run);
      const s = statsToSpan(stats);
      await logSpan({
        ts: new Date().toISOString(),
        device: deviceLabel(),
        tier,
        model: opts.modelName,
        quant: opts.quant,
        engine: opts.engine,
        phase: 'completion',
        prompt_chars,
        tokens_in: s.tokens_in,
        tokens_out: s.tokens_out,
        ttft_ms: s.ttft_ms,
        throughput_tps: s.throughput_tps,
        load_ms: h.load_ms,
        ctx_size: opts.ctx_size ?? null,
        image_no_upscale: opts.image_no_upscale ?? null,
        mode: 'offline',
        peer_id: null,
        ok: true,
      });
      void t0;
      return { text, load_ms: h.load_ms };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}

/** Run NMT translation with automatic acquire → infer → unload. Serialized. */
export async function runTranslate(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  quant: string;
  from: string;
  to: string;
  text: string | string[];
  onProgress?: ProgressCb;
}): Promise<{ text: string; translations: string[] }> {
  return serialized(async () => {
    let modelId: string | null = null;
    try {
      const prompt_chars = Array.isArray(opts.text) ? opts.text.join('\n').length : opts.text.length;
      const h = await acquireModel({
        tier: opts.tier,
        modelConst: opts.modelConst,
        modelName: opts.modelName,
        quant: opts.quant,
        engine: 'nmtcpp-translation',
        modelType: 'nmtcpp-translation',
        modelConfig: { engine: 'Bergamot', from: opts.from, to: opts.to },
        prompt_chars,
        onProgress: opts.onProgress,
      });
      modelId = h.modelId;
      // NMT translate params are {modelId, text, stream, modelType} — from/to
      // live in loadModel modelConfig (verified against SDK 0.19.0 zod schema).
      const res: any = translate({
        modelId,
        text: opts.text,
        modelType: 'nmtcpp-translation',
        stream: true,
      });
      const { text, stats } = await collectTranslation(res);
      const s = statsToSpan(stats);
      await logSpan({
        ts: new Date().toISOString(),
        device: deviceLabel(),
        tier: h.tier,
        model: opts.modelName,
        quant: opts.quant,
        engine: 'nmtcpp-translation',
        phase: 'translate',
        prompt_chars,
        tokens_in: s.tokens_in,
        tokens_out: s.tokens_out,
        ttft_ms: s.ttft_ms,
        throughput_tps: s.throughput_tps,
        load_ms: h.load_ms,
        ctx_size: null,
        mode: 'offline',
        peer_id: null,
        ok: true,
      });
      const translations = text.split('\n');
      return { text, translations };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}

/** Run ONNX OCR with automatic acquire → infer → unload. Serialized. */
export async function runOcr(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  image: string;
  onProgress?: ProgressCb;
}): Promise<{ blocks: Array<{ text: string; bbox?: number[]; confidence?: number }> }> {
  return serialized(async () => {
    let modelId: string | null = null;
    try {
      const h = await acquireModel({
        tier: opts.tier,
        modelConst: opts.modelConst,
        modelName: opts.modelName,
        quant: '—',
        engine: 'ggml-ocr',
        modelType: 'ggml-ocr',
        prompt_chars: 0,
        onProgress: opts.onProgress,
      });
      modelId = h.modelId;
      const res: any = ocr({ modelId, image: opts.image, options: { paragraph: false } });
      const blocks = (await res.blocks) as Array<{ text: string; bbox?: number[]; confidence?: number }>;
      let stats: any;
      try {
        stats = await res.stats;
      } catch {
        stats = undefined;
      }
      const s = statsToSpan(stats);
      await logSpan({
        ts: new Date().toISOString(),
        device: deviceLabel(),
        tier: h.tier,
        model: opts.modelName,
        quant: '—',
        engine: 'ggml-ocr',
        phase: 'ocr',
        prompt_chars: 0,
        tokens_in: 0,
        tokens_out: 0,
        ttft_ms: s.ttft_ms,
        throughput_tps: null,
        load_ms: h.load_ms,
        ctx_size: null,
        mode: 'offline',
        peer_id: null,
        ok: true,
      });
      return { blocks: blocks ?? [] };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}

/** Run Parakeet transcription (stretch) with acquire → infer → unload. Serialized. */
export async function runTranscribe(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  quant: string;
  audioPath: string;
  onProgress?: ProgressCb;
}): Promise<{ text: string }> {
  return serialized(async () => {
    let modelId: string | null = null;
    try {
      const h = await acquireModel({
        tier: opts.tier,
        modelConst: opts.modelConst,
        modelName: opts.modelName,
        quant: opts.quant,
        engine: 'parakeet-transcription',
        modelType: 'parakeet-transcription',
        prompt_chars: 0,
        onProgress: opts.onProgress,
      });
      modelId = h.modelId;
      const text = (await transcribe({ modelId, audioChunk: opts.audioPath })) as unknown as string;
      await logSpan({
        ts: new Date().toISOString(),
        device: deviceLabel(),
        tier: h.tier,
        model: opts.modelName,
        quant: opts.quant,
        engine: 'parakeet-transcription',
        phase: 'transcribe',
        prompt_chars: 0,
        tokens_in: 0,
        tokens_out: 0,
        ttft_ms: null,
        throughput_tps: null,
        load_ms: h.load_ms,
        ctx_size: null,
        mode: 'offline',
        peer_id: null,
        ok: true,
      });
      return { text: String(text ?? '') };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}

/** RAG ingest + search in one residency (dedup workspace per site). Serialized. */
export async function runRagSearch(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  quant: string;
  workspace: string;
  seedDocs: string[];
  query: string;
  topK?: number;
  onProgress?: ProgressCb;
}): Promise<{ results: Array<{ content: string; score: number }> }> {
  return serialized(async () => {
    let modelId: string | null = null;
    try {
      const h = await acquireModel({
        tier: opts.tier,
        modelConst: opts.modelConst,
        modelName: opts.modelName,
        quant: opts.quant,
        engine: 'llamacpp-embedding',
        prompt_chars: opts.query.length,
        onProgress: opts.onProgress,
      });
      modelId = h.modelId;
      if (opts.seedDocs.length > 0) {
        await ragIngest({ modelId, workspace: opts.workspace, documents: opts.seedDocs, chunk: false }).catch(() => null);
      }
      const results = (await ragSearch({ modelId, workspace: opts.workspace, query: opts.query, topK: opts.topK ?? 3 })) as any[];
      await logSpan({
        ts: new Date().toISOString(),
        device: deviceLabel(),
        tier: h.tier,
        model: opts.modelName,
        quant: opts.quant,
        engine: 'llamacpp-embedding',
        phase: 'ragSearch',
        prompt_chars: opts.query.length,
        tokens_in: 0,
        tokens_out: 0,
        ttft_ms: null,
        throughput_tps: null,
        load_ms: h.load_ms,
        ctx_size: null,
        mode: 'offline',
        peer_id: null,
        ok: true,
      });
      return { results: (results ?? []).map((r: any) => ({ content: String(r?.content ?? ''), score: Number(r?.score ?? 0) })) };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}

/** Single/batch embeddings (fallback path uses keyword overlap, not this). */
export async function runEmbed(opts: {
  tier: TierId;
  modelConst: any;
  modelName: string;
  quant: string;
  text: string | string[];
  onProgress?: ProgressCb;
}): Promise<{ vectors: number[][] }> {
  return serialized(async () => {
    let modelId: string | null = null;
    try {
      const h = await acquireModel({
        tier: opts.tier,
        modelConst: opts.modelConst,
        modelName: opts.modelName,
        quant: opts.quant,
        engine: 'llamacpp-embedding',
        prompt_chars: Array.isArray(opts.text) ? opts.text.join(' ').length : opts.text.length,
        onProgress: opts.onProgress,
      });
      modelId = h.modelId;
      const res: any = await embed({ modelId, text: opts.text as any });
      const vectors: number[][] = Array.isArray(opts.text)
        ? (res.embedding as number[][])
        : [res.embedding as number[]];
      await logSpan({
        ts: new Date().toISOString(),
        device: deviceLabel(),
        tier: h.tier,
        model: opts.modelName,
        quant: opts.quant,
        engine: 'llamacpp-embedding',
        phase: 'embed',
        prompt_chars: Array.isArray(opts.text) ? opts.text.join(' ').length : (opts.text as string).length,
        tokens_in: 0,
        tokens_out: 0,
        ttft_ms: null,
        throughput_tps: null,
        load_ms: h.load_ms,
        ctx_size: null,
        mode: 'offline',
        peer_id: null,
        ok: true,
      });
      return { vectors };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}

export { timed };
export type { ProgressCb as QvacProgress };
