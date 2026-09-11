// dedupRag.ts — F04 dedup: GTE embeddings + built-in RAG workspace per site
// (prototype-only, disclosed) with keyword-overlap fallback. Warns, never
// auto-merges. Similarity > 0.85 → "¿Es el mismo MR que…?".

import { GTE_LARGE_FP16 } from '@qvac/sdk';
import { runRagSearch } from './qvacClient';
import { peerEmbed } from './peerClient';
import type { TierId } from './TIER_ROSTER';

export interface DuplicateCandidate {
  candidate_id: string;
  label: string;
  similarity: number;
}

export function keywordSimilarity(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9áéíóúñüçãõ ]/gi, ' ').split(/\s+/).filter((w) => w.length > 2));
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / Math.max(A.size, B.size);
}

export function describeItem(label: string): string {
  return label;
}

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export async function findDuplicates(opts: {
  siteWorkspace: string;
  newItemLabel: string;
  existingLabels: Array<{ id: string; label: string }>;
  tier?: TierId;
  peerBase?: string;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ candidates: DuplicateCandidate[]; method: 'rag' | 'peer-embedding' | 'keyword' }> {
  const tier = opts.tier ?? 'CIBI';
  const seedDocs = opts.existingLabels.map((e) => `[${e.id}] ${e.label}`);
  if (tier !== 'CIBI' && opts.peerBase && opts.existingLabels.length > 0) {
    try {
      opts.onProgress?.(null, 'peer-embed');
      const texts = [opts.newItemLabel, ...opts.existingLabels.map((e) => e.label)];
      const { vectors } = await peerEmbed({ base: opts.peerBase, tier, text: texts });
      if (vectors.length !== texts.length) throw new Error('peer-embedding-count-mismatch');
      const candidates = opts.existingLabels
        .map((e, i) => ({ candidate_id: e.id, label: e.label, similarity: cosine(vectors[0], vectors[i + 1]) }))
        .filter((c) => c.similarity > 0.85)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);
      return { candidates, method: 'peer-embedding' };
    } catch {
      // A peer embedding failure falls through to the on-device RAG/keyword path.
    }
  }
  try {
    const { results } = await runRagSearch({
      tier: 'CIBI',
      modelConst: GTE_LARGE_FP16,
      modelName: 'GTE_LARGE_FP16',
      quant: 'FP16',
      workspace: opts.siteWorkspace,
      seedDocs,
      query: opts.newItemLabel,
      topK: 3,
      onProgress: opts.onProgress,
    });
    const candidates: DuplicateCandidate[] = results
      .map((r) => {
        const m = r.content.match(/^\[(.+?)\]\s*(.*)$/);
        return { candidate_id: m?.[1] ?? r.content.slice(0, 24), label: m?.[2] ?? r.content, similarity: r.score };
      })
      .filter((c) => c.similarity > 0.85);
    return { candidates, method: 'rag' };
  } catch {
    // Fallback: keyword overlap (TECH_STACK §4).
    const candidates = opts.existingLabels
      .map((e) => ({ candidate_id: e.id, label: e.label, similarity: keywordSimilarity(opts.newItemLabel, e.label) }))
      .filter((c) => c.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
    return { candidates, method: 'keyword' };
  }
}
