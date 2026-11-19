import { isArchivedSeason } from './archive';
import { HONORS, type HonorId } from './honors';
import { meatOz } from './meat';
import { seasonOf, todayISO } from './season';
import type { Data } from './types';
import { rowPoints } from './winner';

/**
 * Duck Season Slugfest: crews compare one season across phones. Each crew sends a
 * season card — just what the combined scoreboard needs, per hunter — by QR or
 * file. Cards are stored apart from your own data and never touch your stats,
 * badges or titles.
 */

export const SLUGFEST_KIND = 'duckbuster-slugfest';
export const SLUGFEST_VERSION = 1;

export type SlugHunter = {
  name: string;
  points: number;
  birds: number;
  hunts: number;
  species: number;
  bands: number;
  coots: number;
  meatOz: number;
};

export type SlugfestCard = {
  kind: typeof SLUGFEST_KIND;
  v: number;
  crewId: string;
  crewName: string;
  season: number;
  /** True once the season is over (archived). Otherwise it's "as of" `asOf`. */
  final: boolean;
  asOf: string;
  hunters: SlugHunter[];
};

/** This phone's season, boiled down to a card. Only hunters who went out make it. */
export function buildCard(data: Data, season: number, crewId: string, crewName: string, now = new Date()): SlugfestCard {
  const huntSeason = new Map(data.hunts.map((h) => [h.id, seasonOf(h.date)]));
  const hunters: SlugHunter[] = data.hunters
    .map((h) => {
      const hunts = new Set(
        data.huntHunters.filter((p) => p.hunterId === h.id && huntSeason.get(p.huntId) === season).map((p) => p.huntId),
      );
      const rows = data.harvests.filter((r) => r.hunterId === h.id && hunts.has(r.huntId));
      return {
        name: h.name,
        points: rows.reduce((n, r) => n + rowPoints(r), 0),
        birds: rows.reduce((n, r) => n + r.count, 0),
        hunts: hunts.size,
        species: new Set(rows.filter((r) => r.count > 0).map((r) => r.speciesId)).size,
        bands: rows.reduce((n, r) => n + r.banded, 0),
        coots: rows.reduce((n, r) => n + (r.speciesId === 'amco' ? r.count : 0), 0),
        meatOz: Math.round(rows.reduce((n, r) => n + r.count * meatOz(r.speciesId), 0)),
      };
    })
    .filter((h) => h.hunts > 0);
  return {
    kind: SLUGFEST_KIND,
    v: SLUGFEST_VERSION,
    crewId,
    crewName: crewName.trim(),
    season,
    final: isArchivedSeason(season, now),
    asOf: todayISO(now),
    hunters,
  };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Parse a received card; throws a readable error if it isn't one. */
export function parseCard(raw: unknown): SlugfestCard {
  const c = raw as Partial<SlugfestCard>;
  if (!c || c.kind !== SLUGFEST_KIND) throw new Error('That’s not a Slugfest season card.');
  if (!isNum(c.v) || c.v > SLUGFEST_VERSION) throw new Error('That card is from a newer Duck Buster. Update this phone first.');
  const ok =
    isStr(c.crewId) && isStr(c.crewName) && c.crewName.trim() && isNum(c.season) && typeof c.final === 'boolean' &&
    isStr(c.asOf) && /^\d{4}-\d{2}-\d{2}$/.test(c.asOf) &&
    Array.isArray(c.hunters) &&
    c.hunters.every((h) => isStr(h.name) && ['points', 'birds', 'hunts', 'species', 'bands', 'coots', 'meatOz'].every((k) => isNum((h as Record<string, unknown>)[k])));
  if (!ok) throw new Error('That season card is damaged.');
  return c as SlugfestCard;
}

export type SlugRow = SlugHunter & { crewId: string; crewName: string; final: boolean; asOf: string };

/** Every hunter from every compared crew, best first: points, then birds. */
export function combinedBoard(cards: SlugfestCard[]): SlugRow[] {
  return cards
    .flatMap((c) => c.hunters.map((h) => ({ ...h, crewId: c.crewId, crewName: c.crewName, final: c.final, asOf: c.asOf })))
    .sort((a, b) => b.points - a.points || b.birds - a.birds || a.name.localeCompare(b.name));
}

export type SlugTitle = { id: HonorId; title: string; icon: string; rows: SlugRow[]; value: number };

/** The season titles across all crews, with "Slugfest" in front. Ties share. */
export function slugfestTitles(board: SlugRow[]): SlugTitle[] {
  const scored = board.filter((r) => r.points > 0);
  const places: SlugRow[][] = [];
  for (const r of scored) {
    const last = places[places.length - 1];
    if (last && last[0].points === r.points && last[0].birds === r.birds) last.push(r);
    else places.push([r]);
  }
  const out: SlugTitle[] = [];
  (['first', 'second', 'third'] as const).forEach((id, i) => {
    if (places[i]) out.push({ id, title: `Slugfest ${HONORS[id].title}`, icon: HONORS[id].icon, rows: places[i], value: places[i][0].points });
  });
  const cootMax = Math.max(0, ...board.map((r) => r.coots));
  if (cootMax > 0) {
    out.push({ id: 'coots', title: `Slugfest ${HONORS.coots.title}`, icon: HONORS.coots.icon, rows: board.filter((r) => r.coots === cootMax), value: cootMax });
  }
  return out;
}

/** "FINAL SEASON RANKINGS" only when every compared season is over; otherwise the oldest as-of date. */
export function boardStatus(cards: SlugfestCard[]): { final: boolean; asOf: string | null } {
  if (cards.every((c) => c.final)) return { final: true, asOf: null };
  const dates = cards.filter((c) => !c.final).map((c) => c.asOf).sort();
  return { final: false, asOf: dates[0] ?? null };
}
