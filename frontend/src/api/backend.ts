// backend.ts — DRF CRUD/sync client ONLY. Zero inference: this file sends
// already-structured JSON + provenance and receives aggregates. It never
// builds prompts, never selects models, never calls any AI endpoint.
// (Grep gate: this file imports no ML libraries and calls no model APIs.)

import { pendingOutbox, markOutboxSynced } from '../db/database';

const DEFAULT_BASE = 'http://10.0.2.2:8000'; // Android emulator loopback; on a physical device use the LAN IP of the DRF host.

export function backendBase(configured?: string | null): string {
  return (configured && configured.trim()) || DEFAULT_BASE;
}

/** Why a health check failed — never a generic boolean (task-07 diagnostics). */
export type HealthReason = 'ok' | 'timeout' | 'unreachable' | 'bad_body' | `http_${number}`;
export interface HealthResult { ok: boolean; reason: HealthReason; url: string }

export class HttpError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`HTTP ${status} ${path}`);
    this.status = status;
  }
}

async function req(base: string, path: string, init?: RequestInit, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw new HttpError(res.status, path);
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(t);
  }
}

function isAbort(e: any): boolean {
  return e?.name === 'AbortError' || e?.name === 'TimeoutError';
}

function reasonFromError(e: any): HealthReason {
  if (e instanceof HttpError) return `http_${e.status}` as HealthReason;
  if (isAbort(e)) return 'timeout';
  return 'unreachable';
}

/** Short machine-readable error for per-row push diagnostics. */
function describeError(e: any): string {
  if (e instanceof HttpError) return `HTTP ${e.status}`;
  if (isAbort(e)) return 'timeout';
  return String(e?.message ?? e);
}

export async function checkHealth(base: string): Promise<HealthResult> {
  const url = `${base}/api/health/`;
  try {
    const r = await req(base, '/api/health/');
    const ok = r?.status === 'ok';
    // 200 but wrong body → something answered that isn't the CIBI backend.
    return { ok, reason: ok ? 'ok' : 'bad_body', url };
  } catch (e: any) {
    return { ok: false, reason: reasonFromError(e), url };
  }
}

export interface PushFailure { id: number; entity: string; error: string }

/** Push PENDING outbox rows idempotently (server upserts by client_uuid).
 *  Per-row errors are surfaced, never swallowed: a dead server (unreachable/
 *  timeout) stops the loop early, but an HTTP error on one row keeps the rest
 *  moving so a single bad row can't wedge the whole outbox. */
export async function pushOutbox(base: string): Promise<{ pushed: number; failures: PushFailure[] }> {
  const rows = await pendingOutbox();
  if (rows.length === 0) return { pushed: 0, failures: [] };
  const okIds: number[] = [];
  const failures: PushFailure[] = [];
  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload);
      if (row.entity === 'inspection') {
        await req(base, '/api/inspections/', { method: 'POST', body: JSON.stringify(payload) });
      } else if (row.entity === 'report') {
        await req(base, '/api/observations/', { method: 'POST', body: JSON.stringify(payload) });
      } else if (row.entity === 'planned_visit') {
        await req(base, '/api/planned-visits/', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        // `inspection_delete` tombstones (task-06) and future entities land here.
        await req(base, '/api/sync/push/', { method: 'POST', body: JSON.stringify({ entity: row.entity, payload }) });
      }
      okIds.push(row.id);
    } catch (e: any) {
      failures.push({ id: row.id, entity: row.entity, error: describeError(e) });
      if (!(e instanceof HttpError)) break; // server gone → stop early, retry next sync (offline-first)
    }
  }
  await markOutboxSynced(okIds);
  return { pushed: okIds.length, failures };
}

export async function fetchSites(base: string, params?: { country?: string; city?: string; flag?: string }): Promise<any[]> {
  const q = new URLSearchParams(params as any).toString();
  try {
    return await req(base, `/api/sites/${q ? `?${q}` : ''}`);
  } catch {
    return [];
  }
}

export async function fetchDashboard(base: string): Promise<any | null> {
  try {
    return await req(base, '/api/dashboard/summary/');
  } catch {
    return null;
  }
}
