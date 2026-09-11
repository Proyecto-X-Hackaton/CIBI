// NetworkScreen — F07 (Mis sedes, lista offline primero) + F08 hero +
// NL por chips. Sin geocoding. Mapa online-only como link secundario.
// Agendar crea PlannedVisit funcional offline (F05/F08 P0).

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { C, Disclaimer } from '../components/atoms';
import { useApp } from '../state/AppState';
import { SEED_SITES } from '../db/seed';
import { planVisit } from '../db/database';

const NL_CHIPS = ['MR >7 años en Brasil', 'Sin visitar 60 días', 'Incompletos'] as const;

export default function NetworkScreen() {
  const { setWizard, setTab, refreshPendings } = useApp();
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<string>('MR >7 años en Brasil');
  const [scheduled, setScheduled] = useState(false);

  const sites = useMemo(() => {
    let list = [...SEED_SITES];
    if (q) list = list.filter((x) => `${x.name} ${x.city} ${x.country}`.toLowerCase().includes(q.toLowerCase()));
    if (chip === 'MR >7 años en Brasil') list = list.filter((x) => x.country === 'Brasil' && x.aging.includes('MR'));
    if (chip === 'Sin visitar 60 días') list = list.filter((x) => x.last_visit_days > 60);
    if (chip === 'Incompletos') list = list.filter((x) => x.incomplete);
    return list;
  }, [q, chip]);

  const schedule = async () => {
    const d = new Date(Date.now() + 86400000).toISOString();
    await planVisit({ site_id: 'Hospital Alpha', date_label: 'manana', date: d, reason: '2 MR 8–10 años → ofrecer renovación' });
    refreshPendings();
    setScheduled(true);
    Alert.alert('Agendada ✓', 'Mañana · aparece en Inicio → Esta semana. 100% offline.');
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      <Text style={s.h1}>Hoy en São Paulo</Text>
      <Text style={s.sub}>A dónde ir · qué decir · 100% offline</Text>
      <Text style={s.sect}>F08 · Próxima acción</Text>
      <View style={s.hero}>
        <Text style={s.heroText}>💡 <Text style={{ fontWeight: '800', color: '#FBBF24' }}>Mañana: Hospital Alpha</Text>{'\n'}2 MR de 8–10 años → ofrecer renovación a ingeniería clínica.{'\n'}<Text style={s.meta}>Hablaste con Ing. Ruiz hace 42 días · informe v1 · datos sintéticos</Text></Text>
        <View style={s.btnrow}>
          <TouchableOpacity style={[s.btn, s.primary]} onPress={() => setTab('home')}><Text style={s.btnP}>Ver informe</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.ghost]} onPress={schedule}><Text style={s.btnG}>{scheduled ? '📅 Agendada ✓ mañana' : '📅 Agendar'}</Text></TouchableOpacity>
        </View>
        <Text style={s.meta}>Agendar crea visita funcional offline → aparece en Inicio · Qué decir ›</Text>
      </View>
      <Text style={s.sect}>F07 · Mis sedes</Text>
      <View style={s.card}>
        <Text style={s.h3}>🔍 Buscar sede (lista offline)</Text>
        <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Ciudad, hospital…" placeholderTextColor="#6E6E78" />
        <Text style={s.group}>Brasil › São Paulo ({sites.length} sedes)</Text>
        {sites.map((x) => (
          <View key={x.site_id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.fac}>🏥 {x.name}</Text>
              <Text style={s.meta}>{x.aging || 'Sin alertas'} · {x.counts.MR} MR / {x.counts.CT} CT / {x.counts.US} US · hace {x.last_visit_days}d</Text>
            </View>
            <TouchableOpacity onPress={() => setTab('home')}><Text style={s.go}>›</Text></TouchableOpacity>
          </View>
        ))}
        {sites.length === 0 && <Text style={s.meta}>Sin resultados con ese filtro.</Text>}
      </View>
      <Text style={s.sect}>F08 · Pregunta a tu red</Text>
      <View style={s.card}>
        <Text style={s.h3}>🔎 Pregunta útil (en este teléfono)</Text>
        <View style={s.chips}>
          {NL_CHIPS.map((c) => (
            <TouchableOpacity key={c} style={[s.chip, chip === c && s.chipOn]} onPress={() => setChip(c)}>
              <Text style={[s.chipText, chip === c && { color: C.green }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {sites.slice(0, 3).map((x) => (
          <Text key={x.site_id} style={s.result}>🏥 <Text style={{ fontWeight: '800' }}>{x.name}</Text> — {x.aging || 'al día'} · informe v1 ›{'\n'}<Text style={s.meta}>Generado en este teléfono · sin conexión</Text></Text>
        ))}
      </View>
      <Disclaimer />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13 },
  sect: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7 },
  hero: { backgroundColor: 'rgba(245,158,11,.10)', borderColor: 'rgba(245,158,11,.5)', borderWidth: 1, borderRadius: 16, padding: 16 },
  heroText: { color: C.text, fontSize: 13, lineHeight: 20 },
  meta: { color: C.muted, fontSize: 12 },
  btnrow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  btn: { flex: 1, borderRadius: 10, padding: 11 },
  primary: { backgroundColor: C.green },
  ghost: { borderColor: 'rgba(34,197,94,.5)', borderWidth: 1 },
  btnP: { color: '#04120A', fontWeight: '700', textAlign: 'center' },
  btnG: { color: C.green, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  search: { backgroundColor: '#0B0B0F', color: '#fff', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  group: { color: C.text, fontWeight: '700', marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomColor: C.border, borderBottomWidth: 1 },
  fac: { color: C.text, fontWeight: '700' },
  go: { color: C.green, fontWeight: '700', fontSize: 18 },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderColor: '#3A3A45', borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11 },
  chipOn: { borderColor: 'rgba(34,197,94,.5)' },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  result: { color: C.text, fontSize: 13, paddingVertical: 8, borderTopColor: C.border, borderTopWidth: 1 },
});
