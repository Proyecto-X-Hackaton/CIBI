// SettingsScreen — SCREEN_05: tiers + UI lang + backend host + perf.
// Peers 🔵/🟣 locked P1 (muestran qué falta). Sync manual = push outbox.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Disclaimer } from '../components/atoms';
import { useTheme, type ThemeMode } from '../../theme/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { ON_DARK, type ThemeTokens } from '../../theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useApp } from '../state/AppState';
import { useStrings } from '../i18n/useStrings';
import { TIER_ROSTER } from '../qvac/TIER_ROSTER';
import { recentSpans, readPerfFile } from '../qvac/perf';
import { pushOutbox, checkHealth } from '../api/backend';
import { downloadAsset, heartbeat, BERGAMOT_ES_EN, BERGAMOT_PT_EN, VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, OCR_LATIN, PARAKEET_TDT_0_6B_V3_Q8_0, HEALTHCARE_1_7B_MEDICAL_Q4_K_M } from '@qvac/sdk';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';

export default function SettingsScreen() {
  const { tier, setTier, uiLang, setUiLang, backendBase, setBackendBase, setDetailsOpen, refreshPendings } = useApp();
  const t = useStrings();
  const { theme: th, mode, setMode } = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState(backendBase);
  const [syncing, setSyncing] = useState(false);
  const [perfDump, setPerfDump] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);
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
    <ScrollView style={s.wrap} contentContainerStyle={{ gap: 14, paddingBottom: 24 + insets.bottom }}>
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
                <Text style={[s.useText, tier === tt.id && s.usingText]}>{tier === tt.id ? 'En uso' : 'Usar'}</Text>
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
        <Text style={s.h3}>Apariencia</Text>
        <View style={s.seg}>
          {([['dark', '🌙 Oscuro'], ['light', '☀️ Claro'], ['system', '📱 Sistema']] as Array<[ThemeMode, string]>).map(([m, label]) => (
            <TouchableOpacity key={m} style={[s.segBtn, mode === m && s.segOn]} onPress={() => setMode(m)} accessibilityRole="button">
              <Text style={mode === m ? s.segOnT : s.segT}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>{t.serverTitle}</Text>
        <TextInput style={s.txt} value={host} onChangeText={setHost} placeholder="http://IP-LAN:8000" placeholderTextColor={th.muted} autoCapitalize="none" />
        <View style={{ height: 8 }} />
        <TouchableOpacity style={s.btn} onPress={() => { setBackendBase(host); sync(); }} disabled={syncing} accessibilityRole="button">
          {syncing ? <ActivityIndicator color={ON_DARK} /> : <Text style={s.btnText}>{t.saveSync}</Text>}
        </TouchableOpacity>
        <Text style={s.sub}>En Android Studio con emulator usa 10.0.2.2; en teléfono físico usa la IP LAN del host DRF.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Peers QVAC en LAN (P1 — desbloquean Pro/Super)</Text>
        <Text style={s.sub}>Sin peer verificado siguen bloqueados. Peer = proceso QVAC aparte, NO el backend Django. Foto/audio crudos se quedan en el teléfono salvo permiso explícito.</Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Modelos on-device (primera vez con WiFi)</Text>
        <Text style={s.sub}>La primera carga descarga ~2.7GB (MedPsy 1.28GB + Visión 546MB + voz 750MB + traductores). Hazlo una vez con WiFi; después todo funciona en avión.</Text>
        <TouchableOpacity
          style={[s.btn, { marginTop: 8 }]}
          disabled={dlBusy}
          onPress={async () => {
            setDlBusy(true);
            // 0. Runtime diagnostics first (instant-fail usually lives here).
            try {
              const free = await (FileSystem as any).getFreeDiskStorageAsync?.().catch(() => null);
              const freeGb = typeof free === 'number' ? `${(free / 1e9).toFixed(1)}GB libres` : 'espacio desconocido';
              await heartbeat().catch((e: any) => { throw new Error(`worker: ${e?.message ?? e}`); });
              setDlMsg(`Motor QVAC OK · ${freeGb}. Descargando…`);
            } catch (e: any) {
              setDlMsg(`Diagnóstico: ${String(e?.message ?? e).slice(0, 300)}`);
              setDlBusy(false);
              return;
            }
            const list: Array<[string, any]> = [
              ['Traductor ES', BERGAMOT_ES_EN],
              ['Traductor PT', BERGAMOT_PT_EN],
              ['Visión', VISIONPSY_NANO_460M_MULTIMODAL_Q8_0],
              ['Proyección visión', MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0],
              ['OCR', OCR_LATIN],
              ['Voz', PARAKEET_TDT_0_6B_V3_Q8_0],
              ['MedPsy', HEALTHCARE_1_7B_MEDICAL_Q4_K_M],
            ];
            const failed: string[] = [];
            for (const [label, src] of list) {
              try {
                setDlMsg(`${label}… 0%`);
                await downloadAsset({ assetSrc: src, onProgress: (p: any) => setDlMsg(`${label}… ${Math.round(p?.percentage ?? 0)}%`) });
              } catch (e: any) {
                failed.push(`${label} (${String(e?.message ?? e).slice(0, 160)})`);
                break;
              }
            }
            setDlMsg(failed.length === 0 ? 'Listo: modelos en el teléfono.' : `Falló: ${failed.join(', ')} — reintenta con WiFi.`);
            setDlBusy(false);
          }}
          accessibilityRole="button"
        >
          {dlBusy ? <ActivityIndicator color={ON_DARK} /> : <Text style={s.btnText}>Descargar modelos</Text>}
        </TouchableOpacity>
        {dlMsg ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            <Text style={s.sub} selectable>{dlMsg}</Text>
            <TouchableOpacity
              style={[s.btn, s.ghost, { marginTop: 0, minHeight: 44 }]}
              onPress={async () => {
                await Clipboard.setStringAsync(dlMsg);
                Alert.alert('Copiado', 'Error copiado al portapapeles.');
              }}
              accessibilityRole="button"
            >
              <Text style={[s.btnText, { color: th.text }]}>Copiar error</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <View style={s.card}>
        <Text style={s.h3}>{t.perfTitle}</Text>
        {spans.length === 0 ? <Text style={s.sub}>{t.noSpans}</Text> : spans.map((p, i) => (
          <Text key={i} style={s.sub}>{p.phase} · {p.model} · load {p.load_ms ?? '-'}ms · TTFT {p.ttft_ms ?? '-'}ms</Text>
        ))}
        <TouchableOpacity style={[s.btn, s.ghost]} onPress={async () => setPerfDump(await readPerfFile())}>
          <Text style={[s.btnText, { color: th.text }]}>{t.viewPerf}</Text>
        </TouchableOpacity>
        {perfDump != null ? <Text style={[s.sub, { marginTop: 8 }]} numberOfLines={12}>{perfDump.slice(-1500) || '(vacío)'}</Text> : null}
      </View>
      <Disclaimer />
    </ScrollView>
  );
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  h1: { color: t.text, fontSize: 22, fontWeight: '800' },
  sub: { color: t.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h3: { color: t.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },
  tier: { borderColor: t.border, borderWidth: 1, backgroundColor: t.bg, borderRadius: 12, padding: 12, marginBottom: 8 },
  tierOn: { borderColor: t.green },
  tierText: { color: t.text, fontSize: 13, flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  use: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  using: { backgroundColor: t.green },
  useText: { color: t.text, fontWeight: '800', fontSize: 12 },
  usingText: { color: t.onAccent },
  seg: { flexDirection: 'row', backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, borderRadius: 9, padding: 10 },
  segOn: { backgroundColor: t.green },
  segT: { color: t.muted, textAlign: 'center', fontWeight: '700' },
  segOnT: { color: t.onAccent, textAlign: 'center', fontWeight: '700' },
  txt: { backgroundColor: t.bg, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  btn: { backgroundColor: t.blue, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  ghost: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, marginTop: 8 },
  btnText: { color: ON_DARK, fontWeight: '700', textAlign: 'center' },
});
