// TIER_ROSTER — single source of truth for tier → exact models.
// Every AI screen renders TierDetailsSheet from THIS constant only.
// The same table feeds README, PDF provenance footer and PERF_LOG.jsonl
// fields (tier/model/quant/engine) so they can never diverge. (F09)
//
// Verified against @qvac/sdk 0.19.0 registry (2026-09-10).
// Canonical table: docs/TECH_STACK_AND_ARCHITECTURE.md §4.

export type TierId = 'CIBI' | 'CIBI_PRO' | 'CIBI_SUPER';

export interface TierModelEntry {
  /** Exact @qvac/sdk export name, e.g. 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M' */
  name: string;
  /** HF GGUF file / bundle it resolves to (honest name for jury) */
  resolvesTo: string;
  quant: string;
  /** Canonical modelType: 'nmtcpp-translation' | 'llamacpp-completion' | 'ggml-ocr' | 'llamacpp-embedding' | 'parakeet-transcription' */
  engine: string;
  ctx?: number;
  approxSize: string;
  license: string;
  extra?: string;
}

export interface TierEntry {
  id: TierId;
  emoji: string;
  label: string;
  tagline: string;
  where: string;
  locked: boolean;
  models: TierModelEntry[];
  hw: string;
  mode: 'offline' | 'peer';
  fallback: string;
}

export const CATALOG_VERSION = '2026-09-09';

export const TIER_ROSTER: TierEntry[] = [
  {
    id: 'CIBI',
    emoji: '🟢',
    label: 'CIBI',
    tagline: 'rápido · en tu teléfono',
    where: 'phone',
    locked: false,
    hw: 'Teléfono físico Android (Build.MODEL registrado en PERF_LOG en el smoke test)',
    mode: 'offline',
    fallback: 'Sin modelo: se conserva el original (translate), solo-OCR (visión) o estructurado por regex (MedPsy). Siempre hay registro útil.',
    models: [
      { name: 'BERGAMOT_ES_EN', resolvesTo: 'bergamot-esen intgemm.bin', quant: 'int8', engine: 'nmtcpp-translation', approxSize: '~32MB', license: 'MPL-2.0 (Bergamot)', extra: "from:'es' to:'en', engine:'Bergamot'" },
      { name: 'BERGAMOT_PT_EN', resolvesTo: 'bergamot-pten intgemm.bin', quant: 'int8', engine: 'nmtcpp-translation', approxSize: '~32MB', license: 'MPL-2.0 (Bergamot)', extra: "from:'pt' to:'en', engine:'Bergamot'" },
      { name: 'VISIONPSY_NANO_460M_MULTIMODAL_Q8_0', resolvesTo: 'qvac/VisionPsy-Nano-460M-Flash-GGUFs (weights)', quant: 'Q8_0', engine: 'llamacpp-completion', ctx: 1024, approxSize: '~437MB', license: 'Apache-2.0', extra: "Flash pair + image_no_upscale:'on' + projectionModelSrc MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0" },
      { name: 'MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0', resolvesTo: 'qvac/VisionPsy-Nano-460M-Flash-GGUFs (mmproj)', quant: 'Q8_0', engine: 'llamacpp-completion', approxSize: '~109MB', license: 'Apache-2.0', extra: 'Solo proyección del par Flash — nunca mezclar con par Base _1' },
      { name: 'OCR_LATIN', resolvesTo: 'latin_g2.gguf (pipeline CRAFT+EasyOCR)', quant: '—', engine: 'ggml-ocr', approxSize: '~15MB', license: 'Apache-2.0', extra: 'modelType ggml-ocr' },
      { name: 'PARAKEET_TDT_0_6B_V3_Q8_0', resolvesTo: 'parakeet-tdt-0.6b-v3 (voz, stretch)', quant: 'Q8_0', engine: 'parakeet-transcription', approxSize: '~750MB', license: 'CC-BY-4.0 (NVIDIA)', extra: "modelType:'parakeet-transcription'. Typed input es P0; voz es stretch." },
      { name: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M', resolvesTo: 'qvac/MedPsy-1.7B-GGUF → medpsy-1.7b-q4_k_m-imat.gguf (= MedPsy-1.7B)', quant: 'Q4_K_M', engine: 'llamacpp-completion', ctx: 4096, approxSize: '~1.28GB', license: 'Apache-2.0', extra: 'Estructuración de entidades de equipamiento. Nunca diagnóstico.' },
      { name: 'GTE_LARGE_FP16', resolvesTo: 'gte-large fp16 (1024-dim)', quant: 'FP16', engine: 'llamacpp-embedding', approxSize: '~670MB', license: 'MIT', extra: 'Dedup + NL filter vía workspace RAG built-in (prototype-only, disclosed). Fallback: keyword overlap.' },
    ],
  },
  {
    id: 'CIBI_PRO',
    emoji: '🔵',
    label: 'CIBI Pro',
    tagline: 'mejor calidad · peer local',
    where: 'peer',
    locked: false,
    hw: 'Workstation peer local (modelo + HW pineados en setup del peer + qvac doctor verde)',
    mode: 'peer',
    fallback: 'Sin peer verificado: resultado 🟢 del teléfono. Timeout/desconexión → local con razón visible.',
    models: [
      { name: 'HEALTHCARE_4B_MEDICAL_Q8_0', resolvesTo: 'MedPsy-4B Q8_0 (4.7GB)', quant: 'Q8_0', engine: 'llamacpp-completion', approxSize: '~4.7GB', license: 'Apache-2.0', extra: 'Ancla entidades en el peer; Qwen nunca estructura solo.' },
    ],
  },
  {
    id: 'CIBI_SUPER',
    emoji: '🟣',
    label: 'CIBI Super',
    tagline: 'máximo razonamiento · peer local',
    where: 'peer',
    locked: false,
    hw: 'Workstation peer local (solo si el HW lo permite; si no, se omite y 🔵 es el techo)',
    mode: 'peer',
    fallback: 'Sin peer/HW: resultado 🟢 del teléfono. Qwen3.8-Flash MoE ~176B excluido como peer local (inviable); solo variante densa oficial menor pineada.',
    models: [
      { name: 'QWEN3_5_9B_MULTIMODAL_Q6_K', resolvesTo: 'Qwen3.5-9B GGUF oficial (Apache-2.0; verificado en registry SDK 0.19.0; pairs MMPROJ_QWEN3_5_9B_MULTIMODAL_BF16/F16)', quant: 'Q6_K', engine: 'llamacpp-completion', approxSize: '~7.5GB', license: 'Apache-2.0', extra: 'Razona sobre texto/OCR/candidato; MedPsy-4B ancla entidades. La modalidad de la foto la mantiene VisionPsy (🟢).' },
    ],
  },
];

export function tierById(id: TierId): TierEntry {
  const t = TIER_ROSTER.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown tier ${id}`);
  return t;
}
