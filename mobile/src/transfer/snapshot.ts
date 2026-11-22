import { strFromU8, strToU8 } from 'fflate';

import { parseCard } from '@/domain/slugfest';
import type { Data, Harvest } from '@/domain/types';
import { count } from '@/domain/plural';

/**
 * What a phone-to-phone transfer carries: every hunter, hunt and bird. Settings,
 * high scores and celebrated-badge flags stay behind — they describe the phone.
 *
 * Bump SNAPSHOT_FORMAT on any change an older app couldn't read; the frame
 * header carries it so an old phone says "update first" on the very first code.
 */
export const SNAPSHOT_FORMAT = 1;

export type Snapshot = { format: number; exportedAt: number; data: Data };

export function snapshotToBytes(data: Data): Uint8Array {
  const snap: Snapshot = { format: SNAPSHOT_FORMAT, exportedAt: Date.now(), data };
  return strToU8(JSON.stringify(snap));
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parse and validate; throws a readable error on anything malformed. */
export function snapshotFromBytes(bytes: Uint8Array): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(bytes));
  } catch {
    throw new Error('That transfer could not be read.');
  }
  const s = raw as Partial<Snapshot>;
  if (!s || !isNum(s.format) || s.format > SNAPSHOT_FORMAT || !s.data) throw new Error('That transfer could not be read.');
  const d = s.data as Data;
  // Older snapshots predate parties and custom birds.
  d.parties ??= [];
  d.customSpecies ??= [];
  d.gameScores ??= [];
  // Other crews' Slugfest cards ride along in backups; drop any that don't parse.
  d.slugfest = (Array.isArray(d.slugfest) ? d.slugfest : []).flatMap((c) => {
    try {
      return [parseCard(c)];
    } catch {
      return [];
    }
  });
  for (const h of d.hunters ?? []) h.partyId ??= null;
  const ok =
    Array.isArray(d.parties) && d.parties.every((p) => isStr(p.id) && isStr(p.name) && isStr(p.color) && isNum(p.createdAt)) &&
    Array.isArray(d.gameScores) && d.gameScores.every((g) => isStr(g.id) && isStr(g.huntId) && isStr(g.hunterId) && isNum(g.score)) &&
    Array.isArray(d.customSpecies) && d.customSpecies.every((c) => isStr(c.id) && isStr(c.name) && typeof c.sexed === 'boolean') &&
    Array.isArray(d.hunters) && d.hunters.every((h) => isStr(h.id) && isStr(h.name) && isStr(h.color) && isNum(h.createdAt)) &&
    Array.isArray(d.hunts) && d.hunts.every((h) => isStr(h.id) && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && isNum(h.createdAt)) &&
    Array.isArray(d.huntHunters) && d.huntHunters.every((p) => isStr(p.huntId) && isStr(p.hunterId)) &&
    Array.isArray(d.harvests) &&
    d.harvests.every(
      (r: Harvest) =>
        isStr(r.id) && isStr(r.huntId) && isStr(r.hunterId) && isStr(r.speciesId) &&
        (r.sex === 'D' || r.sex === 'H' || r.sex === 'U') && isNum(r.count) && r.count >= 0 && isNum(r.banded) && r.banded >= 0,
    );
  if (!ok) throw new Error('That transfer is damaged. Nothing was changed.');
  return { format: s.format, exportedAt: isNum(s.exportedAt) ? s.exportedAt : 0, data: d };
}

export function describe(data: Data): string {
  const birds = data.harvests.reduce((n, r) => n + r.count, 0);
  const parties = data.parties.length ? ` · ${data.parties.length} parties` : '';
  return `${count(data.hunters.length, 'hunter')}${parties} · ${count(data.hunts.length, 'hunt')} · ${count(birds, 'bird')}`;
}
