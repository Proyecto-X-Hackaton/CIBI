// Shared themed UI atoms matching docs/ui-ux-plan mockups.
// All color comes from useTheme()/useThemedStyles — no hardcoded palette here.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { TIER_ROSTER, tierById, CATALOG_VERSION } from '../qvac/TIER_ROSTER';
import type { TierId } from '../qvac/TIER_ROSTER';
import { recentSpans } from '../qvac/perf';
import { useApp } from '../state/AppState';
import type { Confidence } from '../qvac/structure';
import { DISCLAIMER_ES } from '../utils/safety';
import { useTheme } from '../../theme/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { CONFIDENCE_COLORS, ON_DARK, type ThemeTokens } from '../../theme/tokens';

export function OfflineBadge({ online, pendings }: { online: boolean; pendings: number }) {
  const { uiLang } = useApp();
  const s = useThemedStyles(makeStyles);
  if (online && pendings === 0) return null;
  const off = uiLang === 'en' ? 'OFFLINE' : 'SIN CONEXIÓN';
  const pend = uiLang === 'en' ? 'pending' : 'pendientes';
  if (!online) return (
    <View style={s.pill}>
      <Text style={s.pillText}>● {off}{pendings > 0 ? ` · ${pendings} ${pend}` : ''}</Text>
    </View>
  );
  return (
    <View style={s.pill}>
      <Text style={s.pillText}>● {pendings} {pend}</Text>
    </View>
  );
}

export function TierPill({ tier, onPress }: { tier: TierId; onPress?: () => void }) {
  const t = tierById(tier);
  const { theme: th } = useTheme();
  const s = useThemedStyles(makeStyles);
  const dotColor = tier === 'CIBI' ? th.green : tier === 'CIBI_PRO' ? th.blue : th.purple;
  return (
    <TouchableOpacity style={s.tierPill} onPress={onPress} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={s.tierRow}><View style={[s.dot, { backgroundColor: dotColor }]} /><Text style={s.tierPillText}>{t.label}</Text></View>
    </TouchableOpacity>
  );
}

export function ConfidenceChip({ value }: { value: Confidence }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={[s.chip, { backgroundColor: CONFIDENCE_COLORS[value] ?? CONFIDENCE_COLORS.Unknown }]}>
      <Text style={s.chipText}>{value}</Text>
    </View>
  );
}

export function Disclaimer() {
  const s = useThemedStyles(makeStyles);
  return <Text style={s.fine}>{DISCLAIMER_ES}</Text>;
}

/** ⓘ TierDetailsSheet — the ONLY model-name surface (F09). One component, one TIER_ROSTER. */
export function TierDetailsSheet() {
  const { detailsOpen, setDetailsOpen } = useApp();
  const s = useThemedStyles(makeStyles);
  const spans = recentSpans(6);
  return (
    <Modal visible={detailsOpen} animationType="slide" transparent onRequestClose={() => setDetailsOpen(false)}>
      <View style={s.sheetWrap}>
        <View style={s.sheet}>
          <ScrollView>
            <Text style={s.h2}>Detalles de modelos</Text>
            <Text style={s.small}>Una sola fuente: TIER_ROSTER · catálogo v{CATALOG_VERSION} · datos demo sintéticos</Text>
            {TIER_ROSTER.map((tt) => (
              <View key={tt.id} style={s.tierCard}>
                <Text style={s.tierTitle}>{tt.label} · {tt.where === 'phone' ? 'en tu teléfono' : 'peer local'} · Modo: {tt.mode}</Text>
                {tt.models.map((m) => (
                  <Text key={m.name} style={s.small}>
                    • {m.name} ({m.quant}) — {m.engine}{m.ctx ? ` ctx ${m.ctx}` : ''} — {m.approxSize} — {m.license}{'\n  '}{m.resolvesTo}
                  </Text>
                ))}
                <Text style={s.small}>HW: {tt.hw}</Text>
                <Text style={s.small}>Fallback: {tt.fallback}</Text>
              </View>
            ))}
            <Text style={s.h2}>Últimos spans</Text>
            {spans.length === 0 ? <Text style={s.small}>Sin inferencias aún — el smoke test D1 llena esto.</Text> : spans.map((p, i) => (
              <Text key={i} style={s.small}>{p.phase} {p.model} tier {p.tier} load {p.load_ms ?? '-'}ms TTFT {p.ttft_ms ?? '-'}ms {p.throughput_tps ?? '-'}t/s ok {String(p.ok)}</Text>
            ))}
            <TouchableOpacity style={s.primary} onPress={() => setDetailsOpen(false)}>
              <Text style={s.primaryText}>Cerrar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  pill: { backgroundColor: 'rgba(34,197,94,.14)', borderColor: 'rgba(34,197,94,.45)', borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
  pillText: { color: t.green, fontSize: 11, fontWeight: '700' },
  tierPill: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tierPillText: { color: t.text, fontSize: 12, fontWeight: '800' },
  chip: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  chipText: { color: ON_DARK, fontSize: 11, fontWeight: '700' },
  fine: { color: t.muted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 16 },
  h2: { color: t.text, fontSize: 16, fontWeight: '800', marginVertical: 8 },
  small: { color: t.muted, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  tierCard: { borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 10, marginBottom: 8 },
  tierTitle: { color: t.text, fontWeight: '800', marginBottom: 6 },
  primary: { backgroundColor: t.green, borderRadius: 12, padding: 14, marginTop: 10 },
  primaryText: { color: t.onAccent, fontWeight: '800', textAlign: 'center' },
} as const);
