// confidence.ts + freshness helpers (F04).

import type { Confidence } from '../qvac/structure';

export const CONFIDENCE_ORDER: Confidence[] = ['Unknown', 'Estimated', 'Reported', 'Confirmed'];

export function upgradeConfidence(c: Confidence): Confidence {
  // Answering a follow-up: Unknown → Reported (F04).
  if (c === 'Unknown') return 'Reported';
  return c;
}

/** photo+OCR agreement (or revisit) is the ONLY path to Confirmed. */
export function mergePhotoConfidence(reported: Confidence, photoAgrees: boolean, isRevisit: boolean): Confidence {
  if (isRevisit || photoAgrees) return 'Confirmed';
  return reported;
}

export function freshnessOf(observedAt: string): 'fresh' | 'ok' | 'stale' {
  const days = (Date.now() - new Date(observedAt).getTime()) / 86400000;
  if (days < 30) return 'fresh';
  if (days <= 180) return 'ok';
  return 'stale';
}

export function freshnessLabel(observedAt: string, lang: 'es' | 'en' = 'es'): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(observedAt).getTime()) / 86400000));
  if (lang === 'en') {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  }
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days}d`;
}
