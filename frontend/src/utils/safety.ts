// safety.ts — medical framing gate (F03/F09). Equipment-entity extraction
// ONLY. Banned clinical claims in prompts AND outputs.

const BANNED = [
  'diagnóstico', 'diagnostico', 'síntoma', 'sintoma', 'tratamiento',
  'diagnosis', 'symptom', 'treatment',
  'diagnóstico clínico', 'diagnostico clinico',
  'sintoma', 'tratamento', 'sintomas', // PT
  'diagnóstico por imagen',
];

export function containsBannedClinicalClaim(text: string): boolean {
  const t = text.toLowerCase();
  // 'diagnóstico por imagen' is a modality description, not a claim — allow it.
  const cleaned = t.replace(/diagnóstico por imagen/g, '').replace(/diagnostico por imagen/g, '');
  return BANNED.some((w) => {
    if (w.includes('por imagen')) return false;
    return cleaned.includes(w);
  });
}

export const DISCLAIMER_ES = 'Extracción de inventario de equipamiento. No es diagnóstico clínico.';
export const DISCLAIMER_EN = 'Equipment inventory extraction. Not a clinical diagnosis.';
