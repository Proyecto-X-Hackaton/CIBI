// backNav.ts — single hardware-back stack for the app (Task 01, app-shell-ux).
// The app has no nav library; this gives system back a real behavior:
//   wizard report → review → chat → exit wizard (draft is write-through in SQLite)
//   tabs: any tab → home; home → allow system default (exit).

import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import type { TopTab, Wizard } from '../state/AppState';

export function useHardwareBack(opts: {
  wizard: Wizard;
  tab: TopTab;
  setTab: (t: TopTab) => void;
  setWizard: (w: Wizard) => void;
  refreshPendings: () => void;
}): void {
  const { wizard, tab, setTab, setWizard, refreshPendings } = opts;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (wizard) {
        if (wizard.name === 'report') {
          setWizard({ name: 'review', inspectionId: wizard.inspectionId });
          return true;
        }
        if (wizard.name === 'review') {
          setWizard({ name: 'chat', inspectionId: wizard.inspectionId });
          return true;
        }
        refreshPendings();
        setWizard(null);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false; // home: system default (exit)
    });
    return () => sub.remove();
  }, [wizard, tab, setTab, setWizard, refreshPendings]);
}
