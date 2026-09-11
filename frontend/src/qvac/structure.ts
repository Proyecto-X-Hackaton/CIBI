// structure.ts — F03: domain language → Track 1 §2 fields with per-field
// confidence. Equipment-entity extraction ONLY. Banned in prompts/outputs:
// diagnóstico, síntoma, tratamiento (+ EN/PT equivalents) — enforced by
// safety.ts gate. MedPsy-1.7B Q4_K_M on the phone (🟢). Peer 🔵/🟣 only P1.

import { HEALTHCARE_1_7B_MEDICAL_Q4_K_M } from '@qvac/sdk';
import { runCompletion } from './qvacClient';
import { repairJson } from '../utils/jsonRepair';
import { containsBannedClinicalClaim } from '../utils/safety';

export type Confidence = 'Confirmed' | 'Reported' | 'Estimated' | 'Unknown';
export type Modality = 'MR' | 'CT' | 'US' | 'XR';

export interface EquipmentItem {
  modality: Modality;
  manufacturer: string | null;
  model: string | null;
  qty: number;
  age_text: string | null;
  age_years: number | null;
  confidence: Confidence;
  source: 'text' | 'photo' | 'ocr' | 'catalog';
}

export interface StructuredReport {
  customer: string | null;
  city: string | null;
  country: string | null;
  items: EquipmentItem[];
  confidence_map: Record<string, Confidence>;
}

const SYSTEM_PROMPT =
  'You extract HOSPITAL EQUIPMENT INVENTORY entities. Equipment inventory, not medical advice. ' +
  'Extract ONLY customer/facility, city, country, items[{modality, manufacturer, model, qty, age_text, age_years}]. ' +
  'Modalities: MR (magnetic resonance), CT (computed tomography), US (ultrasound), XR (x-ray). ' +
  'Return strict JSON only: {"customer":string|null,"city":string|null,"country":string|null,' +
  '"items":[{"modality":"MR|CT|US|XR","manufacturer":string|null,"model":string|null,"qty":number,' +
  '"age_text":string|null,"age_years":number|null,"confidence":"Confirmed|Reported|Estimated|Unknown","source":"text|photo|ocr|catalog"}]}. ' +
  'Unknown → null with confidence Unknown. Never invent manufacturers. Equipment inventory only — no clinical content of any kind.';

export function emptyReport(): StructuredReport {
  return { customer: null, city: null, country: null, items: [], confidence_map: {} };
}

// Last model error, for honest in-chat diagnostics (never shown raw to
// the user, but mapped to a short human reason).
let lastError: string | null = null;
export function lastStructureError(): string | null {
  return lastError;
}

export type CompletionHistory = Array<{ role: 'user' | 'assistant'; content: string }>;

export function buildStructureHistory(opts: {
  text_en: string;
  visionHint?: string | null;
  ocrHint?: string | null;
}): CompletionHistory {
  const userContent =
    `EN observation: ${opts.text_en}\n` +
    (opts.visionHint ? `Vision hint (modality/scene): ${opts.visionHint}\n` : '') +
    (opts.ocrHint ? `OCR label text (wins for model/serial): ${opts.ocrHint}\n` : '') +
    'Return ONLY the JSON object.';
  // Single user turn: some chat templates fail on consecutive same-role
  // messages, so system + observation go in one prompt.
  return [{ role: 'user', content: `${SYSTEM_PROMPT}\n\n${userContent}` }];
}

/** Parse model output into a report. Throws on gate hit or bad JSON. */
export function parseStructureText(text: string): StructuredReport {
  if (containsBannedClinicalClaim(text)) throw new Error('clinical-claim-gate');
  const report = coerceReport(repairJson(text));
  if (containsBannedClinicalClaim(JSON.stringify(report))) throw new Error('clinical-claim-gate');
  return report;
}

/** Deterministic regex fallback — never invents maker/model (→ null/Unknown). */
export function structureFallback(text_en: string, visionHint?: string | null, ocrHint?: string | null): StructuredReport {
  return regexFallback(text_en, visionHint, ocrHint);
}

export async function structureEntities(opts: {
  text_en: string;
  visionHint?: string | null;
  ocrHint?: string | null;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<StructuredReport> {
  try {
    lastError = null;
    const { text } = await runCompletion({
      tier: 'CIBI',
      modelConst: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
      modelName: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M',
      quant: 'Q4_K_M',
      engine: 'llamacpp-completion',
      modelConfig: { ctx_size: 1024, gpu_layers: 0, load_mode: 'mmap' },
      ctx_size: 1024,
      predict: 256,
      history: buildStructureHistory(opts),
      onProgress: opts.onProgress,
    });
    return parseStructureText(text);
  } catch (e: any) {
    // Fallback (TECH_STACK §4): VisionPsy+regex structuring, disclose downgrade.
    lastError = String(e?.message ?? e ?? 'load-failed');
    return regexFallback(opts.text_en, opts.visionHint, opts.ocrHint);
  }
}

/** One constrained retry asking for JSON only. Used when first parse fails. */
export function needsJsonRetry(raw: string): boolean {
  try {
    JSON.parse(raw);
    return false;
  } catch {
    return true;
  }
}

function coerceReport(obj: any): StructuredReport {
  const items: EquipmentItem[] = Array.isArray(obj?.items)
    ? obj.items
        .map((it: any) => ({
          modality: normalizeModality(it?.modality),
          manufacturer: it?.manufacturer ? String(it.manufacturer) : null,
          model: it?.model ? String(it.model) : null,
          qty: Number.isFinite(Number(it?.qty)) && Number(it?.qty) > 0 ? Math.round(Number(it.qty)) : 1,
          age_text: it?.age_text ? String(it.age_text) : null,
          age_years: Number.isFinite(Number(it?.age_years)) ? Number(it.age_years) : parseAge(it?.age_text),
          confidence: normalizeConf(it?.confidence),
          source: ['text', 'photo', 'ocr', 'catalog'].includes(it?.source) ? it.source : 'text',
        }))
        .filter((it: EquipmentItem) => it.modality !== null) as EquipmentItem[]
    : [];
  const confidence_map: Record<string, Confidence> = {};
  items.forEach((it, i) => {
    confidence_map[`items[${i}].modality`] = it.confidence;
  });
  return {
    customer: obj?.customer ? String(obj.customer) : null,
    city: obj?.city ? String(obj.city) : null,
    country: obj?.country ? String(obj.country) : null,
    items,
    confidence_map,
  };
}

function normalizeModality(m: any): Modality | null {
  const s = String(m ?? '').toUpperCase();
  if (s.includes('MR') || s.includes('RESON') || s.includes('MRI')) return 'MR';
  if (s.includes('CT') || s.includes('TOMO')) return 'CT';
  if (s.includes('US') || s.includes('ULTRA') || s.includes('ECO')) return 'US';
  if (s.includes('XR') || s.includes('X-RAY') || s.includes('XRAY')) return 'XR';
  return null;
}

function normalizeConf(c: any): Confidence {
  const s = String(c ?? '').toLowerCase();
  if (s.startsWith('confirm')) return 'Confirmed';
  if (s.startsWith('report')) return 'Reported';
  if (s.startsWith('estimat')) return 'Estimated';
  return 'Unknown';
}

/** Parse "8–10y" / "8-10 años" → midpoint 9. Single "9 años" → 9. */
export function parseAge(ageText: any): number | null {
  if (ageText == null) return null;
  const s = String(ageText).replace(',', '.');
  const range = s.match(/(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const single = s.match(/(\d+(?:\.\d+)?)\s*(y|a[ñn]os?|years?)?/i);
  if (single) return Math.round(Number(single[1]));
  return null;
}

/** Deterministic regex fallback — never invents maker/model (→ null/Unknown). */
function regexFallback(text_en: string, visionHint?: string | null, ocrHint?: string | null): StructuredReport {
  const t = text_en.toLowerCase();
  const items: EquipmentItem[] = [];
  const patterns: Array<[RegExp, Modality]> = [
    [/(\d+)\s*(mr|magnetic resonance|resonan\w*)/gi, 'MR'],
    [/(\d+)\s*(ct|computed tomograph|tomograf\w*)/gi, 'CT'],
    [/(\d+)\s*(us|ultrasound|ultrason\w*|ultrassom|ecogra\w*)/gi, 'US'],
  ];
  const push = (mod: Modality, qty: number) => {
    const ageYears = parseAge(text_en);
    items.push({
      modality: mod,
      manufacturer: null,
      model: ocrHint && ocrHint.trim() ? ocrHint.trim().slice(0, 80) : null,
      qty,
      age_text: ageYears != null ? `${ageYears} años (regex)` : null,
      age_years: ageYears,
      confidence: 'Estimated',
      source: ocrHint ? 'ocr' : visionHint ? 'photo' : 'text',
    });
  };
  for (const [re, mod] of patterns) {
    let m: RegExpExecArray | null;
    const local = new RegExp(re.source, re.flags);
    while ((m = local.exec(t)) !== null) push(mod, Math.max(1, Number(m[1]) || 1));
  }
  // Bare mentions without counts ("two CTs", "MR")
  if (items.length === 0) {
    if (/\bmr\b|resonan/.test(t)) push('MR', 1);
    if (/\bct\b|tomograf/.test(t)) push('CT', 1);
    if (/\bus\b|ultras/.test(t)) push('US', 1);
  }
  return { customer: null, city: null, country: null, items, confidence_map: { fallback: 'Estimated' } };
}
