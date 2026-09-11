// ReportScreen — SCREEN_03 + F06: versioned report + offline PDF + share.
// Render from local SQLite (works in airplane mode). Re-generate creates
// v+1 with chosen tier (CIBI on-device or Pro/Super via LAN QVAC). PDF via expo-print
// local HTML template → expo-sharing sheet. Zero inference on export.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Disclaimer } from '../components/atoms';
import { useTheme } from '../../theme/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { ON_DARK, LightTheme, CONFIDENCE_COLORS, type ThemeTokens } from '../../theme/tokens';
import { WizardHeader } from '../components/WizardHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { useStrings } from '../i18n/useStrings';
import { getReportVersions, getInspection, getMessages, saveReportVersion, type Inspection } from '../db/database';
import { TIER_ROSTER, tierById, type TierId } from '../qvac/TIER_ROSTER';
import { structureEntitiesWithRoute } from '../qvac/structure';

export default function ReportScreen({ inspectionId }: { inspectionId: string }) {
  const { setWizard, setDetailsOpen, tier, selectTier, peerBase, uiLang } = useApp();
  const t = useStrings();
  const { theme: th } = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [versions, setVersions] = useState<any[]>([]);
  const [customer, setCustomer] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastMode, setLastMode] = useState<'offline' | 'peer'>(tier === 'CIBI' ? 'offline' : 'peer');

  const reload = async () => {
    const nextVersions = await getReportVersions(inspectionId);
    setVersions(nextVersions);
    const latestVersion = nextVersions[nextVersions.length - 1];
    try {
      const provenance = latestVersion?.provenance ? JSON.parse(latestVersion.provenance) : null;
      if (provenance?.mode === 'peer' || provenance?.mode === 'offline') setLastMode(provenance.mode);
    } catch {}
    const ins = await getInspection(inspectionId);
    setInspection(ins);
    if (ins?.customer) setCustomer(ins.customer);
  };
  useEffect(() => { reload(); }, [inspectionId]);

  const latest = versions[versions.length - 1];
  const latestJson = latest ? JSON.parse(latest.json) : null;

  const chooseTier = async (next: TierId) => {
    if (next === tier || busy) return;
    const ok = await selectTier(next);
    if (!ok) Alert.alert('Peer QVAC no disponible', `No se pudo verificar ${peerBase}. Se mantiene ${tier}. Revisa Ajustes → Peer QVAC.`);
  };

  const regen = async () => {
    setBusy(true);
    try {
      const msgs = await getMessages(inspectionId).catch(() => []);
      const source = msgs.filter((m) => m.text_en).map((m) => m.text_en as string).join('\n') || msgs.map((m) => m.text_original).join('\n') || JSON.stringify(latestJson ?? { items: [] });
      const result = await structureEntitiesWithRoute({ text_en: source, tier, peerBase });
      setLastMode(result.route.mode);
      await saveReportVersion(
        inspectionId,
        tier,
        { ...result.report, regenerated: true, synthetic: true },
        { tier, mode: result.route.mode, peer_id: result.route.peer_id, fallback_reason: result.route.fallback_reason, synthetic: true },
      );
      await reload();
    } catch (error: any) {
      Alert.alert('Informe', `No se pudo regenerar: ${String(error?.message ?? error).slice(0, 180)}`);
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const html = buildReportHtml({
        lang: uiLang,
        items: latestJson?.items ?? [],
        customer: customer ?? inspection?.customer ?? latestJson?.customer ?? null,
        city: inspection?.city ?? latestJson?.city ?? null,
        country: inspection?.country ?? latestJson?.country ?? null,
        author: inspection?.author ?? null,
        observedAt: inspection?.observed_at ?? null,
        version: latest?.version ?? null,
        tierName: latest?.tier ?? tier,
        mode: lastMode,
        versions,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert('PDF listo', uri);
    } catch {
      Alert.alert('PDF', 'No se pudo generar el PDF en este dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 + insets.bottom }}>
      <WizardHeader title={customer ? `${t.wizardReport} · ${customer}` : t.wizardReport} onBack={() => setWizard({ name: 'review', inspectionId })} />
      <Text style={s.sub}>Reporte v{latest?.version ?? '—'} · {tier} · {lastMode === 'peer' ? 'peer QVAC local' : 'en tu teléfono'} · inspección editable siempre · {t.synthetic}</Text>
      <View style={s.card}>
        <Text style={s.h3}>Generar con</Text>
        <View style={s.tierbar}>
          {TIER_ROSTER.map((tt) => (
            <TouchableOpacity key={tt.id} style={[s.tier, tier === tt.id && s.tierOn]} onPress={() => chooseTier(tt.id)} disabled={busy}>
              <Text style={s.tierText}>{tt.label}{tt.where === 'peer' ? ' · LAN' : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.sub}>Selección actual: {tier} · <Text onPress={() => setDetailsOpen(true)} style={{ textDecorationLine: 'underline' }}>detalles</Text></Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Parque instalado (informe v{latest?.version ?? '—'})</Text>
        {(latestJson?.items ?? []).map((it: any, i: number) => (
          <View key={i} style={s.row}><Text style={s.cell}>{it.modality}</Text><Text style={s.cell}>{it.qty}</Text><Text style={s.cell}>{it.age_text ?? it.age ?? '—'}</Text><Text style={s.cell}>{it.confidence ?? it.conf ?? ''}</Text></View>
        ))}
        {(latestJson?.items ?? []).length === 0 && <Text style={s.sub}>{t.noReportYet}</Text>}
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Historial informe + inspección</Text>
        {versions.map((v) => (
          <View key={v.id} style={s.histRow}><Icon name="report" size={14} color={th.muted} /><Text style={s.sub}>Informe v{v.version} · {v.tier} · {new Date(v.created_at).toLocaleDateString()}</Text></View>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <TouchableOpacity style={s.cta2} onPress={regen} disabled={busy} accessibilityRole="button">
          <Text style={s.ctaText}>{busy ? '…' : t.regenerate}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={exportPdf} disabled={busy} accessibilityRole="button">
          <Text style={s.secText}>{t.exportPdf}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghost} onPress={() => setWizard({ name: 'chat', inspectionId })} accessibilityRole="button">
          <Text style={s.ghostText}>{t.editInspection}</Text>
        </TouchableOpacity>
      </View>
      {busy ? <ActivityIndicator color={th.green} /> : null}
      <Disclaimer />
    </ScrollView>
  );
}

// ---- PDF document template (local export, zero inference) ----
// Print-shaped A4 document: branded header, compliance banner, summary
// cards, repeatable equipment table and version history. Colors come from
// LightTheme tokens (printing) + CONFIDENCE_COLORS chips.

type PdfLang = 'es' | 'en';

const PDF_LABELS = {
  es: {
    headline: 'Informe de parque instalado',
    report: 'Informe', generated: 'Generado', observed: 'Fecha de inspección',
    engineer: 'Ingeniero', location: 'Ubicación', notSet: 'sin especificar',
    disclaimer: 'Extracción de inventario de equipamiento. No es diagnóstico clínico.',
    summaryMachines: 'Equipos', summaryUnits: 'Unidades', summaryAge: 'Edad prom.', years: 'años',
    modalTitle: 'Equipos registrados', modalName: 'Tipo', detail: 'Fabricante · Modelo',
    qty: 'Cant.', age: 'Edad aprox.', source: 'Fuente', conf: 'Conf.',
    history: 'Historial de versiones', histVersion: 'Informe', mode: 'Modo', date: 'Fecha',
    modeOffline: 'en tu teléfono', modePeer: 'peer QVAC local',
    empty: 'Sin equipos registrados en esta versión.',
  },
  en: {
    headline: 'Installed-base report',
    report: 'Report', generated: 'Generated', observed: 'Inspection date',
    engineer: 'Engineer', location: 'Location', notSet: 'not specified',
    disclaimer: 'Equipment inventory extraction. Not a clinical diagnosis.',
    summaryMachines: 'Equipment', summaryUnits: 'Total units', summaryAge: 'Avg. age', years: 'yrs',
    modalTitle: 'Registered equipment', modalName: 'Type', detail: 'Manufacturer · Model',
    qty: 'Qty', age: 'Age approx.', source: 'Source', conf: 'Conf.',
    history: 'Version history', histVersion: 'Report', mode: 'Mode', date: 'Date',
    modeOffline: 'on device', modePeer: 'local QVAC peer',
    empty: 'No equipment recorded in this version.',
  },
} as const;

const MODALITY_LABEL: Record<PdfLang, Record<string, string>> = {
  es: { MR: 'Resonancia (MR)', CT: 'Tomografía (CT)', US: 'Ultrasonido (US)', XR: 'Rayos X (XR)' },
  en: { MR: 'MRI', CT: 'CT', US: 'Ultrasound', XR: 'X-ray' },
};

const SOURCE_LABEL: Record<PdfLang, Record<string, string>> = {
  es: { text: 'texto', photo: 'foto', ocr: 'OCR', catalog: 'catálogo' },
  en: { text: 'text', photo: 'photo', ocr: 'OCR', catalog: 'catalog' },
};

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function fmtDate(iso: string | null | undefined, lang: PdfLang): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(lang === 'es' ? 'es' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toLocaleDateString();
  }
}

function buildReportHtml(ctx: {
  lang: PdfLang;
  items: any[];
  customer: string | null;
  city: string | null;
  country: string | null;
  author: string | null;
  observedAt: string | null;
  version: number | null;
  tierName: string;
  mode: 'offline' | 'peer';
  versions: any[];
}): string {
  const L = PDF_LABELS[ctx.lang];
  const modLabel = MODALITY_LABEL[ctx.lang];
  const srcLabel = SOURCE_LABEL[ctx.lang];
  const P = LightTheme;

  const totalUnits = ctx.items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const ages = ctx.items.map((it) => Number(it.age_years)).filter((n) => Number.isFinite(n) && n > 0);
  const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;

  const rows = ctx.items.length
    ? ctx.items.map((it) => {
        const maker = [it.manufacturer, it.model].filter(Boolean).join(' · ');
        const age = it.age_text ?? (Number.isFinite(Number(it.age_years)) ? `${it.age_years} ${L.years}` : '—');
        const conf = it.confidence ?? it.conf ?? 'Unknown';
        return `<tr>
          <td class="mod"><b>${esc(modLabel[it.modality] ?? it.modality)}</b></td>
          <td>${esc(maker || L.notSet)}</td>
          <td class="num">${esc(it.qty ?? 1)}</td>
          <td>${esc(age)}</td>
          <td>${esc(srcLabel[it.source] ?? it.source)}</td>
          <td><span class="chip" style="background:${CONFIDENCE_COLORS[conf] ?? CONFIDENCE_COLORS.Unknown}">${esc(conf)}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" class="empty">${esc(L.empty)}</td></tr>`;

  const histRows = ctx.versions.map((v) => {
    let mode: string | null = null;
    try { mode = JSON.parse(v?.provenance ?? 'null')?.mode ?? null; } catch {}
    const modeLabel = mode === 'peer' ? L.modePeer : mode === 'offline' ? L.modeOffline : '—';
    const tierLabel = tierById(String(v?.tier ?? 'CIBI') as TierId)?.label ?? v?.tier ?? 'CIBI';
    return `<tr>
      <td><b>${esc(L.histVersion)} v${esc(v?.version ?? 1)}</b></td>
      <td>${esc(tierLabel)}</td>
      <td>${esc(modeLabel)}</td>
      <td>${esc(fmtDate(v?.created_at, ctx.lang))}</td>
    </tr>`;
  }).join('');
  const historyHtml = ctx.versions.length
    ? `<div class="section">${esc(L.history)}</div>
       <table>
         <thead><tr><th>${esc(L.histVersion)}</th><th>Tier</th><th>${esc(L.mode)}</th><th>${esc(L.date)}</th></tr></thead>
         <tbody>${histRows}</tbody>
       </table>`
    : '';

  const tierLabel = tierById(ctx.tierName as TierId)?.label ?? ctx.tierName;
  const modeLabel = ctx.mode === 'peer' ? L.modePeer : L.modeOffline;
  const location = [ctx.city, ctx.country].filter(Boolean).join(', ');
  const nowIso = new Date().toISOString();

  const css = `
    @page { size: A4 portrait; margin: 13mm 12mm 15mm 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact;
      font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: ${P.text}; font-size: 10.5pt; line-height: 1.5; }
    .brand { font-size: 8.5pt; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase; color: ${P.green}; }
    .h1 { font-size: 17pt; font-weight: 800; margin: 3px 0 0; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      border-bottom: 3px solid ${P.green}; padding-bottom: 10px; }
    .badge { text-align: right; font-size: 8.5pt; color: ${P.muted}; }
    .badge b { display: inline-block; background: ${P.green}; color: ${ON_DARK}; border-radius: 999px;
      padding: 3px 11px; margin-bottom: 4px; font-size: 8.5pt; }
    .metaline { display: flex; flex-wrap: wrap; gap: 3px 18px; margin-top: 8px; font-size: 9pt; color: ${P.muted}; }
    .metaline b { color: ${P.text}; font-weight: 700; }
    .disclaimer { margin: 12px 0 0; border: 1.5px solid rgba(180,83,9,.55); background: rgba(180,83,9,.08);
      color: ${P.amber}; border-radius: 8px; padding: 8px 12px; font-size: 9.5pt; font-weight: 700; text-align: center; }
    .cards { display: flex; gap: 10px; margin: 14px 0 4px; }
    .card { flex: 1; border: 1px solid ${P.border}; border-radius: 10px; padding: 8px 12px; }
    .card b { display: block; font-size: 15pt; }
    .card span { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .6px;
      color: ${P.muted}; font-weight: 700; margin-top: 2px; }
    .section { font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: .7px;
      color: ${P.muted}; margin: 16px 0 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    thead { display: table-header-group; }
    th { background: ${P.green}; color: ${ON_DARK}; text-align: left; font-size: 8pt;
      text-transform: uppercase; letter-spacing: .5px; padding: 7px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid ${P.border}; vertical-align: middle; font-size: 9.5pt; }
    tbody tr { page-break-inside: avoid; }
    tbody tr:nth-child(even) td { background: ${P.bg}; }
    .chip { display: inline-block; border-radius: 999px; color: ${ON_DARK}; font-size: 8pt;
      font-weight: 700; padding: 2px 9px; white-space: nowrap; }
    .num { text-align: center; }
    .mod { width: 26%; }
    .empty { text-align: center; color: ${P.muted}; padding: 16px 8px; }
    .foot { margin-top: 16px; border-top: 1px solid ${P.border}; padding-top: 8px;
      font-size: 8pt; color: ${P.muted}; display: flex; justify-content: space-between; gap: 12px; }
  `;

  return `<html lang="${ctx.lang}"><head><meta charset="utf-8" /><style>${css}</style></head><body>
    <div class="head">
      <div><div class="brand">CIBI</div><div class="h1">${esc(ctx.customer || L.headline)}</div></div>
      <div class="badge"><b>${esc(L.report)} v${esc(ctx.version ?? 1)}</b><br />${esc(tierLabel)} · ${esc(modeLabel)}</div>
    </div>
    <div class="metaline">
      <span><b>${esc(L.location)}:</b> ${esc(location || L.notSet)}</span>
      <span><b>${esc(L.observed)}:</b> ${esc(fmtDate(ctx.observedAt, ctx.lang))}</span>
      <span><b>${esc(L.engineer)}:</b> ${esc(ctx.author || L.notSet)}</span>
      <span><b>${esc(L.generated)}:</b> ${esc(fmtDate(nowIso, ctx.lang))}</span>
    </div>
    <div class="disclaimer">${esc(L.disclaimer)}</div>
    <div class="cards">
      <div class="card"><b>${ctx.items.length}</b><span>${esc(L.summaryMachines)}</span></div>
      <div class="card"><b>${totalUnits}</b><span>${esc(L.summaryUnits)}</span></div>
      <div class="card"><b>${avgAge ?? '—'}</b><span>${esc(L.summaryAge)}</span></div>
    </div>
    <div class="section">${esc(L.modalTitle)}</div>
    <table>
      <thead><tr><th class="mod">${esc(L.modalName)}</th><th>${esc(L.detail)}</th><th class="num">${esc(L.qty)}</th><th>${esc(L.age)}</th><th>${esc(L.source)}</th><th>${esc(L.conf)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${historyHtml}
    <div class="foot"><span>CIBI · synthetic:true · ${esc(modeLabel)}</span><span>${esc(fmtDate(nowIso, ctx.lang))}</span></div>
  </body></html>`;
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  back: { color: t.muted, fontSize: 13 },
  h1: { color: t.text, fontSize: 22, fontWeight: '800' },
  sub: { color: t.muted, fontSize: 13 },
  card: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: t.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  tierbar: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tier: { flex: 1, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface },
  tierOn: { borderColor: t.green, backgroundColor: 'rgba(34,197,94,.12)' },
  tierText: { color: t.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomColor: t.border, borderBottomWidth: 1 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  cell: { color: t.text, fontSize: 13, flex: 1 },
  cta2: { backgroundColor: t.green, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  ctaText: { color: t.onAccent, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  secondary: { backgroundColor: t.blue, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  secText: { color: ON_DARK, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  ghost: { borderColor: t.border, borderWidth: 1, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  ghostText: { color: t.text, textAlign: 'center', fontWeight: '600' },
});
