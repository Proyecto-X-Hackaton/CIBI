// dedupRag.ts — F04 dedup: GTE embeddings + built-in RAG workspace per site
// (prototype-only, disclosed) with keyword-overlap fallback. Warns, never
// auto-merges. Similarity > 0.85 → "¿Es el mismo MR que…?".

import { GTE_LARGE_FP16 } from '@qvac/sdk';
import { runRagSearch } from './qvacClient';

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

export async function findDuplicates(opts: {
  siteWorkspace: string;
  newItemLabel: string;
  existingLabels: Array<{ id: string; label: string }>;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ candidates: DuplicateCandidate[]; method: 'rag' | 'keyword' }> {
  const seedDocs = opts.existingLabels.map((e) => `[${e.id}] ${e.label}`);
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
