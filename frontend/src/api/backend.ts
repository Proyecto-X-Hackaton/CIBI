// backend.ts — DRF CRUD/sync client ONLY. Zero inference: this file sends
// already-structured JSON + provenance and receives aggregates. It never
// builds prompts, never selects models, never calls any AI endpoint.
// (Grep gate: this file imports no ML libraries and calls no model APIs.)

import { pendingOutbox, markOutboxSynced } from '../db/database';

const DEFAULT_BASE = 'http://10.0.2.2:8000'; // Android emulator loopback; on a physical device use the LAN IP of the DRF host.

export function backendBase(configured?: string | null): string {
  return (configured && configured.trim()) || DEFAULT_BASE;
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
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(t);
  }
}

export async function checkHealth(base: string): Promise<boolean> {
  try {
    const r = await req(base, '/api/health/');
    return r?.status === 'ok';
  } catch {
    return false;
  }
}

/** Push PENDING outbox rows idempotently (server upserts by client_uuid). */
export async function pushOutbox(base: string): Promise<{ pushed: number }> {
  const rows = await pendingOutbox();
  if (rows.length === 0) return { pushed: 0 };
  const okIds: number[] = [];
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
        await req(base, '/api/sync/push/', { method: 'POST', body: JSON.stringify({ entity: row.entity, payload }) });
      }
      okIds.push(row.id);
    } catch {
      break; // stop on first failure; backoff retry next time (offline-first)
    }
  }
  await markOutboxSynced(okIds);
  return { pushed: okIds.length };
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
