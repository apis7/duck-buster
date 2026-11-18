import { strFromU8, strToU8 } from 'fflate';

import type { Data, Harvest } from '@/domain/types';

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
  const ok =
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
  return `${data.hunters.length} hunters · ${data.hunts.length} hunts · ${birds} birds`;
}
