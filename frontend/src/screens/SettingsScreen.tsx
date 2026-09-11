// SettingsScreen — SCREEN_05: tiers + UI lang + backend/peer hosts + perf.
// Pro/Super are selectable only when the configured LAN QVAC peer publishes the required models.

import React, { useEffect, useState } from 'react';
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
import { pushOutbox, checkHealth, type HealthReason } from '../api/backend';
import { downloadAsset, heartbeat, BERGAMOT_ES_EN, BERGAMOT_PT_EN, VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, OCR_LATIN, PARAKEET_TDT_0_6B_V3_Q8_0, HEALTHCARE_1_7B_MEDICAL_Q4_K_M } from '@qvac/sdk';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { fetchModelStatuses, testChat, fmtBytes, type ModelStatus } from '../qvac/modelStatus';
import type { Strings } from '../i18n/strings';
import type { PeerHealthReason } from '../qvac/peerClient';

// task-07: never a generic "Sin servidor" — map the health reason to a
// specific, actionable sentence (i18n ES/EN).
function reasonText(reason: HealthReason, t: Strings): string {
  switch (reason) {
    case 'ok': return t.srvOk;
    case 'timeout': return t.srvTimeout;
    case 'unreachable': return t.srvUnreachable;
    case 'bad_body': return t.srvBadBody;
    case 'http_400': return t.srvHttp400;
    case 'http_404': return t.srvHttp404;
    default: return t.srvHttpOther.replace('{code}', reason.replace('http_', ''));
  }
}

function peerReasonText(reason: PeerHealthReason, t: Strings): string {
  switch (reason) {
    case 'ok': return t.peerOk;
    case 'timeout': return t.peerTimeout;
    case 'unreachable': return t.peerUnreachable;
    case 'http_401': return t.peerHttp401;
    case 'http_404': return t.peerHttp404;
    case 'bad_body': return t.peerBadBody;
    default: return t.peerHttpOther.replace('{code}', '4xx/5xx');
  }
}

export default function SettingsScreen() {
  const { tier, selectTier, uiLang, setUiLang, backendBase, setBackendBase, peerBase, setPeerBase, peerStatus, refreshPeer, setDetailsOpen, refreshPendings } = useApp();
  const t = useStrings();
  const { theme: th, mode, setMode } = useTheme();
  const s = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState(backendBase);
  const [peerHost, setPeerHost] = useState(peerBase);
  const [syncing, setSyncing] = useState(false);
  const [peerBusy, setPeerBusy] = useState(false);
  const [tierBusy, setTierBusy] = useState(false);
  const [healthMsg, setHealthMsg] = useState<string | null>(null);
  const [perfDump, setPerfDump] = useState<string | null>(null);
  const [dlBusy, setDlBusy] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<ModelStatus[]>([]);
  const [stBusy, setStBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const spans = recentSpans(6);

  useEffect(() => {
    setPeerHost(peerBase);
  }, [peerBase]);

  const savePeer = async () => {
    setPeerBusy(true);
    const base = peerHost.trim().replace(/\/+$/, '');
    setPeerBase(base);
    const status = await refreshPeer(base);
    setPeerBusy(false);
    if (!status.ok) {
      setHealthMsg(null);
      Alert.alert(t.peerUnavailable, `${peerReasonText(status.reason, t)}\n\n${status.url}`);
    }
  };

  const chooseTier = async (next: typeof tier) => {
    if (next === tier || tierBusy) return;
    setTierBusy(true);
    const ok = await selectTier(next);
    setTierBusy(false);
    if (!ok) Alert.alert(t.peerUnavailable, `${peerStatus ? peerReasonText(peerStatus.reason, t) : t.peerUnreachable}\n\n${peerBase}`);
  };

  const sync = async () => {
    setSyncing(true);
    try {
      // Diagnostics first (task-07): reason + attempted URL, never a bare boolean.
      const health = await checkHealth(host);
      setHealthMsg(`${health.ok ? '●' : '○'} ${reasonText(health.reason, t)} · ${health.url}`);
      if (!health.ok) {
        Alert.alert(
          reasonText(health.reason, t),
          `${t.triedUrl.replace('{url}', health.url)}\n\n${t.srvChecklist.replace('{url}', health.url)}`,
        );
        return;
      }
      const { pushed, failures } = await pushOutbox(host);
      refreshPendings();
      if (failures.length === 0) {
        Alert.alert(t.syncTitle, t.syncPushed.replace('{n}', String(pushed)));
      } else {
        const f = failures[0];
        const first = t.syncRowFailed.replace('{id}', String(f.id)).replace('{entity}', f.entity).replace('{error}', f.error);
        Alert.alert(
          t.syncTitle,
          `${t.syncPushed.replace('{n}', String(pushed))}\n\n${first}${failures.length > 1 ? ` (+${failures.length - 1})` : ''}`,
        );
      }
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
              <Text style={s.tierText}>{tt.label}{tt.where === 'peer' ? ' · LAN' : ''}{'\n'}<Text style={s.sub}>{tt.tagline}</Text></Text>
              <TouchableOpacity
                style={[s.use, tier === tt.id && s.using]}
                onPress={() => chooseTier(tt.id)}
                disabled={tierBusy}
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
        {healthMsg ? <Text style={[s.sub, { marginTop: 8 }]} selectable>{healthMsg}</Text> : null}
        <Text style={[s.sub, { marginTop: 8 }]}>{t.srvRunbook}</Text>
      </View>
      <View style={s.card}>
        <Text style={s.h3}>{t.peerTitle}</Text>
        <Text style={s.sub}>{t.peerNote}</Text>
        <TextInput style={[s.txt, { marginTop: 10 }]} value={peerHost} onChangeText={setPeerHost} placeholder={t.peerPlaceholder} placeholderTextColor={th.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <TouchableOpacity style={s.btn} onPress={savePeer} disabled={peerBusy} accessibilityRole="button">
          {peerBusy ? <ActivityIndicator color={ON_DARK} /> : <Text style={s.btnText}>{t.peerCheck}</Text>}
        </TouchableOpacity>
        {peerStatus ? (
          <Text style={[s.sub, { marginTop: 8 }]} selectable>
            {peerStatus.ok ? `● ${t.peerOk} · ${peerStatus.url}` : `○ ${peerReasonText(peerStatus.reason, t)} · ${peerStatus.url}`}
            {peerStatus.models.length > 0 ? `\n${t.peerModels.replace('{models}', peerStatus.models.map((m) => `${m.id}:${m.state ?? 'unknown'}`).join(', '))}` : ''}
          </Text>
        ) : <Text style={[s.sub, { marginTop: 8 }]}>{t.peerUnreachable}</Text>}
      </View>
      <View style={s.card}>
        <Text style={s.h3}>Modelos on-device · estado</Text>
        <Text style={s.sub}>La primera carga descarga ~3.4GB una vez con WiFi; después todo funciona en avión. Reinstalar la app borra los modelos.</Text>
        <Text style={s.sub}>Teléfono: {Device.modelName ?? '?'} · {Device.totalMemory ? `${(Device.totalMemory / 1e9).toFixed(1)}GB RAM` : 'RAM desconocida'} · CPU-forzado (sin GPU).</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            style={[s.btn, { flex: 1 }]}
            disabled={stBusy}
            onPress={async () => {
              setStBusy(true);
              setStatuses(await fetchModelStatuses());
              setStBusy(false);
            }}
            accessibilityRole="button"
          >
            {stBusy ? <ActivityIndicator color={ON_DARK} /> : <Text style={s.btnText}>Ver estado</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.ghost, { flex: 1, marginTop: 0 }]}
            disabled={testBusy}
            onPress={async () => {
              setTestBusy(true);
              setTestMsg('Probando MedPsy…');
              const r = await testChat();
              setTestMsg(r.ok ? `MedPsy responde (${r.ms}ms): "${r.text}"` : `MedPsy NO responde (${r.ms}ms): ${r.error}`);
              setTestBusy(false);
            }}
            accessibilityRole="button"
          >
            {testBusy ? <ActivityIndicator color={th.green} /> : <Text style={[s.btnText, { color: th.text }]}>Probar chat</Text>}
          </TouchableOpacity>
        </View>
        {testMsg ? <Text style={[s.sub, { marginTop: 8 }]} selectable>{testMsg}</Text> : null}
        {statuses.map((m) => (
          <View key={m.key} style={s.mrow}>
            <Text style={s.mdot}>{m.error ? '⚠️' : m.isCached ? '●' : '○'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.mlabel}>{m.label}{m.isLoaded ? ' · en memoria' : ''}</Text>
              <Text style={s.sub}>
                {m.error ? m.error : m.isCached == null ? 'sin datos' : m.isCached ? `descargado · ${fmtBytes(m.actualBytes ?? m.expectedBytes)}` : `falta · esperado ${m.approxSize}`}
              </Text>
            </View>
          </View>
        ))}
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
            setStatuses(await fetchModelStatuses());
          }}
          accessibilityRole="button"
        >
          {dlBusy ? <ActivityIndicator color={ON_DARK} /> : <Text style={s.btnText}>Descargar modelos</Text>}
        </TouchableOpacity>
        {dlMsg || testMsg ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            {dlMsg ? <Text style={s.sub} selectable>{dlMsg}</Text> : null}
            <TouchableOpacity
              style={[s.btn, s.ghost, { marginTop: 0, minHeight: 44 }]}
              onPress={async () => {
                const lines = [
                  `diag: ${dlMsg ?? '—'}`,
                  `test: ${testMsg ?? '—'}`,
                  ...statuses.map((m) => `${m.key}: cached=${m.isCached} loaded=${m.isLoaded} size=${fmtBytes(m.actualBytes ?? m.expectedBytes)}${m.error ? ` err=${m.error}` : ''}`),
                ];
                await Clipboard.setStringAsync(lines.join('\n'));
                Alert.alert('Copiado', 'Diagnóstico copiado al portapapeles.');
              }}
              accessibilityRole="button"
            >
              <Text style={[s.btnText, { color: th.text }]}>Copiar diagnóstico</Text>
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
  mrow: { flexDirection: 'row', gap: 8, paddingVertical: 7, borderTopColor: t.border, borderTopWidth: 1, marginTop: 7 },
  mdot: { fontSize: 13, color: t.green },
  mlabel: { color: t.text, fontSize: 13, fontWeight: '700' },
  txt: { backgroundColor: t.bg, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  btn: { backgroundColor: t.blue, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  ghost: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, marginTop: 8 },
  btnText: { color: ON_DARK, fontWeight: '700', textAlign: 'center' },
});
