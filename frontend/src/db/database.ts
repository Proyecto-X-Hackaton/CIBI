// database.ts — F05: expo-sqlite is the single structured source of truth.
// Write-through: every chat turn, photo, audio and edit hits SQLite/files in
// the same interaction, so killing the app never loses a draft. Tables mirror
// F05 spec. Binaries live under documentDirectory/cibi/media/.

import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

let db: SQLite.SQLiteDatabase | null = null;

export function mediaDir(): string {
  return `${(FileSystem as any).documentDirectory}cibi/media`;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('cibi.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS inspections (
      client_uuid TEXT PRIMARY KEY,
      customer TEXT, city TEXT, country TEXT, author TEXT,
      observed_at TEXT, status TEXT DEFAULT 'BORRADOR',
      planned_uuid TEXT, updated_at TEXT, synthetic INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT, seq INTEGER,
      role TEXT, text_original TEXT, lang TEXT, text_en TEXT,
      audio_ref TEXT, photo_ref TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS photo_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT, photo_ref TEXT, authorized INTEGER DEFAULT 0,
      ocr_json TEXT, vision_json TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audio_clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT, seq INTEGER, file_ref TEXT, transcript_state TEXT
    );
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT, structured_json TEXT, confidence_map TEXT,
      tier TEXT, provenance TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS report_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT, version INTEGER, tier TEXT,
      json TEXT, provenance TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS planned_visits (
      planned_uuid TEXT PRIMARY KEY, site_id TEXT,
      date_label TEXT, date TEXT, reason TEXT, status TEXT DEFAULT 'planned',
      synthetic INTEGER DEFAULT 1, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT, entity TEXT, payload TEXT,
      status TEXT DEFAULT 'PENDING', attempts INTEGER DEFAULT 0, updated_at TEXT
    );
  `);
  await FileSystem.makeDirectoryAsync(`${mediaDir()}/photos`, { intermediates: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(`${mediaDir()}/audio`, { intermediates: true }).catch(() => {});
  // Light migration for DBs created before photo_ref existed.
  await db.execAsync('ALTER TABLE messages ADD COLUMN photo_ref TEXT').catch(() => {});
  return db;
}

export function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---- inspections ----
export interface Inspection {
  client_uuid: string;
  customer: string | null;
  city: string | null;
  country: string | null;
  author: string;
  observed_at: string;
  status: 'BORRADOR' | 'PENDING' | 'SYNCED';
  planned_uuid: string | null;
  updated_at: string;
}

export async function createInspection(input: { customer?: string | null; city?: string | null; country?: string | null; author?: string; planned_uuid?: string | null }): Promise<Inspection> {
  const d = await getDb();
  const row: Inspection = {
    client_uuid: uuid(),
    customer: input.customer ?? null,
    city: input.city ?? null,
    country: input.country ?? null,
    author: input.author ?? 'A. Ruiz',
    observed_at: nowIso(),
    status: 'BORRADOR',
    planned_uuid: input.planned_uuid ?? null,
    updated_at: nowIso(),
  };
  await d.runAsync(
    'INSERT INTO inspections (client_uuid, customer, city, country, author, observed_at, status, planned_uuid, updated_at, synthetic) VALUES (?,?,?,?,?,?,?,?,?,1)',
    [row.client_uuid, row.customer, row.city, row.country, row.author, row.observed_at, row.status, row.planned_uuid, row.updated_at],
  );
  await enqueueOutbox(row.client_uuid, 'inspection', { ...row });
  if (row.planned_uuid) {
    await d.runAsync("UPDATE planned_visits SET status='done', updated_at=? WHERE planned_uuid=?", [nowIso(), row.planned_uuid]);
  }
  return row;
}

export async function updateInspection(id: string, patch: Partial<Inspection>): Promise<void> {
  const d = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (['customer', 'city', 'country', 'author', 'status', 'observed_at'].includes(k)) {
      sets.push(`${k}=?`);
      vals.push(v);
    }
  }
  sets.push('updated_at=?');
  vals.push(nowIso());
  vals.push(id);
  await d.runAsync(`UPDATE inspections SET ${sets.join(',')} WHERE client_uuid=?`, vals);
  const cur = await getInspection(id);
  if (cur) await enqueueOutbox(id, 'inspection', { ...cur });
}

export async function getInspection(id: string): Promise<Inspection | null> {
  const d = await getDb();
  return (await d.getFirstAsync('SELECT client_uuid, customer, city, country, author, observed_at, status, planned_uuid, updated_at FROM inspections WHERE client_uuid=?', [id])) as Inspection | null;
}

export async function listInspections(): Promise<Inspection[]> {
  const d = await getDb();
  return (await d.getAllAsync('SELECT client_uuid, customer, city, country, author, observed_at, status, planned_uuid, updated_at FROM inspections ORDER BY updated_at DESC LIMIT 100')) as Inspection[];
}

// ---- messages (write-through chat history) ----
export interface ChatMsg { role: 'user' | 'assistant'; text_original: string; lang: string | null; text_en: string | null; photo_ref?: string | null; }

export async function appendMessage(inspectionId: string, msg: ChatMsg): Promise<void> {
  const d = await getDb();
  const row = await d.getFirstAsync('SELECT COUNT(*) as n FROM messages WHERE inspection_id=?', [inspectionId]) as any;
  const seq = Number(row?.n ?? 0) + 1;
  await d.runAsync('INSERT INTO messages (inspection_id, seq, role, text_original, lang, text_en, photo_ref, created_at) VALUES (?,?,?,?,?,?,?,?)',
    [inspectionId, seq, msg.role, msg.text_original, msg.lang, msg.text_en, msg.photo_ref ?? null, nowIso()]);
  await d.runAsync('UPDATE inspections SET updated_at=? WHERE client_uuid=?', [nowIso(), inspectionId]);
}

export async function getMessages(inspectionId: string): Promise<ChatMsg[]> {
  const d = await getDb();
  const rows = (await d.getAllAsync('SELECT role, text_original, lang, text_en, photo_ref FROM messages WHERE inspection_id=? ORDER BY seq ASC', [inspectionId])) as any[];
  return rows.map((r) => ({ role: r.role, text_original: r.text_original, lang: r.lang, text_en: r.text_en, photo_ref: r.photo_ref ?? null }));
}

// ---- photo evidence ----
export async function savePhotoEvidence(inspectionId: string, photoRef: string, authorized: boolean, ocrJson: any, visionJson: any): Promise<void> {
  const d = await getDb();
  await d.runAsync('INSERT INTO photo_evidence (inspection_id, photo_ref, authorized, ocr_json, vision_json, created_at) VALUES (?,?,?,?,?,?)',
    [inspectionId, photoRef, authorized ? 1 : 0, JSON.stringify(ocrJson ?? null), JSON.stringify(visionJson ?? null), nowIso()]);
}

export async function getPhotos(inspectionId: string): Promise<any[]> {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM photo_evidence WHERE inspection_id=? ORDER BY id ASC', [inspectionId]);
}

// ---- observations / reports ----
export async function saveObservation(inspectionId: string, structured: any, confidenceMap: any, tier: string, provenance: any): Promise<void> {
  const d = await getDb();
  await d.runAsync('INSERT INTO observations (inspection_id, structured_json, confidence_map, tier, provenance, created_at) VALUES (?,?,?,?,?,?)',
    [inspectionId, JSON.stringify(structured), JSON.stringify(confidenceMap), tier, JSON.stringify(provenance), nowIso()]);
}

export async function getLatestObservation(inspectionId: string): Promise<any | null> {
  const d = await getDb();
  return d.getFirstAsync('SELECT * FROM observations WHERE inspection_id=? ORDER BY id DESC LIMIT 1', [inspectionId]);
}

export async function saveReportVersion(inspectionId: string, tier: string, json: any, provenance: any): Promise<number> {
  const d = await getDb();
  const row = (await d.getFirstAsync('SELECT MAX(version) as v FROM report_versions WHERE inspection_id=?', [inspectionId])) as any;
  const version = Number(row?.v ?? 0) + 1;
  await d.runAsync('INSERT INTO report_versions (inspection_id, version, tier, json, provenance, created_at) VALUES (?,?,?,?,?,?)',
    [inspectionId, version, tier, JSON.stringify(json), JSON.stringify(provenance), nowIso()]);
  await enqueueOutbox(inspectionId, 'report', { inspection_id: inspectionId, version, tier, json, provenance });
  return version;
}

export async function getReportVersions(inspectionId: string): Promise<any[]> {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM report_versions WHERE inspection_id=? ORDER BY version ASC', [inspectionId]);
}

// ---- planned visits (functional P0, no OS calendar) ----
export async function planVisit(input: { site_id: string; date_label: 'manana' | 'prox_semana' | 'fecha'; date: string; reason: string }): Promise<string> {
  const d = await getDb();
  const planned_uuid = uuid();
  await d.runAsync('INSERT INTO planned_visits (planned_uuid, site_id, date_label, date, reason, status, synthetic, updated_at) VALUES (?,?,?,?,?,?,1,?)',
    [planned_uuid, input.site_id, input.date_label, input.date, input.reason, 'planned', nowIso()]);
  await enqueueOutbox(planned_uuid, 'planned_visit', { planned_uuid, ...input, status: 'planned', synthetic: true });
  return planned_uuid;
}

export async function listPlannedVisits(): Promise<any[]> {
  const d = await getDb();
  return d.getAllAsync("SELECT * FROM planned_visits WHERE status='planned' ORDER BY date ASC");
}

export async function setPlannedStatus(plannedUuid: string, status: 'planned' | 'done' | 'cancelled'): Promise<void> {
  const d = await getDb();
  await d.runAsync('UPDATE planned_visits SET status=?, updated_at=? WHERE planned_uuid=?', [status, nowIso(), plannedUuid]);
}

// ---- outbox ----
export async function enqueueOutbox(clientUuid: string, entity: string, payload: any): Promise<void> {
  const d = await getDb();
  await d.runAsync('INSERT INTO outbox (client_uuid, entity, payload, status, attempts, updated_at) VALUES (?,?,?,?,0,?)',
    [clientUuid, entity, JSON.stringify({ ...payload, synthetic: true }), 'PENDING', nowIso()]);
}

export async function pendingOutbox(): Promise<any[]> {
  const d = await getDb();
  return d.getAllAsync("SELECT * FROM outbox WHERE status='PENDING' ORDER BY id ASC LIMIT 50");
}

export async function markOutboxSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const d = await getDb();
  await d.runAsync(`UPDATE outbox SET status='SYNCED', updated_at=? WHERE id IN (${ids.map(() => '?').join(',')})`, [nowIso(), ...ids]);
}

export async function pendingCount(): Promise<number> {
  const d = await getDb();
  const row = (await d.getFirstAsync("SELECT COUNT(*) as n FROM outbox WHERE status='PENDING'")) as any;
  return Number(row?.n ?? 0);
}
