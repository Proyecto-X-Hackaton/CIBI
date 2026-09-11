// turn.ts — one chat turn, ONE MedPsy residency.
// Previously each message paid two full 1.28GB load→unload cycles
// (structure, then dialogue). Now: acquire once → infer structure →
// infer dialogue → unload. Roughly halves per-turn latency on CPU.

import { completion, HEALTHCARE_1_7B_MEDICAL_Q4_K_M } from '@qvac/sdk';
import {
  serialized,
  acquireModel,
  safeUnload,
  collectCompletion,
  statsToSpan,
  type ProgressCb,
} from './qvacClient';
import { logSpan, deviceLabel } from './perf';
import {
  buildStructureHistory,
  parseStructureText,
  structureFallback,
  type StructuredReport,
} from './structure';
import {
  buildDialogueHistory,
  parseDialogueText,
  fallbackDialogueReply,
  type DialogueTurn,
} from './conversation';

const MODEL_NAME = 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M';

async function inferOnce(opts: {
  modelId: string;
  load_ms: number;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  predict: number;
  onProgress?: ProgressCb;
}): Promise<string> {
  opts.onProgress?.(null, 'infer');
  const run: any = completion({
    modelId: opts.modelId,
    history: opts.history as any,
    stream: true,
    generationParams: { predict: opts.predict },
  });
  const { text, stats } = await collectCompletion(run);
  const s = statsToSpan(stats);
  await logSpan({
    ts: new Date().toISOString(),
    device: deviceLabel(),
    tier: 'CIBI',
    model: MODEL_NAME,
    quant: 'Q4_K_M',
    engine: 'llamacpp-completion',
    phase: 'completion',
    prompt_chars: opts.history.map((h) => h.content.length).reduce((a, b) => a + b, 0),
    tokens_in: s.tokens_in,
    tokens_out: s.tokens_out,
    ttft_ms: s.ttft_ms,
    throughput_tps: s.throughput_tps,
    load_ms: opts.load_ms,
    ctx_size: 2048,
    image_no_upscale: null,
    mode: 'offline',
    peer_id: null,
    ok: true,
  });
  return text;
}

export async function answerChatTurn(opts: {
  textEn: string;
  userText: string;
  lang: 'es' | 'pt';
  untranslated: boolean;
  baseTurns: DialogueTurn[];
  photoSummary?: string | null;
  catalogHint?: string | null;
  visionHint?: string | null;
  ocrHint?: string | null;
  onProgress?: ProgressCb;
}): Promise<{ reply: string; method: string; structured: StructuredReport | null }> {
  return serialized(async () => {
    let modelId: string | null = null;
    let load_ms = 0;
    let acquireError: string | null = null;
    try {
      try {
        const h = await acquireModel({
          tier: 'CIBI',
          modelConst: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
          modelName: MODEL_NAME,
          quant: 'Q4_K_M',
          engine: 'llamacpp-completion',
          modelConfig: { ctx_size: 2048, gpu_layers: 0, load_mode: 'mmap' },
          ctx_size: 2048,
          prompt_chars: opts.textEn.length,
          onProgress: opts.onProgress,
        });
        modelId = h.modelId;
        load_ms = h.load_ms;
      } catch (e: any) {
        acquireError = String(e?.message ?? e ?? 'load-failed');
      }

      // Pass 1 (hidden): structure.
      let struct: StructuredReport | null = null;
      let structMethod = 'regex-fallback';
      if (modelId) {
        opts.onProgress?.(null, 'structure');
        try {
          const structText = await inferOnce({
            modelId,
            load_ms,
            history: buildStructureHistory({
              text_en: opts.photoSummary ? `${opts.textEn}\nPhoto evidence: ${opts.photoSummary}` : opts.textEn,
              visionHint: opts.visionHint,
              ocrHint: opts.ocrHint,
            }),
            predict: 256,
            onProgress: opts.onProgress,
          });
          struct = parseStructureText(structText);
          structMethod = (struct.confidence_map as any)?.fallback ? 'regex-fallback' : 'MedPsy-1.7B Q4_K_M';
        } catch (e: any) {
          acquireError = acquireError ?? String(e?.message ?? e);
          struct = structureFallback(opts.textEn, opts.visionHint, opts.ocrHint);
        }
      } else {
        struct = structureFallback(opts.textEn, opts.visionHint, opts.ocrHint);
      }

      // Pass 2 (visible): dialogue, same residency.
      const input = {
        turns: opts.baseTurns,
        latestUserEn: opts.textEn,
        latestUserOriginal: opts.userText,
        untranslated: opts.untranslated,
        structured: struct,
        photoSummary: opts.photoSummary ?? null,
        catalogHint: opts.catalogHint ?? null,
      };
      if (modelId) {
        opts.onProgress?.(null, 'dialogue');
        try {
          const dlgText = await inferOnce({
            modelId,
            load_ms,
            history: buildDialogueHistory(input),
            predict: 220,
            onProgress: opts.onProgress,
          });
          return { reply: parseDialogueText(dlgText), method: 'MedPsy-1.7B Q4_K_M', structured: struct };
        } catch (e: any) {
          acquireError = acquireError ?? String(e?.message ?? e);
        }
      }
      return {
        reply: fallbackDialogueReply({ ...input, structuredMethod: structMethod, modelError: acquireError }),
        method: structMethod,
        structured: struct,
      };
    } finally {
      await safeUnload(modelId);
      opts.onProgress?.(null, 'done');
    }
  });
}
