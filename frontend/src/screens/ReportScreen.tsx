// ReportScreen — SCREEN_03 + F06: versioned report + offline PDF + share.
// Render from local SQLite (works in airplane mode). Re-generate creates
// v+1 with chosen tier (P0: 🟢 only; 🔵/🟣 locked P1). PDF via expo-print
// local HTML template → expo-sharing sheet. Zero inference on export.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { C, Disclaimer } from '../components/atoms';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { useStrings } from '../i18n/useStrings';
import { getReportVersions, getInspection, saveReportVersion } from '../db/database';
import { TIER_ROSTER } from '../qvac/TIER_ROSTER';

export default function ReportScreen({ inspectionId }: { inspectionId: string }) {
  const { setWizard, setDetailsOpen, tier, setTier } = useApp();
  const t = useStrings();
  const [versions, setVersions] = useState<any[]>([]);
  const [customer, setCustomer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setVersions(await getReportVersions(inspectionId));
    const ins = await getInspection(inspectionId);
    if (ins?.customer) setCustomer(ins.customer);
  };
  useEffect(() => { reload(); }, [inspectionId]);

  const latest = versions[versions.length - 1];
  const latestJson = latest ? JSON.parse(latest.json) : null;

  const regen = async () => {
    if (tier !== 'CIBI') {
      Alert.alert('Peer bloqueado (P1)', 'Pro/Super necesitan un peer QVAC verificado. El informe CIBI del teléfono es el flujo juzgado.');
      return;
    }
    setBusy(true);
    await saveReportVersion(inspectionId, tier, { ...(latestJson ?? {}), regenerated: true, synthetic: true }, { tier, mode: 'offline', peer_id: null, synthetic: true });
    await reload();
    setBusy(false);
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const items = (latestJson?.items ?? []).map((it: any) => `<tr><td><b>${it.modality ?? ''}</b></td><td>${it.qty ?? ''}</td><td>${it.age_text ?? it.age ?? ''}</td><td>${it.confidence ?? it.conf ?? ''}</td></tr>`).join('');
      const html = `<html><body style="font-family:sans-serif">
        <h1>Informe · ${customer}</h1>
        <p>Reporte v${latest?.version ?? 1} · ${tier} · sintético</p>
        <p><b>Extracción de inventario de equipamiento. No es diagnóstico clínico.</b></p>
        <table border="1" cellpadding="6"><tr><th>Tipo</th><th>Cant.</th><th>Edad</th><th>Conf.</th></tr>${items}</table>
        <p>Procedencia: tier ${latest?.tier ?? 'CIBI'} · offline · synthetic:true</p>
        <p>Historial: ${versions.length} versione(s)</p>
      </body></html>`;
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
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      <Text style={s.back}>‹ Inspecciones · <Text style={{ color: '#fff' }}>{customer ?? 'Sin sede'}</Text> · {t.synthetic}</Text>
      <Text style={s.h1}>{t.report} · {customer ?? '—'}</Text>
      <Text style={s.sub}>Reporte v{latest?.version ?? '—'} · {tier} · inspección editable siempre</Text>
      <View style={s.card}>
        <Text style={s.h3}>Generar con</Text>
        <View style={s.tierbar}>
          {TIER_ROSTER.map((tt) => (
            <TouchableOpacity key={tt.id} style={[s.tier, tier === tt.id && s.tierOn]} onPress={() => (tt.id === 'CIBI' ? setTier(tt.id) : Alert.alert('Bloqueado', `${tt.label} necesita peer QVAC verificado (P1).`))}>
              <Text style={s.tierText}>{tt.label}{tt.id !== 'CIBI' ? ' · locked' : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.sub}>Preselección {tier} · <Text onPress={() => setDetailsOpen(true)} style={{ textDecorationLine: 'underline' }}>detalles</Text></Text>
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
          <View key={v.id} style={s.histRow}><Icon name="report" size={14} color={C.muted} /><Text style={s.sub}>Informe v{v.version} · {v.tier} · {new Date(v.created_at).toLocaleDateString()}</Text></View>
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
      {busy ? <ActivityIndicator color={C.green} /> : null}
      <Disclaimer />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  back: { color: C.muted, fontSize: 13 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  tierbar: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tier: { flex: 1, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#34343F', backgroundColor: '#1A1A24' },
  tierOn: { borderColor: C.green, backgroundColor: 'rgba(34,197,94,.12)' },
  tierText: { color: '#D6D6DE', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomColor: C.border, borderBottomWidth: 1 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  cell: { color: C.text, fontSize: 13, flex: 1 },
  cta2: { backgroundColor: C.green, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  ctaText: { color: '#04120A', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  secondary: { backgroundColor: C.blue, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  secText: { color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  ghost: { borderColor: '#3A3A45', borderWidth: 1, borderRadius: 14, minHeight: 52, justifyContent: 'center' },
  ghostText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
