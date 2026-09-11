// visionOcr.ts — F02: 1 authorized photo → modality guess + label text.
// VisionPsy-Nano-460M-FLASH pair + image_no_upscale:'on' (mismatch silently
// degrades — never mix with the _1 Base pair). Then OCR_LATIN. Merge rule:
// OCR text wins for model/serial; vision wins for modality/scene.
// Conflict → Estimated, never Confirmed. Confirmed only on photo+text
// agreement or revisit (enforced in structure/confidence utils).

import { VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, OCR_LATIN } from '@qvac/sdk';
import { runCompletion, runOcr } from './qvacClient';
import { peerOcr, peerVision } from './peerClient';
import type { TierId } from './TIER_ROSTER';
import { OFFLINE_ROUTE, offlineFallback, peerRoute, type RouteMeta } from './route';

export interface VisionResult {
  modality_guess: string | null;
  manufacturer_guess: string | null;
  model_guess: string | null;
  label_text_free: string | null;
  raw: string;
  route: RouteMeta;
}

export interface OcrResult {
  blocks: Array<{ text: string; bbox?: number[]; confidence?: number }>;
  topConfidence: number;
  joinedText: string;
  route: RouteMeta;
}

const VISION_PROMPT =
  'You are an assistant for HOSPITAL EQUIPMENT INVENTORY. Look at this photo of medical imaging equipment. ' +
  'Describe in one short English sentence what you see (room, machine type, visible labels). ' +
  'Then on a new line output strict JSON only: ' +
  '{"modality_guess": "MR|CT|US|XR|null", "manufacturer_guess": string|null, "model_guess": string|null, "label_text_free": string|null}. ' +
  'Modality hints: MR = big doughnut magnet bore; CT = short ring gantry with table; US = small cart with probe and screen; XR = wall stand or C-arm. ' +
  'Transcribe any visible brand/model/plate text verbatim into label_text_free. ' +
  'Unknown → null. Equipment inventory only, no medical advice. Format: one sentence, then the JSON object last.';

export async function describePhoto(opts: {
  photoPath: string;
  tier?: TierId;
  peerBase?: string;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<VisionResult> {
  const tier = opts.tier ?? 'CIBI';
  if (tier !== 'CIBI' && opts.peerBase) {
    try {
      opts.onProgress?.(null, 'peer-vision');
      const text = await peerVision({ base: opts.peerBase, tier, photoPath: opts.photoPath, prompt: VISION_PROMPT });
      const parsed = tryParseVisionJson(text);
      const prose = text.split('{')[0].trim();
      const label = parsed.label_text_free || (prose.length > 8 ? prose.slice(0, 300) : null);
      return { ...parsed, label_text_free: label, raw: text, route: peerRoute(opts.peerBase) };
    } catch (peerError) {
      opts.onProgress?.(null, 'peer-fallback');
      try {
        const local = await runLocalVision(opts);
        return { ...local, route: offlineFallback(opts.peerBase, peerError) };
      } catch {
        return { modality_guess: null, manufacturer_guess: null, model_guess: null, label_text_free: null, raw: '', route: offlineFallback(opts.peerBase, peerError) };
      }
    }
  }
  try {
    return await runLocalVision(opts);
  } catch {
    return { modality_guess: null, manufacturer_guess: null, model_guess: null, label_text_free: null, raw: '', route: OFFLINE_ROUTE };
  }
}

async function runLocalVision(opts: { photoPath: string; onProgress?: (pct: number | null, stage: string) => void }): Promise<VisionResult> {
  const { text } = await runCompletion({
      tier: 'CIBI',
      modelConst: VISIONPSY_NANO_460M_MULTIMODAL_Q8_0,
      modelName: 'VISIONPSY_NANO_460M_MULTIMODAL_Q8_0',
      quant: 'Q8_0',
      engine: 'llamacpp-completion',
      modelConfig: {
        ctx_size: 1024,
        projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0,
        image_no_upscale: 'on',
        gpu_layers: 0,
        load_mode: 'mmap',
      },
      ctx_size: 1024,
      image_no_upscale: 'on',
      history: [{ role: 'user', content: VISION_PROMPT, attachments: [{ path: opts.photoPath }] }],
      onProgress: opts.onProgress,
    });
    const parsed = tryParseVisionJson(text);
    // Keep any leading prose (the one-sentence description) so the
    // conversational pass can talk about the photo even when JSON is partial.
    const prose = text.split('{')[0].trim();
    const label = parsed.label_text_free || (prose.length > 8 ? prose.slice(0, 300) : null);
    return { ...parsed, label_text_free: label, raw: text, route: OFFLINE_ROUTE };
}

function tryParseVisionJson(text: string): Omit<VisionResult, 'raw' | 'route'> {
  const empty = { modality_guess: null, manufacturer_guess: null, model_guess: null, label_text_free: null };
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return empty;
    const obj = JSON.parse(text.slice(start, end + 1));
    const mod = String(obj.modality_guess ?? '').toUpperCase();
    return {
      modality_guess: ['MR', 'CT', 'US', 'XR'].includes(mod) ? mod : null,
      manufacturer_guess: obj.manufacturer_guess ? String(obj.manufacturer_guess) : null,
      model_guess: obj.model_guess ? String(obj.model_guess) : null,
      label_text_free: obj.label_text_free ? String(obj.label_text_free) : null,
    };
  } catch {
    return empty;
  }
}

export async function readLabelText(opts: {
  photoPath: string;
  tier?: TierId;
  peerBase?: string;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<OcrResult> {
  const tier = opts.tier ?? 'CIBI';
  if (tier !== 'CIBI' && opts.peerBase) {
    try {
      opts.onProgress?.(null, 'peer-ocr');
      const text = await peerOcr({ base: opts.peerBase, tier, photoPath: opts.photoPath });
      const blocks = text ? [{ text, confidence: 0.5 }] : [];
      return { blocks, topConfidence: blocks[0]?.confidence ?? 0, joinedText: text, route: peerRoute(opts.peerBase) };
    } catch (peerError) {
      opts.onProgress?.(null, 'peer-fallback');
      try {
        const local = await runLocalOcr(opts);
        return { ...local, route: offlineFallback(opts.peerBase, peerError) };
      } catch {
        return { blocks: [], topConfidence: 0, joinedText: '', route: offlineFallback(opts.peerBase, peerError) };
      }
    }
  }
  try {
    return await runLocalOcr(opts);
  } catch {
    return { blocks: [], topConfidence: 0, joinedText: '', route: OFFLINE_ROUTE };
  }
}

async function runLocalOcr(opts: { photoPath: string; onProgress?: (pct: number | null, stage: string) => void }): Promise<OcrResult> {
  const { blocks } = await runOcr({
      tier: 'CIBI',
      modelConst: OCR_LATIN,
      modelName: 'OCR_LATIN',
      image: opts.photoPath,
      onProgress: opts.onProgress,
    });
    const joinedText = blocks.map((b) => b.text).join('\n').trim();
    const topConfidence = blocks.reduce((m, b) => Math.max(m, Number(b.confidence ?? 0)), 0);
    return { blocks, topConfidence, joinedText, route: OFFLINE_ROUTE };
}
