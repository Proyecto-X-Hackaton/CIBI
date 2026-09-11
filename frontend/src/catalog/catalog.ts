// catalog.ts — F10 bundled reference knowledge (NOT observations).
// Deterministic match: exact alias → embedding note → modality fallback.
// 'Sin coincidencia' before inventing. Renders POI + photo priorities +
// staff questions in Spanish with catalog version provenance.

import { CATALOG_VERSION } from '../qvac/TIER_ROSTER';

export interface CatalogEntry {
  entry_id: string;
  modality: 'MR' | 'CT' | 'US' | 'XR';
  manufacturer: string;
  family: string;
  aliases: string[];
  point_of_interest: string[];
  photo_priority: string[];
  staff_question: string[];
  age_marker: string[];
}

export const CATALOG: CatalogEntry[] = [
  {
    entry_id: 'catalog.mr.family.example',
    modality: 'MR',
    manufacturer: 'Fabricante X',
    family: 'Familia MR-X',
    aliases: ['mr', 'resonancia', 'resonancia magnética', 'ressonância', 'mri', 'magnetom', 'signa', 'ingenia'],
    point_of_interest: ['Placa lateral inferior del gantry', 'Consola: etiqueta trasera'],
    photo_priority: ['Macro de placa', 'Foto amplia para conteo'],
    staff_question: ['¿Año de instalación?', '¿Sigue en uso clínico diario?'],
    age_marker: ['Serie en placa indica generación; confirma año con ingeniería'],
  },
  {
    entry_id: 'catalog.ct.family.example',
    modality: 'CT',
    manufacturer: 'Fabricante Y',
    family: 'Familia CT-Y',
    aliases: ['ct', 'tomografía', 'tomografia', 'tomógrafo', 'tomografo', 'revolution', 'somatom', 'aquilion'],
    point_of_interest: ['Placa lateral inferior del gantry', 'Sala de control: placa de consola'],
    photo_priority: ['Macro de placa', 'Foto amplia para conteo'],
    staff_question: ['¿Año de instalación?', '¿Número de cortes?'],
    age_marker: ['Modelo en placa → generación; valida con año de instalación'],
  },
  {
    entry_id: 'catalog.us.family.example',
    modality: 'US',
    manufacturer: 'Fabricante Z',
    family: 'Familia US-Z',
    aliases: ['us', 'ultrasonido', 'ultrassom', 'ecógrafo', 'ecografo', 'ultrasound', 'voluson', 'epiq', 'logiq'],
    point_of_interest: ['Etiqueta trasera del equipo', 'Sonda: modelo grabado en el conector'],
    photo_priority: ['Foto de etiqueta trasera', 'Foto del transductor'],
    staff_question: ['¿Cuántas sondas operativas?', '¿Año de compra?'],
    age_marker: ['Etiqueta trasera trae fecha de fabricación'],
  },
];

export interface CatalogMatch {
  entry: CatalogEntry | null;
  method: 'alias' | 'modality' | 'none';
}

export function matchCatalog(text: string, modalityHint?: string | null): CatalogMatch {
  const t = text.toLowerCase();
  for (const e of CATALOG) {
    if (e.aliases.some((a) => a.length > 2 && t.includes(a))) return { entry: e, method: 'alias' };
  }
  if (modalityHint) {
    const e = CATALOG.find((x) => x.modality === modalityHint);
    if (e) return { entry: e, method: 'modality' };
  }
  return { entry: null, method: 'none' };
}

export function guidanceText(m: CatalogMatch): string {
  if (!m.entry) return `Sin coincidencia en catálogo v${CATALOG_VERSION}. Se registra lo reportado con confianza Unknown — sin inventar.`;
  const e = m.entry;
  return (
    `Guía catálogo ${e.modality} · ${e.family} v${CATALOG_VERSION}\n` +
    `• Placa: ${e.point_of_interest[0]}\n` +
    `• Prioridad foto: 1) ${e.photo_priority[0]} 2) ${e.photo_priority[1]}\n` +
    `• Preguntar: ${e.staff_question[0]}`
  );
}

export { CATALOG_VERSION };
