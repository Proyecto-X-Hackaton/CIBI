// modelStatus.ts — visible model inventory for Ajustes + one-tap diagnosis.
// getModelInfo({name}) reports isCached/isLoaded/sizes straight from the
// on-device runtime. testChat() runs a tiny MedPsy completion and returns
// the RAW result so "models not responding" stops being a mystery.

import { getModelInfo, HEALTHCARE_1_7B_MEDICAL_Q4_K_M } from '@qvac/sdk';
import { runCompletion } from './qvacClient';

export interface ModelStatus {
  key: string;
  label: string;
  approxSize: string;
  isCached: boolean | null;
  isLoaded: boolean | null;
  actualBytes: number | null;
  expectedBytes: number | null;
  error: string | null;
}

const PHONE_MODELS: Array<{ key: string; label: string; approxSize: string }> = [
  { key: 'BERGAMOT_ES_EN', label: 'Traductor ES→EN', approxSize: '~32MB' },
  { key: 'BERGAMOT_PT_EN', label: 'Traductor PT→EN', approxSize: '~32MB' },
  { key: 'VISIONPSY_NANO_460M_MULTIMODAL_Q8_0', label: 'Visión (pesos)', approxSize: '~437MB' },
  { key: 'MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0', label: 'Visión (proyección)', approxSize: '~109MB' },
  { key: 'OCR_LATIN', label: 'Lector de placas', approxSize: '~15MB' },
  { key: 'PARAKEET_TDT_0_6B_V3_Q8_0', label: 'Voz', approxSize: '~750MB' },
  { key: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M', label: 'MedPsy (chat)', approxSize: '~1.28GB' },
  { key: 'GTE_LARGE_FP16', label: 'Embeddings', approxSize: '~670MB' },
];

export async function fetchModelStatuses(): Promise<ModelStatus[]> {
  const out: ModelStatus[] = [];
  for (const m of PHONE_MODELS) {
    try {
      const info: any = await getModelInfo({ name: m.key });
      out.push({
        ...m,
        isCached: !!info?.isCached,
        isLoaded: !!info?.isLoaded,
        actualBytes: typeof info?.actualSize === 'number' ? info.actualSize : null,
        expectedBytes: typeof info?.expectedSize === 'number' ? info.expectedSize : null,
        error: null,
      });
    } catch (e: any) {
      out.push({ ...m, isCached: null, isLoaded: null, actualBytes: null, expectedBytes: null, error: String(e?.message ?? e).slice(0, 160) });
    }
  }
  return out;
}

/** Tiny end-to-end proof that MedPsy actually responds. Raw error on failure. */
export async function testChat(): Promise<{ ok: boolean; text: string; ms: number; error: string | null }> {
  const t0 = Date.now();
  try {
    const { text } = await runCompletion({
      tier: 'CIBI',
      modelConst: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
      modelName: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M',
      quant: 'Q4_K_M',
      engine: 'llamacpp-completion',
      modelConfig: { ctx_size: 1024, gpu_layers: 0, load_mode: 'mmap' },
      ctx_size: 1024,
      predict: 16,
      reasoningBudget: 0,
      captureThinking: true,
      history: [{ role: 'user', content: 'Reply with exactly: OK. Nothing else.' }],
    });
    const clean = text.trim();
    return { ok: clean.length > 0, text: clean.slice(0, 300), ms: Date.now() - t0, error: clean ? null : 'empty-response' };
  } catch (e: any) {
    return { ok: false, text: '', ms: Date.now() - t0, error: String(e?.message ?? e).slice(0, 400) };
  }
}

export function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}MB`;
  return `${Math.round(n / 1e3)}KB`;
}
