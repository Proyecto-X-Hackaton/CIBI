// seed.ts — synthetic demo data only (fictional hospitals/makers).
// Every record carries synthetic:true. Never real hospital data.

import { getDb } from './database';

export const SEED_SITES = [
  { site_id: 'site-alpha', name: 'Hospital Alpha', city: 'São Paulo', country: 'Brasil', counts: { MR: 3, CT: 2, US: 5 }, aging: '2 MR 8–10 años', last_visit_days: 42, incomplete: false, contact: 'Ing. Ruiz' },
  { site_id: 'site-beta', name: 'Hospital Beta', city: 'Campinas', country: 'Brasil', counts: { MR: 1, CT: 1, US: 2 }, aging: '1 MR 9 años', last_visit_days: 12, incomplete: true, contact: 'Ing. Souza' },
  { site_id: 'site-centro', name: 'Campinas Centro', city: 'Campinas', country: 'Brasil', counts: { MR: 0, CT: 1, US: 3 }, aging: '', last_visit_days: 6, incomplete: false, contact: 'Dra. Lima' },
  { site_id: 'site-norte', name: 'Clínica Norte', city: 'Ciudad de Panamá', country: 'Panamá', counts: { MR: 1, CT: 0, US: 2 }, aging: '', last_visit_days: 70, incomplete: true, contact: 'Tec. Herrera' },
];

export async function ensureSeed(): Promise<void> {
  const d = await getDb();
  const row = (await d.getFirstAsync('SELECT COUNT(*) as n FROM inspections')) as any;
  if (Number(row?.n ?? 0) > 0) return;
  const now = new Date().toISOString();
  // One canonical seeded inspection: Hospital Alpha 3 MR / 2 CT / 4 US (F03 acceptance).
  const id = `seed-alpha-${Date.now().toString(36)}`;
  await d.runAsync(
    'INSERT INTO inspections (client_uuid, customer, city, country, author, observed_at, status, planned_uuid, updated_at, synthetic) VALUES (?,?,?,?,?,?,?,?,?,1)',
    [id, 'Hospital Alpha', 'São Paulo', 'Brasil', 'A. Ruiz', now, 'SYNCED', null, now],
  );
  await d.runAsync('INSERT INTO messages (inspection_id, seq, role, text_original, lang, text_en, created_at) VALUES (?,?,?,?,?,?,?)',
    [id, 1, 'user', 'Visité Hospital Alpha hoy. Tienen tres MR, dos CT y cuatro ultrasonidos. Dos MR tienen 8–10 años.', 'es', 'Visited Hospital Alpha today. They have three MR, two CT and four ultrasounds. Two MR are 8-10 years old.', now]);
  await d.runAsync('INSERT INTO observations (inspection_id, structured_json, confidence_map, tier, provenance, created_at) VALUES (?,?,?,?,?,?)',
    [id, JSON.stringify({ customer: 'Hospital Alpha', city: 'São Paulo', country: 'Brasil', items: [
      { modality: 'MR', manufacturer: null, model: null, qty: 3, age_text: '8–10 años (2 uds)', age_years: 9, confidence: 'Reported', source: 'text' },
      { modality: 'CT', manufacturer: null, model: null, qty: 2, age_text: null, age_years: null, confidence: 'Unknown', source: 'text' },
      { modality: 'US', manufacturer: null, model: null, qty: 4, age_text: 'mixta', age_years: null, confidence: 'Estimated', source: 'text' },
    ], synthetic: true }), JSON.stringify({ 'items[0].modality': 'Reported' }), 'CIBI',
    JSON.stringify({ tier: 'CIBI', mode: 'offline', peer_id: null, fallback_reason: 'seed-synthetic', synthetic: true }), now]);
  await d.runAsync('INSERT INTO report_versions (inspection_id, version, tier, json, provenance, created_at) VALUES (?,?,?,?,?,?)',
    [id, 1, 'CIBI', JSON.stringify({ title: 'Informe · Hospital Alpha', items: [
      { modality: 'MR', qty: 3, age: '4–10 años', conf: 'Alta' },
      { modality: 'CT', qty: 2, age: 'desconocida', conf: 'Media' },
      { modality: 'US', qty: 5, age: 'mixta', conf: 'Media' },
    ], synthetic: true }), JSON.stringify({ tier: 'CIBI', mode: 'offline', synthetic: true }), now]);
}
