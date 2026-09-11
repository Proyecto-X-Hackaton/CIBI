// CIBI — Customer Installed-Base Intelligence, on-device.
// Tabs: Inicio | Panel | Red | Ajustes. Wizard (chat/revisar/informe) sin tabs.
// Judged flow runs on a PHYSICAL Android device:
//   npx expo prebuild && npx expo run:android --device
// (Android Studio: open ./android after prebuild, Run on physical device —
//  llamacpp fails on emulators.) All inference: @qvac/sdk on-device only.

import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { AppProvider, useApp } from './src/state/AppState';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { useThemedStyles } from './theme/useThemedStyles';
import type { ThemeTokens } from './theme/tokens';
import { OfflineBadge, TierPill, TierDetailsSheet } from './src/components/atoms';
import { Icon, type IconName } from './src/components/Icon';
import { useStrings } from './src/i18n/useStrings';
import { useHardwareBack } from './src/utils/backNav';
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
  const insets = useSafeAreaInsets();
  useHardwareBack({ wizard, tab, setTab, setWizard, refreshPendings });

  const { theme } = useTheme();
  const s = useThemedStyles(makeStyles);
  useEffect(() => {
    // Match the system nav bar to the app chrome (3-button mode).
    NavigationBar.setBackgroundColorAsync(theme.bg).catch(() => {});
    NavigationBar.setButtonStyleAsync(theme.statusBar).catch(() => {});
  }, [theme]);

  if (!ready) {
    return (
      <View style={[s.safe, { paddingTop: insets.top }]}>
        <View style={s.center}><Text style={{ color: theme.text }}>CIBI cargando… (SQLite local)</Text></View>
      </View>
    );
  }

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
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
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {tab === 'home' && <HomeScreen />}
          {tab === 'panel' && <PanelScreen />}
          {tab === 'network' && <NetworkScreen />}
          {tab === 'settings' && <SettingsScreen />}
          <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
                <Icon name={icon as IconName} size={22} color={tab === id ? theme.green : theme.muted} />
                <Text style={[s.tabLabel, tab === id && s.tabActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <TierDetailsSheet />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <ThemedStatusBar />
          <Shell />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar barStyle={theme.statusBar === 'light' ? 'light-content' : 'dark-content'} />;
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  appbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  brand: { color: t.text, fontWeight: '800', fontSize: 15 },
  tabbar: { flexDirection: 'row', borderTopColor: t.border, borderTopWidth: 1, backgroundColor: t.bg, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48, justifyContent: 'center' },
  tabLabel: { fontSize: 10, color: t.muted },
  tabActive: { color: t.green, fontWeight: '700' },
} as const);
