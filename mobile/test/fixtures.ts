import type { Data, Harvest, Sex } from '@/domain/types';

let n = 0;

export function makeData(): Data & {
  hunt: (date: string, party: string[]) => string;
  bird: (huntId: string, hunterId: string, speciesId: string, count?: number, sex?: Sex, banded?: number) => void;
} {
  const data: Data = {
    hunters: [
      { id: 'dad', name: 'Dad', color: '#000', partyId: 'home', createdAt: 0 },
      { id: 'kid', name: 'Kid', color: '#000', partyId: 'home', createdAt: 0 },
      { id: 'unc', name: 'Uncle', color: '#000', partyId: 'away', createdAt: 0 },
    ],
    parties: [
      { id: 'home', name: 'Home Team', color: '#F00', createdAt: 0 },
      { id: 'away', name: 'Uncle Gang', color: '#00F', createdAt: 0 },
    ],
    customSpecies: [],
    hunts: [],
    huntHunters: [],
    harvests: [],
    gameScores: [],
    slugfest: [],
  };
  return Object.assign(data, {
    hunt(date: string, party: string[]) {
      const id = `h${++n}`;
      data.hunts.push({ id, date, createdAt: n });
      for (const p of party) data.huntHunters.push({ huntId: id, hunterId: p });
      return id;
    },
    bird(huntId: string, hunterId: string, speciesId: string, count = 1, sex: Sex = 'D', banded = 0) {
      const row: Harvest = { id: `r${++n}`, huntId, hunterId, speciesId, sex, count, banded };
      data.harvests.push(row);
    },
  });
}
