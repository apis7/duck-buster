import { nameKey } from './names';
import type { Data, Harvest, HuntHunter } from './types';

/**
 * Restore-with-Merge, made safe for a backup from another phone.
 *
 * Rows are written by id, so a backup made on this phone (same ids) simply
 * updates in place. A backup from another phone has its own ids for the same
 * people and days, so before writing we line it up with what's already here:
 *  - hunters, parties and custom birds with the same name are the same one;
 *  - a hunt on a day that already has a hunt joins that hunt (one hunt per day).
 *    Hunters already logged on that day keep their entries here; hunters who
 *    aren't are added with the backup's birds;
 *  - a duck-shoot round for a day that already has one is dropped.
 *
 * Returns the rows to write. Joined hunts carry their full combined rows, because
 * writing a hunt replaces its party and birds.
 */
export function prepareMerge(existing: Data, incoming: Data): Data {
  const hunterId = new Map<string, string>();
  const hunters = incoming.hunters.filter((h) => {
    if (existing.hunters.some((e) => e.id === h.id)) return true;
    const same = existing.hunters.find((e) => nameKey(e.name) === nameKey(h.name));
    if (same) hunterId.set(h.id, same.id);
    return !same;
  });
  const hid = (id: string) => hunterId.get(id) ?? id;

  const partyId = new Map<string, string>();
  const parties = incoming.parties.filter((p) => {
    if (existing.parties.some((e) => e.id === p.id)) return true;
    const same = existing.parties.find((e) => nameKey(e.name) === nameKey(p.name));
    if (same) partyId.set(p.id, same.id);
    return !same;
  });

  const speciesId = new Map<string, string>();
  const customSpecies = incoming.customSpecies.filter((c) => {
    if (existing.customSpecies.some((e) => e.id === c.id)) return true;
    const same = existing.customSpecies.find((e) => nameKey(e.name) === nameKey(c.name));
    if (same) speciesId.set(c.id, same.id);
    return !same;
  });

  const huntId = new Map<string, string>();
  const joined = new Set<string>();
  const hunts = incoming.hunts.filter((h) => {
    if (existing.hunts.some((e) => e.id === h.id)) return true;
    const same = existing.hunts.find((e) => e.date === h.date);
    if (same) {
      huntId.set(h.id, same.id);
      joined.add(same.id);
    }
    return !same;
  });
  const uid = (id: string) => huntId.get(id) ?? id;

  const fix = (r: Harvest): Harvest => ({ ...r, huntId: uid(r.huntId), hunterId: hid(r.hunterId), speciesId: speciesId.get(r.speciesId) ?? r.speciesId });
  let huntHunters: HuntHunter[] = incoming.huntHunters.map((p) => ({ huntId: uid(p.huntId), hunterId: hid(p.hunterId) }));
  let harvests = incoming.harvests.map(fix);

  // Joined hunts: what's here stays; the backup only adds hunters who weren't logged.
  for (const id of joined) {
    const herePeople = existing.huntHunters.filter((p) => p.huntId === id);
    const here = new Set(herePeople.map((p) => p.hunterId));
    const newPeople = huntHunters.filter((p) => p.huntId === id && !here.has(p.hunterId));
    const newIds = new Set(newPeople.map((p) => p.hunterId));
    huntHunters = [...huntHunters.filter((p) => p.huntId !== id), ...herePeople, ...newPeople];
    harvests = [
      ...harvests.filter((r) => r.huntId !== id),
      ...existing.harvests.filter((r) => r.huntId === id),
      ...harvests.filter((r) => r.huntId === id && newIds.has(r.hunterId)),
    ];
  }
  // De-dupe party rows (a hunter can appear once per hunt).
  const seen = new Set<string>();
  huntHunters = huntHunters.filter((p) => {
    const k = `${p.huntId}|${p.hunterId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const played = new Set(existing.gameScores.map((g) => g.huntId));
  const gameScores = incoming.gameScores
    .map((g) => ({ ...g, huntId: uid(g.huntId), hunterId: hid(g.hunterId) }))
    .filter((g) => existing.gameScores.some((e) => e.id === g.id) || !played.has(g.huntId));

  return {
    hunters: hunters.map((h) => ({ ...h, partyId: h.partyId ? (partyId.get(h.partyId) ?? h.partyId) : null })),
    parties,
    customSpecies,
    hunts: [...hunts, ...existing.hunts.filter((h) => joined.has(h.id))],
    huntHunters,
    harvests,
    gameScores,
    slugfest: incoming.slugfest,
  };
}
