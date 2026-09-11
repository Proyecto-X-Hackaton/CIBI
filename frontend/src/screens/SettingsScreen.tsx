// SettingsScreen — SCREEN_05: tiers + UI lang + backend host + perf.
// Peers 🔵/🟣 locked P1 (muestran qué falta). Sync manual = push outbox.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { C, Disclaimer } from '../components/atoms';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { useStrings } from '../i18n/useStrings';
import { TIER_ROSTER } from '../qvac/TIER_ROSTER';
import { recentSpans, readPerfFile } from '../qvac/perf';
import { pushOutbox, checkHealth } from '../api/backend';

export default function SettingsScreen() {
  const { tier, setTier, uiLang, setUiLang, backendBase, setBackendBase, setDetailsOpen, refreshPendings } = useApp();
  const t = useStrings();
  const [host, setHost] = useState(backendBase);
  const [syncing, setSyncing] = useState(false);
  const [perfDump, setPerfDump] = useState<string | null>(null);
  const spans = recentSpans(6);

  const sync = async () => {
    setSyncing(true);
    try {
      const ok = await checkHealth(host);
      if (!ok) {
        Alert.alert('Sin servidor', 'Sigo offline — todo queda en outbox PENDING. La demo no se bloquea.');
        return;
      }
      const { pushed } = await pushOutbox(host);
      refreshPendings();
      Alert.alert('Sync', `${pushed} registro(s) subidos (idempotente por client_uuid).`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
      <Text style={s.h1}>{t.settings}</Text>
      <Text style={s.sub}>Asistente, idioma, servidor y privacidad</Text>
      <View style={s.card}>
        <Text style={s.h3}>{t.assistant}</Text>
        {TIER_ROSTER.map((tt) => (
          <View key={tt.id} style={[s.tier, tier === tt.id && s.tierOn]}>
            <View style={s.row}>
              <Text style={s.tierText}>{tt.label}{tt.id !== 'CIBI' ? ' · locked' : ''}{'\n'}<Text style={s.sub}>{tt.tagline}</Text></Text>
              <TouchableOpacity
                style={[s.use, tier === tt.id && s.using]}
                onPress={() => (tt.id === 'CIBI' ? setTier(tt.id) : Alert.alert('Bloqueado (P1)', 'Necesita peer QVAC verificado en LAN con ese equipo cargado.'))}
              >
                <Text style={s.useText}>{tier === tt.id ? 'En uso' : 'Usar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setDetailsOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={[s.sub, { textDecorationLine: 'underline' }]}>Detalles de modelos (jurado + debug)</Text></TouchableOpacity>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>{t.language}</Text>
        <View style={s.seg}>
          <TouchableOpacity style={[s.segBtn, uiLang === 'es' && s.segOn]} onPress={() => setUiLang('es')} accessibilityRole="button"><Text style={uiLang === 'es' ? s.segOnT : s.segT}>Español</Text></TouchableOpacity>
          <TouchableOpacity style={[s.segBtn, uiLang === 'en' && s.segOn]} onPress={() => setUiLang('en')} accessibilityRole="button"><Text style={uiLang === 'en' ? s.segOnT : s.segT}>English</Text></TouchableOpacity>
        </View>
        <Text style={s.sub}>{t.languageNote}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>{t.serverTitle}</Text>
        <TextInput style={s.txt} value={host} onChangeText={setHost} placeholder="http://IP-LAN:8000" placeholderTextColor="#6E6E78" autoCapitalize="none" />
        <View style={{ height: 8 }} />
        <TouchableOpacity style={s.btn} onPress={() => { setBackendBase(host); sync(); }} disabled={syncing} accessibilityRole="button">
          {syncing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t.saveSync}</Text>}
        </TouchableOpacity>
        <Text style={s.sub}>En Android Studio con emulator usa 10.0.2.2; en teléfono físico usa la IP LAN del host DRF.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Peers QVAC en LAN (P1 — desbloquean Pro/Super)</Text>
        <Text style={s.sub}>Sin peer verificado siguen bloqueados. Peer = proceso QVAC aparte, NO el backend Django. Foto/audio crudos se quedan en el teléfono salvo permiso explícito.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>{t.perfTitle}</Text>
        {spans.length === 0 ? <Text style={s.sub}>{t.noSpans}</Text> : spans.map((p, i) => (
          <Text key={i} style={s.sub}>{p.phase} · {p.model} · load {p.load_ms ?? '-'}ms · TTFT {p.ttft_ms ?? '-'}ms</Text>
        ))}
        <TouchableOpacity style={[s.btn, s.ghost]} onPress={async () => setPerfDump(await readPerfFile())}>
          <Text style={[s.btnText, { color: '#fff' }]}>{t.viewPerf}</Text>
        </TouchableOpacity>
        {perfDump != null ? <Text style={[s.sub, { marginTop: 8 }]} numberOfLines={12}>{perfDump.slice(-1500) || '(vacío)'}</Text> : null}
      </View>
      <Disclaimer />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: C.surface, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  tier: { borderColor: '#34343F', borderWidth: 1, backgroundColor: '#0B0B0F', borderRadius: 12, padding: 12, marginBottom: 8 },
  tierOn: { borderColor: C.green },
  tierText: { color: C.text, fontSize: 13, flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  use: { backgroundColor: '#23232D', borderColor: '#34343F', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  using: { backgroundColor: C.green },
  useText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  seg: { flexDirection: 'row', backgroundColor: '#0B0B0F', borderColor: '#34343F', borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, borderRadius: 9, padding: 10 },
  segOn: { backgroundColor: C.green },
  segT: { color: C.muted, textAlign: 'center', fontWeight: '700' },
  segOnT: { color: '#04120A', textAlign: 'center', fontWeight: '700' },
  txt: { backgroundColor: '#0B0B0F', color: '#fff', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  btn: { backgroundColor: C.blue, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  ghost: { backgroundColor: '#23232D', borderColor: '#34343F', borderWidth: 1, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
