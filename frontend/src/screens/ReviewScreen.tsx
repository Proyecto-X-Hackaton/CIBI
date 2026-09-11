// ReviewScreen — SCREEN_02 + F03/F04: MedPsy structures, ≤2 follow-ups,
// duplicate warning (never auto-merge), save → report v1.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { C, ConfidenceChip, Disclaimer } from '../components/atoms';
import { useApp } from '../state/AppState';
import { getMessages, getPhotos, saveObservation, updateInspection, saveReportVersion } from '../db/database';
import { structureEntities, type StructuredReport } from '../qvac/structure';
import { findDuplicates, keywordSimilarity } from '../qvac/dedupRag';
import { upgradeConfidence } from '../utils/confidence';

export default function ReviewScreen({ inspectionId }: { inspectionId: string }) {
  const { setWizard, setDetailsOpen, tier, refreshPendings } = useApp();
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
        const structured = await structureEntities({ text_en: enAll || 'two CTs', visionHint, ocrHint });
        setReport(structured);
        // Dedup: compare first item label against seeded previous labels.
        const firstLabel = structured.items[0] ? `${structured.items[0].modality} ${structured.items[0].manufacturer ?? ''}`.trim() : 'MR';
        const { candidates } = await findDuplicates({
          siteWorkspace: `site-${inspectionId.slice(0, 8)}`,
          newItemLabel: firstLabel,
          existingLabels: [{ id: 'MR-2-jun', label: 'MR Fabricante X placa junio' }],
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
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      <Text style={s.h1}>Revisar inspección</Text>
      <Text style={s.sub}>🟢 CIBI · del chat · <Text onPress={() => setDetailsOpen(true)} style={{ textDecorationLine: 'underline' }}>ⓘ detalles</Text></Text>
      {busy ? <View style={s.card}><ActivityIndicator color={C.green} /><Text style={s.sub}>{busy}</Text></View> : null}
      {report ? (
        <View style={s.card}>
          <Text style={s.h3}>Equipos detectados</Text>
          {report.items.length === 0 && <Text style={s.sub}>Sin entidades — añade evidencia en el chat.</Text>}
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
          <Text style={s.warnText}>⚠️ Posible duplicado — coincide {dup.similarity.toFixed(2)} con “{dup.label}”.</Text>
          <View style={s.row}>
            <TouchableOpacity><Text style={s.warnLink}>Ver</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDup(null)}><Text style={s.warnLink}>Mantener ambos</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
      {followIdx < followups.length ? (
        <View style={s.q}>
          <Text style={s.qText}>🤖 Falta lo más valioso ({followIdx + 1}/{followups.length}): <Text style={{ fontWeight: '800' }}>{followups[followIdx]}</Text></Text>
          <View style={s.row}>
            <TextInput style={s.answer} placeholder="Ej. Fabricante X…" placeholderTextColor="#6E6E78" value={answer} onChangeText={setAnswer} />
            <TouchableOpacity style={s.skip} onPress={answerFollowup}><Text style={{ color: '#fff' }}>OK</Text></TouchableOpacity>
            <TouchableOpacity style={s.skip} onPress={() => setFollowIdx((i) => i + 1)}><Text style={{ color: C.muted }}>Saltar</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
      <TouchableOpacity style={s.cta} onPress={save} disabled={!report}>
        <Text style={s.ctaText}>Guardar inspección → generar informe</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.ghost} onPress={() => setWizard(null)}>
        <Text style={s.ghostText}>Guardar borrador y salir a Inicio</Text>
      </TouchableOpacity>
      <Disclaimer />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomColor: C.border, borderBottomWidth: 1 },
  item: { color: C.text, fontSize: 13, flex: 1 },
  warn: { backgroundColor: 'rgba(245,158,11,.10)', borderColor: 'rgba(245,158,11,.5)', borderWidth: 1, borderRadius: 14, padding: 14 },
  warnText: { color: '#FBBF24', fontSize: 13 },
  warnLink: { color: '#FBBF24', marginTop: 8 },
  q: { backgroundColor: 'rgba(34,197,94,.08)', borderColor: 'rgba(34,197,94,.45)', borderWidth: 1, borderRadius: 14, padding: 14 },
  qText: { color: C.text, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  answer: { flex: 1, backgroundColor: '#0B0B0F', color: '#fff', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  skip: { borderColor: '#3A3A45', borderWidth: 1, borderRadius: 10, padding: 10 },
  cta: { backgroundColor: C.green, borderRadius: 14, minHeight: 54, justifyContent: 'center' },
  ctaText: { color: '#04120A', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  ghost: { borderColor: '#3A3A45', borderWidth: 1, borderRadius: 14, minHeight: 48, justifyContent: 'center' },
  ghostText: { color: '#fff', textAlign: 'center' },
});
