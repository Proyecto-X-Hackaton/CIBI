// voice.ts — F01 voice (STRETCH): Parakeet-TDT on-device transcription.
// Typed input is P0 and always available; voice failure → typed fallback.

import { PARAKEET_TDT_0_6B_V3_Q8_0 } from '@qvac/sdk';
import { runTranscribe } from './qvacClient';

export async function transcribeAudio(opts: {
  audioPath: string;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ text: string; ok: boolean; error?: string }> {
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
    if (!clean) return { text: '', ok: false, error: 'empty-transcript' };
    return { text: clean, ok: true };
  } catch (e: any) {
    return { text: '', ok: false, error: String(e?.message ?? e ?? 'transcribe-failed') };
  }
}
