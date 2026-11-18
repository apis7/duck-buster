import { meatOz } from './meat';
import { seasonOf } from './season';
import { isCoot, isDuck, isGoose, SPECIES_BY_ID, TEAL } from './species';
import type { Data, Harvest, Hunt } from './types';

/**
 * One hunter's day: the hunt, who else was there, and what this hunter shot.
 * Most badges, awards and Wrapped cards are questions about a list of these.
 */
export type HunterDay = {
  hunt: Hunt;
  party: string[];
  rows: Harvest[];
  birds: number;
};

export type Scope = { season?: number };

export function inScope(date: string, scope: Scope): boolean {
  return scope.season == null || seasonOf(date) === scope.season;
}

export function seasonsIn(data: Data): number[] {
  return Array.from(new Set(data.hunts.map((h) => seasonOf(h.date)))).sort((a, b) => b - a);
}

export const sum = (rows: Harvest[], pick: (r: Harvest) => boolean = () => true) =>
  rows.reduce((n, r) => (pick(r) ? n + r.count : n), 0);

export function hunterDays(data: Data, hunterId: string, scope: Scope = {}): HunterDay[] {
  return groupDays(data, [hunterId], scope);
}

/**
 * Days for a group of hunters taken together (one hunter, or a whole party): every
 * hunt any of them was on, with the birds all of them shot. A party that comes
 * home with nothing on a hunt is skunked as a party.
 */
export function groupDays(data: Data, memberIds: string[], scope: Scope = {}): HunterDay[] {
  const members = new Set(memberIds);
  const huntById = new Map(data.hunts.map((h) => [h.id, h]));
  const partyByHunt = new Map<string, string[]>();
  for (const hh of data.huntHunters) {
    const list = partyByHunt.get(hh.huntId) ?? [];
    list.push(hh.hunterId);
    partyByHunt.set(hh.huntId, list);
  }
  const days: HunterDay[] = [];
  for (const [huntId, party] of partyByHunt) {
    if (!party.some((p) => members.has(p))) continue;
    const hunt = huntById.get(huntId);
    if (!hunt || !inScope(hunt.date, scope)) continue;
    const rows = data.harvests.filter((r) => r.huntId === huntId && members.has(r.hunterId));
    days.push({ hunt, party, rows, birds: sum(rows) });
  }
  return days.sort((a, b) => a.hunt.date.localeCompare(b.hunt.date) || a.hunt.createdAt - b.hunt.createdAt);
}

export type HunterStats = {
  hunts: number;
  birds: number;
  ducks: number;
  geese: number;
  coots: number;
  drakes: number;
  hens: number;
  banded: number;
  /** Estimated edible meat, ounces. */
  meatOz: number;
  teal: number;
  greenheads: number;
  skunks: number;
  species: Set<string>;
  bySpecies: Record<string, number>;
  biggestDay: HunterDay | null;
  firstDate: string | null;
};

export function statsFromDays(days: HunterDay[]): HunterStats {
  const rows = days.flatMap((d) => d.rows);
  const bySpecies: Record<string, number> = {};
  for (const r of rows) bySpecies[r.speciesId] = (bySpecies[r.speciesId] ?? 0) + r.count;
  let biggestDay: HunterDay | null = null;
  for (const d of days) if (d.birds > 0 && (!biggestDay || d.birds > biggestDay.birds)) biggestDay = d;
  return {
    hunts: days.length,
    birds: sum(rows),
    ducks: sum(rows, (r) => isDuck(r.speciesId)),
    geese: sum(rows, (r) => isGoose(r.speciesId)),
    coots: sum(rows, (r) => isCoot(r.speciesId)),
    drakes: sum(rows, (r) => r.sex === 'D'),
    hens: sum(rows, (r) => r.sex === 'H'),
    banded: rows.reduce((n, r) => n + r.banded, 0),
    meatOz: rows.reduce((n, r) => n + r.count * meatOz(r.speciesId), 0),
    teal: sum(rows, (r) => TEAL.has(r.speciesId)),
    greenheads: sum(rows, (r) => r.speciesId === 'mall' && r.sex === 'D'),
    skunks: days.filter((d) => d.birds === 0).length,
    species: new Set(rows.filter((r) => r.count > 0).map((r) => r.speciesId)),
    bySpecies,
    biggestDay,
    firstDate: days[0]?.hunt.date ?? null,
  };
}

export function hunterStats(data: Data, hunterId: string, scope: Scope = {}): HunterStats {
  return statsFromDays(hunterDays(data, hunterId, scope));
}

export function partyMembers(data: Data, partyId: string): string[] {
  return data.hunters.filter((h) => h.partyId === partyId).map((h) => h.id);
}

export function partyStats(data: Data, partyId: string, scope: Scope = {}): HunterStats {
  return statsFromDays(groupDays(data, partyMembers(data, partyId), scope));
}

/** Cumulative birds by hunt date for a party's season. */
export function partyRaceSeries(data: Data, partyId: string, season: number): { date: string; total: number }[] {
  let total = 0;
  return groupDays(data, partyMembers(data, partyId), { season }).map((d) => ({ date: d.hunt.date, total: (total += d.birds) }));
}

export type DexEntry = { first: string; count: number; hunters: Set<string> };

/** Species anyone on this phone has ever logged, with the first date and who got it. */
export function dexEntries(data: Data): Map<string, DexEntry> {
  const huntDate = new Map(data.hunts.map((h) => [h.id, h.date]));
  const out = new Map<string, DexEntry>();
  for (const r of data.harvests) {
    if (r.count <= 0 || !SPECIES_BY_ID[r.speciesId]) continue;
    const date = huntDate.get(r.huntId) ?? '9999-12-31';
    const e = out.get(r.speciesId) ?? { first: date, count: 0, hunters: new Set<string>() };
    e.count += r.count;
    e.hunters.add(r.hunterId);
    if (date < e.first) e.first = date;
    out.set(r.speciesId, e);
  }
  return out;
}

export type BandRecord = { harvest: Harvest; date: string; key: string };

/** One entry per banded bird, newest first. */
export function bandTrophies(data: Data): BandRecord[] {
  const huntDate = new Map(data.hunts.map((h) => [h.id, h.date]));
  const out: BandRecord[] = [];
  for (const r of data.harvests)
    for (let i = 0; i < r.banded; i++)
      out.push({ harvest: r, date: huntDate.get(r.huntId) ?? '', key: `${r.id}:${i}` });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Cumulative birds by hunt date for a season, for the board's race chart. */
export function raceSeries(data: Data, hunterId: string, season: number): { date: string; total: number }[] {
  let total = 0;
  return hunterDays(data, hunterId, { season }).map((d) => ({ date: d.hunt.date, total: (total += d.birds) }));
}
