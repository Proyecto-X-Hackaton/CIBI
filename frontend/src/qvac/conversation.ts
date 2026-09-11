// conversation.ts — MedPsy-1.7B as a real dialogue agent (Spanish).
// Equipment-inventory ONLY. Every output passes the safety.ts gate.
// The JSON structuring pass (structure.ts) stays hidden underneath for
// ReviewScreen; THIS module produces what the user actually reads.
//
// Design: one MedPsy residency per reply, full recent history in context,
// photo summaries + structured facts injected so the model can reference
// what was said/shown. Fallback is an honest contextual message — never
// the old fixed template.

import { HEALTHCARE_1_7B_MEDICAL_Q4_K_M } from '@qvac/sdk';
import { runCompletion } from './qvacClient';
import { containsBannedClinicalClaim } from '../utils/safety';
import type { StructuredReport } from './structure';

export interface DialogueTurn {
  role: 'user' | 'assistant';
  text: string;
  photoSummary?: string | null;
}

const DIALOGUE_SYSTEM =
  'Eres CIBI, asistente de inventario de equipamiento hospitalario. Hablas español. ' +
  'Tu trabajo: conversar de forma natural sobre el inventario de equipos de imagen (MR resonancia, CT tomografía, US ultrasonido, XR rayos X): modalidad, fabricante, modelo, cantidad, edad, ubicación, estado de uso. ' +
  'REGLAS: inventario de equipamiento únicamente, nunca consejo médico ni contenido clínico de ningún tipo. ' +
  'Responde de forma conversacional y breve (2-4 frases). Haz referencia a lo que la persona ya dijo o mostró. ' +
  'Haz como máximo 1-2 preguntas concretas por mensaje, las más valiosas para completar el inventario (fabricante > modelo de placa > edad > cantidad exacta). ' +
  'Si hay foto analizada, comenta lo que se ve y pide confirmar o corregir. ' +
  'Si la traducción falló, dilo con naturalidad y sigue con el texto original. ' +
  'Nunca inventes fabricantes ni modelos: si no los sabes, pregunta. ' +
  'Nunca muestres JSON, nombres de modelos, ni métricas internas.';

function factsLine(report: StructuredReport | null): string {
  if (!report || report.items.length === 0) return 'Inventario hasta ahora: vacío.';
  const parts = report.items.map(
    (it) =>
      `${it.qty} ${it.modality}` +
      (it.manufacturer ? ` ${it.manufacturer}` : ' sin marca') +
      (it.model ? ` (${it.model})` : '') +
      (it.age_text ? `, ${it.age_text}` : '') +
      ` [${it.confidence}]`,
  );
  return `Inventario hasta ahora: ${parts.join(' / ')}.`;
}

export async function generateAssistantReply(opts: {
  turns: DialogueTurn[];
  latestUserEn: string;
  latestUserOriginal: string;
  untranslated: boolean;
  structured: StructuredReport | null;
  structuredMethod: string;
  photoSummary?: string | null;
  catalogHint?: string | null;
  modelError?: string | null;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ reply: string; method: string }> {
  const historyText = opts.turns
    .slice(-8)
    .map((t) => `${t.role === 'user' ? 'Persona' : 'CIBI'}: ${t.text}${t.photoSummary ? ` [foto: ${t.photoSummary}]` : ''}`)
    .join('\n');
  const userContent =
    `${DIALOGUE_SYSTEM}\n\n` +
    `Historial reciente:\n${historyText || '(inicio de la inspección)'}\n\n` +
    `${factsLine(opts.structured)}\n` +
    (opts.photoSummary ? `Última foto analizada: ${opts.photoSummary}\n` : '') +
    (opts.catalogHint ? `Guía de catálogo (úsala con naturalidad, sin citar versiones): ${opts.catalogHint}\n` : '') +
    (opts.untranslated ? 'Nota: la traducción automática falló; trabaja con el texto original.\n' : '') +
    `Último mensaje de la persona (EN interno): ${opts.latestUserEn}\n` +
    `Último mensaje original: ${opts.latestUserOriginal}\n\n` +
    'Responde en español, conversacional, sin JSON.';

  try {
    const { text } = await runCompletion({
      tier: 'CIBI',
      modelConst: HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
      modelName: 'HEALTHCARE_1_7B_MEDICAL_Q4_K_M',
      quant: 'Q4_K_M',
      engine: 'llamacpp-completion',
      modelConfig: { ctx_size: 2048 },
      ctx_size: 2048,
      history: [{ role: 'user', content: userContent }],
      onProgress: opts.onProgress,
    });
    const clean = text.trim();
    if (!clean) throw new Error('empty dialogue');
    if (containsBannedClinicalClaim(clean)) throw new Error('clinical-claim-gate');
    return { reply: clean, method: 'MedPsy-1.7B Q4_K_M' };
  } catch (e: any) {
    // Honest contextual fallback: references what we DO know, asks the
    // single most valuable question. Never the old fixed template.
    const items = opts.structured?.items ?? [];
    const missingMaker = items.some((i) => !i.manufacturer);
    const missingAge = items.some((i) => i.age_years == null);
    const q = opts.photoSummary
      ? `Sobre la foto que me mostraste (${opts.photoSummary.slice(0, 120)}): ¿confirmas el fabricante y modelo de la placa?`
      : missingMaker
        ? '¿De qué fabricante son los equipos que me describes?'
        : missingAge
          ? '¿Recuerdas hace cuántos años se instalaron, aunque sea aproximado?'
          : '¿La cantidad que me diste es exacta o estimada?';
    const prefix =
      opts.structuredMethod === 'regex-fallback'
        ? `Anoté tu reporte localmente (${shortReason(opts.modelError)}). `
        : 'Anoté tu reporte. ';
    return { reply: `${prefix}${q}`, method: opts.structuredMethod };
  }
}

/** Map a raw load/infer error to a short human reason (never raw dumps). */
function shortReason(err: string | null | undefined): string {
  const e = (err ?? '').toLowerCase();
  if (!e) return 'el modelo no cargó en el teléfono, sigo con respaldo';
  if (e.includes('network') || e.includes('download') || e.includes('fetch') || e.includes('econn') || e.includes('timeout'))
    return 'no pude descargar el modelo — revisa el WiFi y abre Ajustes → Descargar modelos';
  if (e.includes('memory') || e.includes('oom') || e.includes('alloc') || e.includes('no space') || e.includes('storage'))
    return 'el teléfono se quedó sin memoria/espacio para el modelo, sigo con respaldo';
  if (e.includes('no-json') || e.includes('empty')) return 'el modelo respondió vacío, sigo con respaldo';
  return 'el modelo no cargó en el teléfono, sigo con respaldo';
}
