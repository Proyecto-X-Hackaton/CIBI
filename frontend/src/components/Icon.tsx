// Icon.tsx — single icon surface. All UI icons come from lucide-react-native.
// Never use emojis as icons. Tier colored dots stay as Views, not emojis.

import React from 'react';
import {
  Home, LayoutDashboard, Map as MapIcon, Settings as SettingsIcon,
  Camera, Mic, Send, X, ChevronLeft, ChevronRight, Search,
  Calendar, FileText, RefreshCw, Info, WifiOff, TriangleAlert,
  Lightbulb, Building2, CircleStop, Check, ClipboardCheck, Trash,
} from 'lucide-react-native';

const MAP = {
  home: Home,
  panel: LayoutDashboard,
  network: MapIcon,
  settings: SettingsIcon,
  camera: Camera,
  mic: Mic,
  send: Send,
  close: X,
  back: ChevronLeft,
  next: ChevronRight,
  search: Search,
  calendar: Calendar,
  report: FileText,
  refresh: RefreshCw,
  info: Info,
  offline: WifiOff,
  warn: TriangleAlert,
  idea: Lightbulb,
  hospital: Building2,
  stop: CircleStop,
  check: Check,
  review: ClipboardCheck,
  trash: Trash,
} as const;

import { useTheme } from '../../theme/ThemeContext';

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { theme } = useTheme();
  const Cmp = MAP[name];
  return <Cmp size={size} color={color ?? theme.text} />;
}
