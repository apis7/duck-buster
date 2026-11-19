import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { todayISO } from '@/domain/season';
import type { Data } from '@/domain/types';
import { snapshotFromBytes, snapshotToBytes, type Snapshot } from '@/transfer/snapshot';

/**
 * Backups are one JSON file holding every season: hunters, parties, hunts, birds,
 * duck-shoot rounds and custom birds. Same format as the QR transfer, so the same
 * validator guards both. The file goes wherever the user sends it from the share
 * sheet (Drive, email, Files…); the app itself never uploads anything.
 */

export async function exportBackup(data: Data): Promise<void> {
  const file = new File(Paths.cache, `duck-buster-backup-${todayISO()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(snapshotToBytes(data));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Duck Buster backup' });
}

/** Let the user pick a backup file. Null if they cancelled; throws if it isn't a valid backup. */
export async function pickBackup(): Promise<Snapshot | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', 'application/octet-stream', '*/*'] });
  if (picked.canceled) return null;
  return snapshotFromBytes(await picked.result.bytes());
}
