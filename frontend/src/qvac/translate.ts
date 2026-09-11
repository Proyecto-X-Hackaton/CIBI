// translate.ts — F01: typed ES/PT → EN normalized, original always kept.
// TranslatePsy = Bergamot pairs via nmtcpp-translation. (P0: typed; voice is stretch.)

import { BERGAMOT_ES_EN, BERGAMOT_PT_EN } from '@qvac/sdk';
import { runTranslate } from './qvacClient';
import { peerTranslate, PEER_MODELS } from './peerClient';
import type { TierId } from './TIER_ROSTER';
import { OFFLINE_ROUTE, offlineFallback, peerRoute, type RouteMeta } from './route';

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
  tier?: TierId;
  peerBase?: string;
  onProgress?: (pct: number | null, stage: string) => void;
}): Promise<{ text_en: string; lang: SourceLang; untranslated: boolean; route: RouteMeta }> {
  const lang = opts.lang ?? detectLangHeuristic(opts.text);
  const tier = opts.tier ?? 'CIBI';
  const modelConst = lang === 'pt' ? BERGAMOT_PT_EN : BERGAMOT_ES_EN;
  const modelName = lang === 'pt' ? 'BERGAMOT_PT_EN' : 'BERGAMOT_ES_EN';
  const peerModel = lang === 'pt' ? PEER_MODELS.translatePt : PEER_MODELS.translateEs;
  if (tier !== 'CIBI' && opts.peerBase) {
    try {
      opts.onProgress?.(null, 'peer-translate');
      const { text } = await peerTranslate({ base: opts.peerBase, tier, model: peerModel, text: opts.text });
      const clean = text.trim();
      if (!clean) throw new Error('empty peer translation');
      return { text_en: clean, lang, untranslated: false, route: peerRoute(opts.peerBase) };
    } catch (peerError) {
      opts.onProgress?.(null, 'peer-fallback');
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
        if (clean) return { text_en: clean, lang, untranslated: false, route: offlineFallback(opts.peerBase, peerError) };
      } catch {}
      return { text_en: opts.text, lang, untranslated: true, route: offlineFallback(opts.peerBase, peerError) };
    }
  }
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
    return { text_en: clean, lang, untranslated: false, route: OFFLINE_ROUTE };
  } catch {
    // Fallback (F01 roster): keep original, flag untranslated. Pipeline continues.
    return { text_en: opts.text, lang, untranslated: true, route: OFFLINE_ROUTE };
  }
}
