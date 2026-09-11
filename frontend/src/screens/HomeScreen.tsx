// HomeScreen — SCREEN_00_HOME: inspections + planned week + search/filter.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { C, Disclaimer } from '../components/atoms';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { useStrings } from '../i18n/useStrings';
import { listInspections, createInspection, listPlannedVisits, setPlannedStatus, getReportVersions, getLatestObservation, type Inspection } from '../db/database';

export default function HomeScreen() {
  const { setWizard, refreshPendings } = useApp();
  const t = useStrings();
  const [items, setItems] = useState<Inspection[]>([]);
  const [planned, setPlanned] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'Todas' | 'Borrador' | 'Sin informe' | 'Re-verificar'>('Todas');
  const [reportFlags, setReportFlags] = useState<Record<string, boolean>>({});
  const [reverifyFlags, setReverifyFlags] = useState<Record<string, boolean>>({});

  const reload = async () => {
    const list = await listInspections().catch(() => []);
    setItems(list);
    setPlanned(await listPlannedVisits().catch(() => []));
    // Real flags for filters: has report? needs re-verify (Unknown/Estimated)?
    const rf: Record<string, boolean> = {};
    const rv: Record<string, boolean> = {};
    for (const ins of list) {
      const versions = await getReportVersions(ins.client_uuid).catch(() => []);
      rf[ins.client_uuid] = versions.length > 0;
      const obs = await getLatestObservation(ins.client_uuid).catch(() => null) as any;
      try {
        const r = obs?.structured_json ? JSON.parse(obs.structured_json) : null;
        rv[ins.client_uuid] = (r?.items ?? []).some((it: any) => !it.manufacturer || it.age_years == null || it.confidence === 'Unknown' || it.confidence === 'Estimated');
      } catch { rv[ins.client_uuid] = false; }
    }
    setReportFlags(rf);
    setReverifyFlags(rv);
    refreshPendings();
  };
  useEffect(() => { reload(); }, []);

  const startNew = async () => {
    const ins = await createInspection({});
    refreshPendings();
    setWizard({ name: 'chat', inspectionId: ins.client_uuid });
  };

  const startFromPlanned = async (p: any) => {
    const ins = await createInspection({ customer: p.site_id, planned_uuid: p.planned_uuid });
    refreshPendings();
    setWizard({ name: 'chat', inspectionId: ins.client_uuid });
  };

  const shown = items.filter((i) => {
    if (q && !`${i.customer ?? ''} ${i.city ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'Borrador') return i.status === 'BORRADOR';
    if (filter === 'Sin informe') return !reportFlags[i.client_uuid];
    if (filter === 'Re-verificar') return !!reverifyFlags[i.client_uuid];
    return true;
  });

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <Text style={s.h1}>{t.inspections}</Text>
      <Text style={s.sub}>{t.inspectionsSub}</Text>
      <TouchableOpacity style={s.newbtn} onPress={startNew} accessibilityRole="button">
        <Text style={s.newbtnText}>{t.newInspection}</Text>
      </TouchableOpacity>
      {planned.slice(0, 3).map((p) => (
        <View key={p.planned_uuid} style={[s.card, { borderColor: 'rgba(34,197,94,.5)' }]}>
          <View style={s.iconRow}><Icon name="calendar" size={16} color={C.green} /><Text style={s.fac}>Esta semana · {p.date_label === 'manana' ? 'mañana' : p.date_label}</Text></View>
          <Text style={s.city}>{p.site_id} · {p.reason}</Text>
          <View style={s.row}>
            <TouchableOpacity onPress={() => startFromPlanned(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.link}>{t.continueChat.replace('Continuar', 'Iniciar').replace('Continue', 'Start')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setPlannedStatus(p.planned_uuid, 'cancelled').then(reload)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.linkSec}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      <TextInput style={s.search} placeholder={t.searchPlaceholder} placeholderTextColor="#6E6E78" value={q} onChangeText={setQ} />
      <View style={s.filters}>
        {(['Todas', 'Borrador', 'Sin informe', 'Re-verificar'] as const).map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.fchip, filter === f && s.fchipOn]}>
            <Text style={[s.fchipText, filter === f && { color: C.green }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {shown.map((i) => (
        <View key={i.client_uuid} style={s.card}>
          <View style={s.row1}>
            <View style={{ flex: 1 }}>
              <View style={s.iconRow}><Icon name="hospital" size={15} color={C.text} /><Text style={s.fac}>{i.customer ?? 'Sin sede (borrador)'}</Text></View>
              <Text style={s.city}>Inspección · {i.city ?? '?'} · {new Date(i.observed_at).toLocaleDateString()} · {i.author}</Text>
            </View>
            <Text style={s.status}>{i.status}</Text>
          </View>
          <View style={s.row}>
            <TouchableOpacity onPress={() => setWizard({ name: 'chat', inspectionId: i.client_uuid })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.link}>{t.continueChat}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setWizard({ name: 'report', inspectionId: i.client_uuid })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.linkSec}>{t.viewReport} →</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      {shown.length === 0 && <Text style={s.sub}>{t.emptyInspections}</Text>}
      <Disclaimer />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13 },
  newbtn: { backgroundColor: C.green, borderRadius: 14, minHeight: 54, justifyContent: 'center' },
  newbtnText: { color: '#04120A', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 14 },
  fac: { color: C.text, fontWeight: '800', fontSize: 15 },
  city: { color: C.muted, fontSize: 12, marginTop: 2 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { color: '#93BBFD', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  link: { color: C.green, fontWeight: '600' },
  linkSec: { color: '#93BBFD' },
  search: { backgroundColor: '#0B0B0F', color: '#fff', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  fchip: { backgroundColor: '#23232D', borderColor: '#34343F', borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  fchipOn: { borderColor: C.green },
  fchipText: { color: '#D6D6DE', fontSize: 12, fontWeight: '600' },
});
