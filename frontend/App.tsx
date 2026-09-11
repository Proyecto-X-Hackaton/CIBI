// CIBI — Customer Installed-Base Intelligence, on-device.
// Tabs: Inicio | Panel | Red | Ajustes. Wizard (chat/revisar/informe) sin tabs.
// Judged flow runs on a PHYSICAL Android device:
//   npx expo prebuild && npx expo run:android --device
// (Android Studio: open ./android after prebuild, Run on physical device —
//  llamacpp fails on emulators.) All inference: @qvac/sdk on-device only.

import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { AppProvider, useApp } from './src/state/AppState';
import { C, OfflineBadge, TierPill, TierDetailsSheet, Disclaimer } from './src/components/atoms';
import { Icon, type IconName } from './src/components/Icon';
import { useStrings } from './src/i18n/useStrings';
import HomeScreen from './src/screens/HomeScreen';
import ChatCaptureScreen from './src/screens/ChatCaptureScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import ReportScreen from './src/screens/ReportScreen';
import NetworkScreen from './src/screens/NetworkScreen';
import PanelScreen from './src/screens/PanelScreen';
import SettingsScreen from './src/screens/SettingsScreen';

function Shell() {
  const { tab, setTab, wizard, setWizard, tier, online, pendings, setDetailsOpen, ready, refreshPendings } = useApp();
  const t = useStrings();

  if (!ready) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><Text style={{ color: C.text }}>CIBI cargando… (SQLite local)</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.appbar}>
        <Text style={s.brand}>CIBI{wizard ? ' · Inspección' : ''}</Text>
        <TierPill tier={tier} onPress={() => setDetailsOpen(true)} />
        <OfflineBadge online={online} pendings={pendings} />
      </View>

      {wizard ? (
        <View style={{ flex: 1 }}>
          {wizard.name === 'chat' ? (
            <ChatCaptureScreen inspectionId={wizard.inspectionId} />
          ) : wizard.name === 'review' ? (
            <ReviewScreen inspectionId={wizard.inspectionId} />
          ) : (
            <ReportScreen inspectionId={wizard.inspectionId} />
          )}
          <TouchableOpacity
            style={s.exitbar}
            onPress={() => { refreshPendings(); setWizard(null); }}
            accessibilityRole="button"
            accessibilityLabel={t.exitWizard}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.exitText}>{t.exitWizard}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'panel' && <PanelScreen />}
          {tab === 'network' && <NetworkScreen />}
          {tab === 'settings' && <SettingsScreen />}
          <View style={s.tabbar}>
            {(
              [
                ['home', 'home', t.home],
                ['panel', 'panel', t.panel],
                ['network', 'network', t.network],
                ['settings', 'settings', t.settings],
              ] as const
            ).map(([id, icon, label]) => (
              <TouchableOpacity
                key={id}
                style={s.tab}
                onPress={() => setTab(id)}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name={icon as IconName} size={22} color={tab === id ? C.green : '#6E6E78'} />
                <Text style={[s.tabLabel, tab === id && s.tabActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <TierDetailsSheet />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppProvider>
      <StatusBar barStyle="light-content" />
      <Shell />
    </AppProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  appbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  brand: { color: C.text, fontWeight: '800', fontSize: 15 },
  exitbar: { minHeight: 56, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopColor: C.border, borderTopWidth: 1, backgroundColor: '#101016' },
  exitText: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  tabbar: { flexDirection: 'row', borderTopColor: C.border, borderTopWidth: 1, backgroundColor: '#101016', paddingBottom: 18, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  tabLabel: { fontSize: 10, color: '#6E6E78' },
  tabActive: { color: C.green, fontWeight: '700' },
});
