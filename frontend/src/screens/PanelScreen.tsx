// PanelScreen — SCREEN_06: agregados offline, cero inferencia.
// Fuente: SQLite local (+ agregados DRF cuando hay red). Solo 2 números que
// empujan acción + barras por modalidad + confianza.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Disclaimer } from '../components/atoms';
import { useTheme } from '../../theme/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeTokens } from '../../theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { listInspections, pendingCount } from '../db/database';
import { getLatestObservation } from '../db/database';

export default function PanelScreen() {
  const { setTab, pendings } = useApp();
  const { theme: th } = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [totals, setTotals] = useState({ MR: 0, CT: 0, US: 0, sites: 0, aging: 0, incomplete: 0, synced: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ins = await listInspections();
        let MR = 0, CT = 0, US = 0, aging = 0, incomplete = 0;
        for (const i of ins) {
          const obs = (await getLatestObservation(i.client_uuid).catch(() => null)) as any;
          if (!obs?.structured_json) continue;
          const r = JSON.parse(obs.structured_json);
          for (const it of r.items ?? []) {
            if (it.modality === 'MR') MR += it.qty ?? 1;
            if (it.modality === 'CT') CT += it.qty ?? 1;
            if (it.modality === 'US') US += it.qty ?? 1;
            if ((it.age_years ?? 0) > 7) aging += 1;
            if (!it.manufacturer || it.age_years == null) incomplete += 1;
          }
        }
        const pending = await pendingCount().catch(() => 0);
        setTotals({ MR, CT, US, sites: ins.length, aging, incomplete, synced: Math.max(0, ins.length - pending) });
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const total = Math.max(1, totals.MR + totals.CT + totals.US);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 + insets.bottom }}>
      <Text style={s.h1}>Panel</Text>
      <Text style={s.sub}>Cómo está mi red · agregados offline · datos sintéticos</Text>
      {loading ? <Text style={s.sub}>Cargando agregados locales…</Text> : null}
      {!loading && totals.sites === 0 ? <Text style={s.sub}>Sin datos — crea una inspección para ver el parque.</Text> : null}
      <View style={s.kpis}>
        <View style={s.kpi}><Text style={s.n}>{totals.sites}</Text><View style={s.kpiLabel}><Icon name="hospital" size={12} color={th.muted} /><Text style={s.l}>sedes visitadas</Text></View></View>
        <View style={s.kpi}><Text style={s.n}>{total}</Text><Text style={s.l}>equipos (MR/CT/US)</Text></View>
        <View style={s.kpi}><Text style={[s.n, { color: th.amber }]}>{totals.aging}</Text><Text style={s.l}>equipos &gt;7 años</Text></View>
        <View style={s.kpi}><Text style={[s.n, { color: th.green }]}>{totals.synced} / {pendings}</Text><Text style={s.l}>SYNCED / PENDING</Text></View>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Parque por tipo (informes vX)</Text>
        <Bar label="MR" v={totals.MR} total={total} color={th.green} />
        <Bar label="CT" v={totals.CT} total={total} color={th.blue} />
        <Bar label="Ultrasonido" v={totals.US} total={total} color={th.purple} />
        <Text style={s.sub}>Fuente: SQLite local + agregados DRF · cero inferencia · se actualiza sin conexión.</Text>
      </View>
      <View style={s.alert}>
        <View style={s.alertRow}><Icon name="idea" size={16} color={th.amber} /><Text style={{ color: th.amber }}><Text style={{ fontWeight: '800' }}>Oportunidad:</Text> {totals.aging} equipos de 8–10 años → ofrecer renovación a ingeniería clínica.</Text></View>
      </View>
      <View style={s.btnrow}>
        <TouchableOpacity style={[s.btn, s.primary]} onPress={() => setTab('network')}><Text style={s.btnP}>Ver sedes</Text></TouchableOpacity>
      </View>
      <Disclaimer />
    </ScrollView>
  );
}

function Bar({ label, v, total, color }: { label: string; v: number; total: number; color: string }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.barRow}>
      <Text style={s.lbl}>{label}</Text>
      <View style={s.bar}><View style={{ width: `${Math.round((100 * v) / total)}%`, backgroundColor: color, height: '100%' }} /></View>
      <Text style={s.v}>{v}</Text>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: t.text, fontSize: 22, fontWeight: '800' },
  sub: { color: t.muted, fontSize: 13 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 12, width: '48%' },
  n: { color: t.text, fontSize: 22, fontWeight: '800' },
  l: { color: t.muted, fontSize: 11, marginTop: 2 },
  kpiLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: t.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  lbl: { color: t.text, width: 100, fontSize: 13 },
  bar: { flex: 1, height: 10, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  v: { color: t.text, width: 36, textAlign: 'right', fontWeight: '700' },
  alert: { backgroundColor: 'rgba(245,158,11,.10)', borderColor: 'rgba(245,158,11,.5)', borderWidth: 1, borderRadius: 12, padding: 12 },
  alertRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  btnrow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, borderRadius: 12, padding: 13 },
  primary: { backgroundColor: t.green },
  btnP: { color: t.onAccent, fontWeight: '800', textAlign: 'center' },
});
