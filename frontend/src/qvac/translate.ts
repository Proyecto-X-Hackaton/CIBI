// translate.ts — F01: typed ES/PT → EN normalized, original always kept.
// TranslatePsy = Bergamot pairs via nmtcpp-translation. (P0: typed; voice is stretch.)

import { BERGAMOT_ES_EN, BERGAMOT_PT_EN } from '@qvac/sdk';
import { runTranslate } from './qvacClient';

export type SourceLang = 'es' | 'pt';

export function detectLangHeuristic(text: string): SourceLang {
  // Tiny heuristic; the user can override per message. Never blocks the flow.
  const t = ` ${text.toLowerCase()} `;
  const ptMarkers = [' você ', ' você', 'obrigado', 'obrigada', 'não ', 'não', ' dos ', ' das ', ' para ', ' com ', 'hospital o ', 'ressonância', 'ultrassom', 'tomografia'];
  let score = 0;
  for (const m of ptMarkers) if (t.includes(m)) score += 1;
  // ñ is decisive for ES
  if (text.includes('ñ') || text.includes('Ñ')) score -= 3;
  return score > 0 ? 'pt' : 'es';
}

export async function normalizeToEnglish(opts: {
  text: string;
  lang?: SourceLang;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ text_en: string; lang: SourceLang; untranslated: boolean }> {
  const lang = opts.lang ?? detectLangHeuristic(opts.text);
  const modelConst = lang === 'pt' ? BERGAMOT_PT_EN : BERGAMOT_ES_EN;
  const modelName = lang === 'pt' ? 'BERGAMOT_PT_EN' : 'BERGAMOT_ES_EN';
  try {
    const { text } = await runTranslate({
      tier: 'CIBI',
      modelConst,
      modelName,
      quant: 'int8',
      from: lang,
      to: 'en',
      text: opts.text,
      onProgress: opts.onProgress,
    });
    const clean = text.trim();
    if (!clean) throw new Error('empty translation');
    return { text_en: clean, lang, untranslated: false };
  } catch {
    // Fallback (F01 roster): keep original, flag untranslated. Pipeline continues.
    return { text_en: opts.text, lang, untranslated: true };
  }
}
