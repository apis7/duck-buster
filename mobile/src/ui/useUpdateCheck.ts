import { useEffect } from 'react';

import { checkForUpdate, completeUpdate, onUpdateDownloaded, startUpdate } from '../../modules/in-app-updates/src';
import { todayISO } from '@/domain/season';
import { useStore } from '@/state/store';
import { useDialog } from '@/ui/Dialog';

type Ask = ReturnType<typeof useDialog>;

async function offerRestart(ask: Ask) {
  const v = await ask({
    icon: '🦆',
    title: 'Update ready',
    message: 'The new version of Duck Buster is downloaded. Restart the app to finish? Your hunts are safe.',
    buttons: [
      { label: 'Restart now', value: 'go', kind: 'primary' },
      { label: 'Later', value: 'later' },
    ],
  });
  if (v === 'go') completeUpdate().catch(() => {});
}

/**
 * Play Store update check (Android, Play installs only). Runs once the main tabs are up —
 * never over the launch mini-game or a hunt being logged — a few seconds in so it doesn't
 * collide with the season-archive notice. "New version" is offered at most once a day;
 * "update downloaded, restart?" every launch until it's installed.
 */
export function useUpdateCheck() {
  const { settings, setSetting } = useStore();
  const ask = useDialog();

  useEffect(() => {
    return onUpdateDownloaded(() => void offerRestart(ask));
  }, [ask]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const state = await checkForUpdate().catch(() => 'none' as const);
      if (state === 'downloaded') {
        await offerRestart(ask);
        return;
      }
      if (state !== 'available' || settings.updateOfferedOn === todayISO()) return;
      setSetting('updateOfferedOn', todayISO());
      const v = await ask({
        icon: '✨',
        title: 'New version',
        message: 'A newer Duck Buster is on the Play Store. Update now? It downloads in the background while you keep using the app.',
        buttons: [
          { label: 'Update', value: 'go', kind: 'primary' },
          { label: 'Later', value: 'later' },
        ],
      });
      if (v === 'go') startUpdate().catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
    // Once per app launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
