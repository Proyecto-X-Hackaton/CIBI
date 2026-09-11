// route.ts — provenance for local vs local-LAN peer inference.
// The peer is never cloud/Django; it is an explicitly configured QVAC host.

export type InferenceMode = 'offline' | 'peer';

export interface RouteMeta {
  mode: InferenceMode;
  peer_id: string | null;
  fallback_reason: string | null;
}

export const OFFLINE_ROUTE: RouteMeta = {
  mode: 'offline',
  peer_id: null,
  fallback_reason: null,
};

export function peerId(base: string): string {
  const clean = base.trim().replace(/\/+$/, '');
  try {
    const u = new URL(clean);
    return u.host || clean;
  } catch {
    return clean.replace(/^https?:\/\//, '');
  }
}

export function peerRoute(base: string): RouteMeta {
  return { mode: 'peer', peer_id: peerId(base), fallback_reason: null };
}

export function offlineFallback(base: string, reason: unknown): RouteMeta {
  const detail = String(reason instanceof Error ? reason.message : reason ?? 'peer-failed').slice(0, 240);
  return { mode: 'offline', peer_id: null, fallback_reason: `peer:${peerId(base)} ${detail}` };
}
