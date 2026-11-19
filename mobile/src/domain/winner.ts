import { SPECIES_BY_ID } from './species';
import type { Data, Harvest } from './types';

/**
 * Who won the hunt — and so who plays the day's round of the duck shoot.
 *
 * Points: drake 3, hen 2, geese 3, other unsexed birds 2, coots 0. Rare birds
 * add a bonus per bird (wood ducks and cans +2, other uncommon/rare birds +1/+2).
 * A band is an automatic win (it adds no points); if more than one hunter has a
 * band, most bands wins, then points. Ties: most birds, then party order.
 */

const BONUS: Record<string, number> = { wodu: 2, canv: 2, nopi: 1, amco: 0 };

export function bonusFor(speciesId: string): number {
  if (speciesId in BONUS) return BONUS[speciesId];
  const r = SPECIES_BY_ID[speciesId]?.rarity;
  return r === 'rare' ? 2 : r === 'uncommon' ? 1 : 0;
}

export function rowPoints(r: Harvest): number {
  if (r.speciesId === 'amco') return 0;
  const sp = SPECIES_BY_ID[r.speciesId];
  const base = r.sex === 'D' ? 3 : r.sex === 'H' ? 2 : sp?.group === 'goose' ? 3 : 2;
  return (base + bonusFor(r.speciesId)) * r.count;
}

export type HuntStanding = { hunterId: string; points: number; birds: number; bands: number };

/** Everyone on the hunt, best first. */
export function huntStandings(data: Data, huntId: string): HuntStanding[] {
  const party = data.huntHunters.filter((p) => p.huntId === huntId).map((p) => p.hunterId);
  const rows = data.harvests.filter((r) => r.huntId === huntId);
  const out = party.map((hunterId, order) => {
    const mine = rows.filter((r) => r.hunterId === hunterId);
    return {
      hunterId,
      order,
      points: mine.reduce((n, r) => n + rowPoints(r), 0),
      birds: mine.reduce((n, r) => n + r.count, 0),
      bands: mine.reduce((n, r) => n + r.banded, 0),
    };
  });
  out.sort((a, b) => b.bands - a.bands || b.points - a.points || b.birds - a.birds || a.order - b.order);
  return out.map(({ hunterId, points, birds, bands }) => ({ hunterId, points, birds, bands }));
}

/** The winner, or null when nobody got a bird (nobody wins a skunk). */
export function huntWinner(data: Data, huntId: string): HuntStanding | null {
  const top = huntStandings(data, huntId)[0];
  return top && (top.birds > 0 || top.bands > 0) ? top : null;
}
