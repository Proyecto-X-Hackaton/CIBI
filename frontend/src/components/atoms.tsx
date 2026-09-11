// Shared dark UI atoms matching docs/ui-ux-plan mockups.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { TIER_ROSTER, tierById, CATALOG_VERSION } from '../qvac/TIER_ROSTER';
import type { TierId } from '../qvac/TIER_ROSTER';
import { recentSpans } from '../qvac/perf';
import { useApp } from '../state/AppState';
import type { Confidence } from '../qvac/structure';
import { DISCLAIMER_ES } from '../utils/safety';

export const C = {
  bg: '#0B0B0F', surface: '#16161E', border: '#26262F', text: '#F2F2F5',
  muted: '#A7A7B3', green: '#22C55E', blue: '#3B82F6', amber: '#F59E0B', purple: '#A78BFA',
};

export function OfflineBadge({ online, pendings }: { online: boolean; pendings: number }) {
  const { uiLang } = useApp();
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
  const dotColor = tier === 'CIBI' ? C.green : tier === 'CIBI_PRO' ? C.blue : C.purple;
  return (
    <TouchableOpacity style={s.tierPill} onPress={onPress} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View style={s.tierRow}><View style={[s.dot, { backgroundColor: dotColor }]} /><Text style={s.tierPillText}>{t.label}</Text></View>
    </TouchableOpacity>
  );
}

export function ConfidenceChip({ value }: { value: Confidence }) {
  const bg = value === 'Confirmed' ? '#15803D' : value === 'Reported' ? '#6D28D9' : value === 'Estimated' ? '#B45309' : '#52525B';
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={s.chipText}>{value}</Text>
    </View>
  );
}

export function Disclaimer() {
  return <Text style={s.fine}>{DISCLAIMER_ES}</Text>;
}

/** ⓘ TierDetailsSheet — the ONLY model-name surface (F09). One component, one TIER_ROSTER. */
export function TierDetailsSheet() {
  const { detailsOpen, setDetailsOpen } = useApp();
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

const s = StyleSheet.create({
  pill: { backgroundColor: 'rgba(34,197,94,.14)', borderColor: 'rgba(34,197,94,.45)', borderWidth: 1, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
  pillText: { color: C.green, fontSize: 11, fontWeight: '700' },
  tierPill: { backgroundColor: '#1E1E28', borderColor: '#3A3A45', borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tierPillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chip: { borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  fine: { color: '#8A8A95', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 16 },
  h2: { color: C.text, fontSize: 16, fontWeight: '800', marginVertical: 8 },
  small: { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  tierCard: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, marginBottom: 8 },
  tierTitle: { color: C.text, fontWeight: '800', marginBottom: 6 },
  primary: { backgroundColor: C.green, borderRadius: 12, padding: 14, marginTop: 10 },
  primaryText: { color: '#04120A', fontWeight: '800', textAlign: 'center' },
});
