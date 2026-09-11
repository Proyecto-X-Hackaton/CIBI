// useStrings.ts — single hook for UI strings. Screens must use this,
// never import STR directly (keeps toggle wiring auditable).

import { STR } from './strings';
import { useApp } from '../state/AppState';

export function useStrings() {
  const { uiLang } = useApp();
  return STR[uiLang];
}
