// voice.ts — F01 voice (STRETCH): Parakeet-TDT on-device transcription.
// Typed input is P0 and always available; voice failure → typed fallback.

import { PARAKEET_TDT_0_6B_V3_Q8_0 } from '@qvac/sdk';
import { runTranscribe } from './qvacClient';
import { peerTranscribe } from './peerClient';
import type { TierId } from './TIER_ROSTER';
import { OFFLINE_ROUTE, offlineFallback, peerRoute, type RouteMeta } from './route';

export async function transcribeAudio(opts: {
  audioPath: string;
  tier?: TierId;
  peerBase?: string;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ text: string; ok: boolean; error?: string; route: RouteMeta }> {
  const tier = opts.tier ?? 'CIBI';
  if (tier !== 'CIBI' && opts.peerBase) {
    try {
      opts.onProgress?.(null, 'peer-transcribe');
      const { text } = await peerTranscribe({ base: opts.peerBase, tier, audioPath: opts.audioPath });
      const clean = text.trim();
      if (!clean) throw new Error('empty peer transcript');
      return { text: clean, ok: true, route: peerRoute(opts.peerBase) };
    } catch (peerError) {
      opts.onProgress?.(null, 'peer-fallback');
      try {
        const local = await runLocalTranscribe(opts);
        return { ...local, route: offlineFallback(opts.peerBase, peerError) };
      } catch (e: any) {
        return { text: '', ok: false, error: String(e?.message ?? e ?? peerError), route: offlineFallback(opts.peerBase, peerError) };
      }
    }
  }
  try {
    return await runLocalTranscribe(opts);
  } catch (e: any) {
    return { text: '', ok: false, error: String(e?.message ?? e ?? 'transcribe-failed'), route: OFFLINE_ROUTE };
  }
}

async function runLocalTranscribe(opts: { audioPath: string; onProgress?: (pct: number | null, stage: string) => void }): Promise<{ text: string; ok: boolean; error?: string; route: RouteMeta }> {
  try {
    const { text } = await runTranscribe({
      tier: 'CIBI',
      modelConst: PARAKEET_TDT_0_6B_V3_Q8_0,
      modelName: 'PARAKEET_TDT_0_6B_V3_Q8_0',
      quant: 'Q8_0',
      audioPath: opts.audioPath,
      onProgress: opts.onProgress,
    });
    const clean = text.trim();
    if (!clean) return { text: '', ok: false, error: 'empty-transcript', route: OFFLINE_ROUTE };
    return { text: clean, ok: true, route: OFFLINE_ROUTE };
  } catch (e: any) {
    return { text: '', ok: false, error: String(e?.message ?? e ?? 'transcribe-failed'), route: OFFLINE_ROUTE };
  }
}
