// HomeScreen — SCREEN_00_HOME: inspections + planned week + search/filter.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { C, Disclaimer } from '../components/atoms';
import { useApp } from '../state/AppState';
import { listInspections, createInspection, listPlannedVisits, setPlannedStatus, type Inspection } from '../db/database';

export default function HomeScreen() {
  const { setWizard, refreshPendings } = useApp();
  const [items, setItems] = useState<Inspection[]>([]);
  const [planned, setPlanned] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'Todas' | 'Borrador' | 'Sin informe' | 'Re-verificar'>('Todas');

  const reload = async () => {
    setItems(await listInspections().catch(() => []));
    setPlanned(await listPlannedVisits().catch(() => []));
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
    return true;
  });

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      <Text style={s.h1}>Inspecciones</Text>
      <Text style={s.sub}>Inspección = captura editable · Informe = reporte generado (siempre re-generable)</Text>
      <TouchableOpacity style={s.newbtn} onPress={startNew}>
        <Text style={s.newbtnText}>+ Nueva inspección con IA</Text>
      </TouchableOpacity>
      {planned.slice(0, 3).map((p) => (
        <View key={p.planned_uuid} style={[s.card, { borderColor: 'rgba(34,197,94,.5)' }]}>
          <Text style={s.fac}>📅 Esta semana · {p.date_label === 'manana' ? 'mañana' : p.date_label}</Text>
          <Text style={s.city}>{p.site_id} · {p.reason}</Text>
          <View style={s.row}>
            <TouchableOpacity onPress={() => startFromPlanned(p)}><Text style={s.link}>▶ Iniciar inspección</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setPlannedStatus(p.planned_uuid, 'cancelled').then(reload)}><Text style={s.linkSec}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      <TextInput style={s.search} placeholder="Buscar hospital, ciudad…  ej. Alpha" placeholderTextColor="#6E6E78" value={q} onChangeText={setQ} />
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
            <View>
              <Text style={s.fac}>{i.customer ?? 'Sin sede (borrador)'}</Text>
              <Text style={s.city}>Inspección · {i.city ?? '?'} · {new Date(i.observed_at).toLocaleDateString()} · {i.author}</Text>
            </View>
            <Text style={s.status}>{i.status}</Text>
          </View>
          <View style={s.row}>
            <TouchableOpacity onPress={() => setWizard({ name: 'chat', inspectionId: i.client_uuid })}><Text style={s.link}>▶ Continuar chat</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setWizard({ name: 'report', inspectionId: i.client_uuid })}><Text style={s.linkSec}>Ver informe →</Text></TouchableOpacity>
          </View>
        </View>
      ))}
      {shown.length === 0 && <Text style={s.sub}>Sin inspecciones. Crea la primera con IA (funciona en avión).</Text>}
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
