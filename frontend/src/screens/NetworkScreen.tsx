// NetworkScreen — F07 (Mis sedes, lista offline primero) + F08 hero +
// NL por chips. Sin geocoding. Mapa online-only como link secundario.
// Agendar crea PlannedVisit funcional offline (F05/F08 P0).
// Data source: SQLite inspections + observations. Seed only as empty-state demo.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { C, Disclaimer } from '../components/atoms';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { SEED_SITES } from '../db/seed';
import { planVisit, listInspections, getLatestObservation } from '../db/database';

const NL_CHIPS = ['MR >7 años en Brasil', 'Sin visitar 60 días', 'Incompletos'] as const;

interface SiteRow {
  site_id: string;
  name: string;
  city: string;
  country: string;
  counts: { MR: number; CT: number; US: number };
  aging: string;
  agingCount: number;
  last_visit_days: number;
  incomplete: boolean;
  synthetic: boolean;
}

export default function NetworkScreen() {
  const { setTab, refreshPendings } = useApp();
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<string>('MR >7 años en Brasil');
  const [scheduled, setScheduled] = useState(false);
  const [rows, setRows] = useState<SiteRow[]>([]);

  useEffect(() => {
    (async () => {
      const ins = await listInspections().catch(() => []);
      const built: SiteRow[] = [];
      for (const i of ins) {
        const obs = await getLatestObservation(i.client_uuid).catch(() => null) as any;
        let counts = { MR: 0, CT: 0, US: 0 };
        let agingCount = 0;
        let incomplete = false;
        try {
          const r = obs?.structured_json ? JSON.parse(obs.structured_json) : null;
          for (const it of r?.items ?? []) {
            if (it.modality === 'MR') counts.MR += it.qty ?? 1;
            if (it.modality === 'CT') counts.CT += it.qty ?? 1;
            if (it.modality === 'US') counts.US += it.qty ?? 1;
            if ((it.age_years ?? 0) > 7) agingCount += 1;
            if (!it.manufacturer || it.age_years == null) incomplete = true;
          }
        } catch {}
        const days = Math.max(0, Math.round((Date.now() - new Date(i.observed_at).getTime()) / 86400000));
        built.push({
          site_id: i.client_uuid,
          name: i.customer ?? 'Sin sede',
          city: i.city ?? '?',
          country: i.country ?? '?',
          counts,
          aging: agingCount > 0 ? `${agingCount} equipo(s) >7 años` : '',
          agingCount,
          last_visit_days: days,
          incomplete,
          synthetic: true,
        });
      }
      setRows(built);
    })();
  }, []);

  const sites = useMemo(() => {
    let list = [...rows];
    if (q) list = list.filter((x) => `${x.name} ${x.city} ${x.country}`.toLowerCase().includes(q.toLowerCase()));
    if (chip === 'MR >7 años en Brasil') list = list.filter((x) => x.agingCount > 0 && x.counts.MR > 0);
    if (chip === 'Sin visitar 60 días') list = list.filter((x) => x.last_visit_days > 60);
    if (chip === 'Incompletos') list = list.filter((x) => x.incomplete);
    return list;
  }, [q, chip, rows]);

  // Hero: top aging site from real data, never hardcoded.
  const hero = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.agingCount - a.agingCount);
    return sorted[0] ?? null;
  }, [rows]);
  const demoSites = rows.length === 0 ? SEED_SITES : [];

  const schedule = async () => {
    const target = hero?.name ?? rows[0]?.name ?? 'Sitio pendiente';
    const reason = hero && hero.agingCount > 0 ? `${hero.agingCount} equipo(s) >7 años → ofrecer renovación` : 'Visita de seguimiento';
    const d = new Date(Date.now() + 86400000).toISOString();
    await planVisit({ site_id: target, date_label: 'manana', date: d, reason });
    refreshPendings();
    setScheduled(true);
    Alert.alert('Agendada', 'Mañana · aparece en Inicio → Esta semana. 100% offline.');
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      <Text style={s.h1}>Hoy en São Paulo</Text>
      <Text style={s.sub}>A dónde ir · qué decir · 100% offline</Text>
      <Text style={s.sect}>F08 · Próxima acción</Text>
      {hero ? (
        <View style={s.hero}>
          <View style={s.heroRow}><Icon name="idea" size={16} color="#FBBF24" /><Text style={s.heroText}><Text style={{ fontWeight: '800', color: '#FBBF24' }}>Mañana: {hero.name}</Text>{'\n'}{hero.aging || 'Seguimiento'} → ofrecer renovación a ingeniería clínica.{'\n'}<Text style={s.meta}>{hero.city} · hace {hero.last_visit_days}d · datos sintéticos</Text></Text></View>
          <View style={s.btnrow}>
            <TouchableOpacity style={[s.btn, s.primary]} onPress={() => setTab('home')} accessibilityRole="button"><Text style={s.btnP}>Ver informe</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.ghost]} onPress={schedule} accessibilityRole="button"><Text style={s.btnG}>{scheduled ? 'Agendada · mañana' : 'Agendar'}</Text></TouchableOpacity>
          </View>
          <Text style={s.meta}>Agendar crea visita funcional offline → aparece en Inicio</Text>
        </View>
      ) : (
        <View style={s.hero}><Text style={s.heroText}>Sin datos aún — crea una inspección para generar la próxima acción.</Text></View>
      )}
      <Text style={s.sect}>F07 · Mis sedes</Text>
      <View style={s.card}>
        <View style={s.hRow}><Icon name="search" size={14} color={C.muted} /><Text style={s.h3}>Buscar sede (lista offline)</Text></View>
        <TextInput style={s.search} value={q} onChangeText={setQ} placeholder="Ciudad, hospital…" placeholderTextColor="#6E6E78" />
        <Text style={s.group}>Sedes ({sites.length})</Text>
        {sites.map((x) => (
          <View key={x.site_id} style={s.row}>
            <View style={{ flex: 1 }}>
              <View style={s.hRow}><Icon name="hospital" size={14} color={C.text} /><Text style={s.fac}>{x.name}</Text></View>
              <Text style={s.meta}>{x.aging || 'Sin alertas'} · {x.counts.MR} MR / {x.counts.CT} CT / {x.counts.US} US · hace {x.last_visit_days}d</Text>
            </View>
            <TouchableOpacity onPress={() => setTab('home')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Icon name="next" size={18} color={C.green} /></TouchableOpacity>
          </View>
        ))}
        {sites.length === 0 && rows.length > 0 && <Text style={s.meta}>Sin resultados con ese filtro.</Text>}
        {rows.length === 0 && (
          <View>
            <Text style={s.meta}>Demo sintético (vacío real — seed de ejemplo):</Text>
            {demoSites.slice(0, 3).map((x: any) => (
              <Text key={x.site_id} style={s.meta}>· {x.name} — {x.city} (sintético)</Text>
            ))}
          </View>
        )}
      </View>
      <Text style={s.sect}>F08 · Pregunta a tu red</Text>
      <View style={s.card}>
        <Text style={s.h3}>Pregunta útil (en este teléfono)</Text>
        <View style={s.chips}>
          {NL_CHIPS.map((c) => (
            <TouchableOpacity key={c} style={[s.chip, chip === c && s.chipOn]} onPress={() => setChip(c)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[s.chipText, chip === c && { color: C.green }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {sites.slice(0, 3).map((x) => (
          <Text key={x.site_id} style={s.result}><Text style={{ fontWeight: '800' }}>{x.name}</Text> — {x.aging || 'al día'} · informe v1{'\n'}<Text style={s.meta}>Generado en este teléfono · sin conexión</Text></Text>
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
  heroRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  heroText: { color: C.text, fontSize: 13, lineHeight: 20, flex: 1 },
  meta: { color: C.muted, fontSize: 12 },
  btnrow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  btn: { flex: 1, borderRadius: 10, padding: 11, minHeight: 44, justifyContent: 'center' },
  primary: { backgroundColor: C.green },
  ghost: { borderColor: 'rgba(34,197,94,.5)', borderWidth: 1 },
  btnP: { color: '#04120A', fontWeight: '700', textAlign: 'center' },
  btnG: { color: C.green, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  search: { backgroundColor: '#0B0B0F', color: '#fff', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  group: { color: C.text, fontWeight: '700', marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomColor: C.border, borderBottomWidth: 1 },
  fac: { color: C.text, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderColor: '#3A3A45', borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11, minHeight: 36, justifyContent: 'center' },
  chipOn: { borderColor: 'rgba(34,197,94,.5)' },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  result: { color: C.text, fontSize: 13, paddingVertical: 8, borderTopColor: C.border, borderTopWidth: 1 },
});
