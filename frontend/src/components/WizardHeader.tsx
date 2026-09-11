// WizardHeader — shared iOS-style header for chat / review / report.
// 56px row, 3 boxes: [48px back chevron] [centered step title] [right action slot].
// Back behavior mirrors useHardwareBack (Task 01): chat→Inicio, review→chat,
// report→review. Drafts are write-through in SQLite — back never loses data.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { useStrings } from '../i18n/useStrings';
import { useTheme } from '../../theme/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeTokens } from '../../theme/tokens';

export function WizardHeader({ title, onBack, right }: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const t = useStrings();
  const { theme: th } = useTheme();
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.bar}>
      <TouchableOpacity
        style={s.back}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t.back}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="back" size={26} color={th.text} />
      </TouchableOpacity>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={s.right}>{right}</View>
    </View>
  );
}

const makeStyles = (t: ThemeTokens) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 4, gap: 4 },
  back: { width: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, color: t.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  right: { minWidth: 48, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
} as const);
