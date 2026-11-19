import { partyBirdsFor } from './badges';
import { gamesFor, gameStats } from './gameStats';
import { groupDays, statsFromDays, type Scope } from './stats';
import type { Data } from './types';

/** Tale of the tape: two hunters side by side, plus who outshot whom when they hunted together. */

export type TapeRow = { label: string; a: number; b: number; lowerWins?: boolean };

export type Rivalry = {
  rows: TapeRow[];
  together: number;
  aWins: number;
  bWins: number;
  ties: number;
};

/** Hunter vs hunter. */
export function rivalry(data: Data, a: string, b: string, scope: Scope = {}, badges?: Map<string, string[]>): Rivalry {
  return groupRivalry(data, [a], [b], scope, badges);
}

/**
 * Side vs side, where a side is one hunter or a whole party. "Together" counts
 * hunts where both sides had someone in the blind; the side whose people shot
 * more that day takes it.
 */
export function groupRivalry(data: Data, a: string[], b: string[], scope: Scope = {}, badges?: Map<string, string[]>): Rivalry {
  const sa = statsFromDays(groupDays(data, a, scope));
  const sb = statsFromDays(groupDays(data, b, scope));
  const rows: TapeRow[] = [
    { label: 'Birds', a: sa.birds, b: sb.birds },
    { label: 'Hunts', a: sa.hunts, b: sb.hunts },
    { label: 'Biggest day', a: sa.biggestDay?.birds ?? 0, b: sb.biggestDay?.birds ?? 0 },
    { label: 'Species', a: sa.species.size, b: sb.species.size },
    { label: 'Greenheads', a: sa.greenheads, b: sb.greenheads },
    { label: 'Bands', a: sa.banded, b: sb.banded },
    { label: 'Geese', a: sa.geese, b: sb.geese },
    { label: 'Meat (lb)', a: Math.round(sa.meatOz / 16), b: Math.round(sb.meatOz / 16) },
    { label: 'Skunks', a: sa.skunks, b: sb.skunks, lowerWins: true },
  ];
  // The duck shoot: winners' rounds only (practice never counts).
  const ga = gameStats(a.flatMap((id) => gamesFor(data, id, scope)));
  const gb = gameStats(b.flatMap((id) => gamesFor(data, id, scope)));
  rows.push({ label: 'Duck shoot high', a: ga.best, b: gb.best }, { label: 'Duck shoot total', a: ga.total, b: gb.total });
  // Badges earned in the same window (see archive.seasonBadges).
  if (badges) {
    const count = (side: string[]) => side.reduce((n, id) => n + (badges.get(id)?.length ?? 0), 0);
    rows.push({ label: 'Badges', a: count(a), b: count(b) });
  }

  const party = partyBirdsFor(data);
  let together = 0;
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  const total = (birds: Map<string, number>, side: string[]) => side.reduce((n, id) => n + (birds.get(id) ?? 0), 0);
  for (const d of groupDays(data, a, scope)) {
    if (!d.party.some((p) => b.includes(p))) continue;
    together++;
    const birds = party(d.hunt.id);
    const na = total(birds, a);
    const nb = total(birds, b);
    if (na > nb) aWins++;
    else if (nb > na) bWins++;
    else ties++;
  }
  return { rows, together, aWins, bWins, ties };
}
