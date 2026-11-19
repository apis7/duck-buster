import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { todayISO } from '@/domain/season';
import { parseCard, type SlugfestCard } from '@/domain/slugfest';
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

/** Send this crew's Slugfest season card as a small file (text it, email it…). */
export async function exportSlugCard(card: SlugfestCard): Promise<void> {
  const safe = card.crewName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'crew';
  const file = new File(Paths.cache, `slugfest-${safe}-${card.season}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(card));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: `Send ${card.crewName}'s season card` });
}

/** Pick another crew's season card file. Null if cancelled; throws if it isn't one. */
export async function pickSlugCard(): Promise<SlugfestCard | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', 'application/octet-stream', '*/*'] });
  if (picked.canceled) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(await picked.result.text());
  } catch {
    throw new Error('That file isn’t a Slugfest season card.');
  }
  return parseCard(raw);
}
