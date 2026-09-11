// ReviewScreen — SCREEN_02 + F03/F04: MedPsy structures, ≤2 follow-ups,
// duplicate warning (never auto-merge), save → report v1.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ConfidenceChip, Disclaimer } from '../components/atoms';
import { useTheme } from '../../theme/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeTokens } from '../../theme/tokens';
import { WizardHeader } from '../components/WizardHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { useStrings } from '../i18n/useStrings';
import { getMessages, getPhotos, saveObservation, updateInspection, saveReportVersion, listInspections, getLatestObservation } from '../db/database';
import { structureEntities, type StructuredReport } from '../qvac/structure';
import { findDuplicates, keywordSimilarity } from '../qvac/dedupRag';
import { upgradeConfidence } from '../utils/confidence';

export default function ReviewScreen({ inspectionId }: { inspectionId: string }) {
  const { setWizard, setDetailsOpen, tier, refreshPendings } = useApp();
  const t = useStrings();
  const { theme: th } = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [busy, setBusy] = useState<string | null>('Estructurando con MedPsy…');
  const [dup, setDup] = useState<{ candidate_id: string; label: string; similarity: number } | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);
  const [followIdx, setFollowIdx] = useState(0);
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const msgs = await getMessages(inspectionId);
        const photos = await getPhotos(inspectionId).catch(() => []);
        const enAll = msgs.filter((m) => m.text_en).map((m) => m.text_en as string).join('\n') || msgs.map((m) => m.text_original).join('\n');
        const lastPhoto = photos[photos.length - 1];
        const ocrHint = lastPhoto ? JSON.parse(lastPhoto.ocr_json ?? '[]').map((b: any) => b.text).join(' ') : null;
        const visionHint = lastPhoto ? String(JSON.parse(lastPhoto.vision_json ?? '{}').modality_guess ?? '') : null;
        const structured = await structureEntities({ text_en: enAll, visionHint, ocrHint });
        if (!enAll.trim()) {
          setReport({ customer: null, city: null, country: null, items: [], confidence_map: {} });
          setBusy(null);
          return;
        }
        setReport(structured);
        // Dedup: compare against real items from other inspections (never hardcoded).
        const firstLabel = structured.items[0] ? `${structured.items[0].modality} ${structured.items[0].manufacturer ?? ''}`.trim() : 'MR';
        const others = await listInspections().catch(() => []);
        const existingLabels: Array<{ id: string; label: string }> = [];
        for (const o of others) {
          if (o.client_uuid === inspectionId) continue;
          const obs = await getLatestObservation(o.client_uuid).catch(() => null) as any;
          try {
            const r = obs?.structured_json ? JSON.parse(obs.structured_json) : null;
            for (const it of r?.items ?? []) existingLabels.push({ id: o.client_uuid.slice(0, 8), label: `${it.modality} ${it.manufacturer ?? ''} ${it.model ?? ''}`.trim() });
          } catch {}
          if (existingLabels.length >= 20) break;
        }
        const { candidates } = await findDuplicates({
          siteWorkspace: `site-${inspectionId.slice(0, 8)}`,
          newItemLabel: firstLabel,
          existingLabels,
        }).catch(() => ({ candidates: [] as any[], method: 'keyword' as const }));
        if (candidates[0]) setDup(candidates[0]);
        // Follow-ups: most valuable missing field (maker > age > qty), max 2.
        const qs: string[] = [];
        if (structured.items.some((i) => !i.manufacturer)) qs.push('¿Fabricante de los equipos sin marca?');
        if (structured.items.some((i) => i.age_years == null)) qs.push('¿Edad aproximada de los equipos sin edad?');
        setFollowups(qs.slice(0, 2));
      } catch {
        setReport({ customer: null, city: null, country: null, items: [], confidence_map: {} });
      } finally {
        setBusy(null);
      }
    })();
  }, [inspectionId]);

  const answerFollowup = () => {
    if (!report || !answer.trim()) return;
    const patched: StructuredReport = {
      ...report,
      items: report.items.map((it) => (!it.manufacturer ? { ...it, manufacturer: answer.trim(), confidence: upgradeConfidence(it.confidence) } : it)),
    };
    setReport(patched);
    setAnswer('');
    setFollowIdx((i) => i + 1);
  };

  const save = async () => {
    if (!report) return;
    setBusy('Guardando…');
    await saveObservation(inspectionId, { ...report, synthetic: true }, report.confidence_map, tier,
      { tier, mode: 'offline', peer_id: null, fallback_reason: null, synthetic: true });
    const first = report.items[0];
    await updateInspection(inspectionId, {
      customer: report.customer ?? undefined,
      city: report.city ?? undefined,
      country: report.country ?? undefined,
      status: 'PENDING',
    }).catch(() => {});
    await saveReportVersion(inspectionId, tier, { ...report, synthetic: true }, { tier, mode: 'offline', peer_id: null, synthetic: true });
    refreshPendings();
    setBusy(null);
    setWizard({ name: 'report', inspectionId });
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 + insets.bottom }}>
      <WizardHeader title={t.wizardStep2} onBack={() => setWizard({ name: 'chat', inspectionId })} />
      <Text style={s.sub}>{tier} · del chat · <Text onPress={() => setDetailsOpen(true)} style={{ textDecorationLine: 'underline' }}>detalles</Text></Text>
      {busy ? <View style={s.card}><ActivityIndicator color={th.green} /><Text style={s.sub}>{busy}</Text></View> : null}
      {report ? (
        <View style={s.card}>
          <Text style={s.h3}>{t.detectedEquipment}</Text>
          {report.items.length === 0 && <Text style={s.sub}>{t.noEntities}</Text>}
          {report.items.map((it, i) => (
            <View key={i} style={s.itemRow}>
              <Text style={s.item}>{it.modality} ×{it.qty} · {it.manufacturer ?? 'sin marca'} · {it.age_text ?? 'edad —'}</Text>
              <ConfidenceChip value={it.confidence} />
            </View>
          ))}
        </View>
      ) : null}
      {dup ? (
        <View style={s.warn}>
          <View style={s.warnRow}><Icon name="warn" size={16} color={th.amber} /><Text style={s.warnText}>Posible duplicado — coincide {dup.similarity.toFixed(2)} con “{dup.label}”.</Text></View>
          <View style={s.row}>
            <TouchableOpacity><Text style={s.warnLink}>Ver</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDup(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.warnLink}>Mantener ambos</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
      {followIdx < followups.length ? (
        <View style={s.q}>
          <Text style={s.qText}>Falta lo más valioso ({followIdx + 1}/{followups.length}): <Text style={{ fontWeight: '800' }}>{followups[followIdx]}</Text></Text>
          <View style={s.row}>
            <TextInput style={s.answer} placeholder="Ej. Fabricante X…" placeholderTextColor={th.muted} value={answer} onChangeText={setAnswer} />
            <TouchableOpacity style={s.skip} onPress={answerFollowup} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: th.text }}>OK</Text></TouchableOpacity>
            <TouchableOpacity style={s.skip} onPress={() => setFollowIdx((i) => i + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={{ color: th.muted }}>Saltar</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
      <TouchableOpacity style={s.cta} onPress={save} disabled={!report} accessibilityRole="button">
        <Text style={s.ctaText}>{t.saveReport}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.ghost} onPress={() => setWizard(null)} accessibilityRole="button">
        <Text style={s.ghostText}>{t.saveDraft}</Text>
      </TouchableOpacity>
      <Disclaimer />
    </ScrollView>
  );
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: t.text, fontSize: 22, fontWeight: '800' },
  sub: { color: t.muted, fontSize: 13 },
  card: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: t.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomColor: t.border, borderBottomWidth: 1 },
  item: { color: t.text, fontSize: 13, flex: 1 },
  warn: { backgroundColor: 'rgba(245,158,11,.10)', borderColor: 'rgba(245,158,11,.5)', borderWidth: 1, borderRadius: 14, padding: 14 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warnText: { color: t.amber, fontSize: 13, flex: 1 },
  warnLink: { color: t.amber, marginTop: 8 },
  q: { backgroundColor: 'rgba(34,197,94,.08)', borderColor: 'rgba(34,197,94,.45)', borderWidth: 1, borderRadius: 14, padding: 14 },
  qText: { color: t.text, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  answer: { flex: 1, backgroundColor: t.bg, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  skip: { borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 10 },
  cta: { backgroundColor: t.green, borderRadius: 14, minHeight: 54, justifyContent: 'center' },
  ctaText: { color: t.onAccent, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  ghost: { borderColor: t.border, borderWidth: 1, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  ghostText: { color: t.text, textAlign: 'center' },
});
