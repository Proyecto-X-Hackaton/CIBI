// turn.ts — one chat turn, ONE MedPsy residency.
// Previously each message paid two full 1.28GB load→unload cycles
// (structure, then dialogue). Now: acquire once → infer structure →
// infer dialogue → unload. The model structure pass additionally only
// runs when the message actually carries inventory content (greetings and
// chit-chat skip it), and the reasoning channel is off so both passes
// produce only the tokens the app uses.

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
import type { TierId } from './TIER_ROSTER';
import { peerChat, PEER_MODELS } from './peerClient';
import { OFFLINE_ROUTE, offlineFallback, peerRoute, type RouteMeta } from './route';
import {
  buildStructureHistory,
  parseStructureText,
  EQUIPMENT_RESPONSE_FORMAT,
  structureFallback,
  looksLikeInventory,
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
  tier: TierId;
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
    captureThinking: true,
    generationParams: { predict: opts.predict, reasoning_budget: 0 },
  });
  const { text, stats } = await collectCompletion(run);
  const s = statsToSpan(stats);
  await logSpan({
    ts: new Date().toISOString(),
    device: deviceLabel(),
    tier: opts.tier,
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

interface ChatTurnInput {
  textEn: string;
  userText: string;
  lang: 'es' | 'pt';
  untranslated: boolean;
  baseTurns: DialogueTurn[];
  photoSummary?: string | null;
  catalogHint?: string | null;
  visionHint?: string | null;
  ocrHint?: string | null;
  tier?: TierId;
  peerBase?: string;
  onProgress?: ProgressCb;
}

export interface ChatTurnResult {
  reply: string;
  method: string;
  structured: StructuredReport | null;
  route: RouteMeta;
}

export async function answerChatTurn(opts: ChatTurnInput): Promise<ChatTurnResult> {
  const tier = opts.tier ?? 'CIBI';
  if (tier !== 'CIBI' && opts.peerBase) {
    let structured: StructuredReport;
    try {
      opts.onProgress?.(null, 'peer-structure');
      const structResponse = await peerChat({
        base: opts.peerBase,
        tier,
        model: PEER_MODELS.blue,
        maxTokens: 1024,
        reasoningBudget: 0,
        responseFormat: EQUIPMENT_RESPONSE_FORMAT,
        messages: buildStructureHistory({
          text_en: opts.photoSummary ? `${opts.textEn}\nPhoto evidence: ${opts.photoSummary}` : opts.textEn,
          visionHint: opts.visionHint,
          ocrHint: opts.ocrHint,
        }),
      });
      structured = parseStructureText(structResponse.text);
    } catch (peerError) {
      opts.onProgress?.(null, 'peer-fallback');
      const local = await answerLocalChatTurn(opts);
      return { ...local, method: `${local.method} · peer structure fallback`, route: offlineFallback(opts.peerBase, peerError) };
    }

    const input = {
      turns: opts.baseTurns,
      latestUserEn: opts.textEn,
      latestUserOriginal: opts.userText,
      untranslated: opts.untranslated,
      structured,
      photoSummary: opts.photoSummary ?? null,
      catalogHint: opts.catalogHint ?? null,
    };
    const dialogueHistory = buildDialogueHistory(input).map((m) => ({
      ...m,
      content: tier === 'CIBI_SUPER'
        ? `${m.content}\n\nPOLÍTICA PEER: el JSON anterior fue anclado por MedPsy-4B. Razona sobre ese candidato y la evidencia; no inventes ni sustituyas entidades sin evidencia.`
        : m.content,
    }));
    const dialogueModel = tier === 'CIBI_SUPER' ? PEER_MODELS.super : PEER_MODELS.blue;
    try {
      opts.onProgress?.(null, 'peer-dialogue');
      const dialogue = await peerChat({
        base: opts.peerBase,
        tier,
        model: dialogueModel,
        maxTokens: tier === 'CIBI_SUPER' ? 1536 : 1024,
        reasoningBudget: tier === 'CIBI_SUPER' ? 512 : 256,
        messages: dialogueHistory,
      });
      return {
        reply: parseDialogueText(dialogue.text),
        method: tier === 'CIBI_SUPER' ? 'Qwen3.5-9B Q6_K (peer) + MedPsy-4B anchor' : 'MedPsy-4B Q8_0 (peer)',
        structured,
        route: peerRoute(opts.peerBase),
      };
    } catch (dialogueError) {
      try {
        opts.onProgress?.(null, 'peer-dialogue-retry');
        const retry = await peerChat({
          base: opts.peerBase,
          tier,
          model: dialogueModel,
          maxTokens: 768,
          reasoningBudget: 0,
          messages: dialogueHistory,
        });
        return {
          reply: parseDialogueText(retry.text),
          method: `${tier === 'CIBI_SUPER' ? 'Qwen3.5-9B Q6_K' : 'MedPsy-4B Q8_0'} (peer, direct-response retry)`,
          structured,
          route: peerRoute(opts.peerBase),
        };
      } catch (retryError) {
        opts.onProgress?.(null, 'peer-fallback');
        return {
          reply: fallbackDialogueReply({ ...input, structuredMethod: 'peer-dialogue-fallback', modelError: String(retryError ?? dialogueError) }),
          method: 'peer dialogue fallback',
          structured,
          route: offlineFallback(opts.peerBase, retryError),
        };
      }
    }
  }
  const local = await answerLocalChatTurn(opts);
  return { ...local, route: OFFLINE_ROUTE };
}

async function answerLocalChatTurn(opts: ChatTurnInput): Promise<ChatTurnResult> {
  return serialized(async () => {
    const progress: ProgressCb | undefined = opts.onProgress
      ? (pct, stage) => opts.onProgress?.(pct, opts.tier && opts.tier !== 'CIBI' ? `local-${stage}` : stage)
      : undefined;
    let modelId: string | null = null;
    let load_ms = 0;
    let loadedTier: TierId = 'CIBI';
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
          onProgress: progress,
        });
        modelId = h.modelId;
        load_ms = h.load_ms;
        loadedTier = h.tier;
      } catch (e: any) {
        acquireError = String(e?.message ?? e ?? 'load-failed');
      }

      // Pass 1 (hidden): structure — only when this message carries
      // inventory content (photo evidence or equipment-ish words/numbers).
      // Greetings/navigation skip it: one full inference pass saved per
      // turn, and the visible dialogue reply is unaffected.
      let struct: StructuredReport | null = null;
      let structMethod = 'regex-fallback';
      const wantsStructure = !!opts.photoSummary || looksLikeInventory(opts.textEn) || looksLikeInventory(opts.userText);
      if (modelId && wantsStructure) {
        progress?.(null, 'structure');
        try {
          const structText = await inferOnce({
            tier: loadedTier,
            modelId,
            load_ms,
            history: buildStructureHistory({
              text_en: opts.photoSummary ? `${opts.textEn}\nPhoto evidence: ${opts.photoSummary}` : opts.textEn,
              visionHint: opts.visionHint,
              ocrHint: opts.ocrHint,
            }),
            predict: 256,
            onProgress: progress,
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
        progress?.(null, 'dialogue');
        try {
          const dlgText = await inferOnce({
            tier: loadedTier,
            modelId,
            load_ms,
            history: buildDialogueHistory(input),
            predict: 220,
            onProgress: progress,
          });
          return { reply: parseDialogueText(dlgText), method: 'MedPsy-1.7B Q4_K_M', structured: struct, route: OFFLINE_ROUTE };
        } catch (e: any) {
          acquireError = acquireError ?? String(e?.message ?? e);
        }
      }
      return {
        reply: fallbackDialogueReply({ ...input, structuredMethod: structMethod, modelError: acquireError }),
        method: structMethod,
        structured: struct,
        route: OFFLINE_ROUTE,
      };
    } finally {
      await safeUnload(modelId);
      progress?.(null, 'done');
    }
  });
}
