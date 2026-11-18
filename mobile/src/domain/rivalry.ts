import { partyBirdsFor } from './badges';
import { hunterDays, statsFromDays, type Scope } from './stats';
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

export function rivalry(data: Data, a: string, b: string, scope: Scope = {}): Rivalry {
  const sa = statsFromDays(hunterDays(data, a, scope));
  const sb = statsFromDays(hunterDays(data, b, scope));
  const rows: TapeRow[] = [
    { label: 'Birds', a: sa.birds, b: sb.birds },
    { label: 'Hunts', a: sa.hunts, b: sb.hunts },
    { label: 'Biggest day', a: sa.biggestDay?.birds ?? 0, b: sb.biggestDay?.birds ?? 0 },
    { label: 'Species', a: sa.species.size, b: sb.species.size },
    { label: 'Greenheads', a: sa.greenheads, b: sb.greenheads },
    { label: 'Bands', a: sa.banded, b: sb.banded },
    { label: 'Geese', a: sa.geese, b: sb.geese },
    { label: 'Skunks', a: sa.skunks, b: sb.skunks, lowerWins: true },
  ];

  const party = partyBirdsFor(data);
  let together = 0;
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  for (const d of hunterDays(data, a, scope)) {
    if (!d.party.includes(b)) continue;
    together++;
    const birds = party(d.hunt.id);
    const na = birds.get(a) ?? 0;
    const nb = birds.get(b) ?? 0;
    if (na > nb) aWins++;
    else if (nb > na) bWins++;
    else ties++;
  }
  return { rows, together, aWins, bWins, ties };
}
