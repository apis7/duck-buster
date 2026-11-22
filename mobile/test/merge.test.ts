import { describe, expect, it } from 'vitest';

import { prepareMerge } from '../src/domain/merge';
import type { Data } from '../src/domain/types';
import { makeData } from './fixtures';

/** Apply rows the way importRows does: upsert by id; a written hunt replaces its party and birds. */
function apply(here: Data, rows: Data): Data {
  const up = <T extends { id: string }>(a: T[], b: T[]) => [...a.filter((x) => !b.some((y) => y.id === x.id)), ...b];
  const written = new Set(rows.hunts.map((h) => h.id));
  return {
    hunters: up(here.hunters, rows.hunters),
    parties: up(here.parties, rows.parties),
    customSpecies: up(here.customSpecies, rows.customSpecies),
    hunts: up(here.hunts, rows.hunts),
    huntHunters: [...here.huntHunters.filter((p) => !written.has(p.huntId)), ...rows.huntHunters],
    harvests: [...here.harvests.filter((r) => !written.has(r.huntId)), ...rows.harvests],
    gameScores: up(here.gameScores, rows.gameScores),
    slugfest: here.slugfest,
  };
}

/** The same crew, entered separately on another phone (different ids). */
function otherPhone() {
  const d = makeData();
  d.hunters = [
    { id: 'x-dad', name: 'dad ', color: '#111', partyId: 'x-home', createdAt: 9 },
    { id: 'x-roz', name: 'Roz', color: '#222', partyId: null, createdAt: 9 },
  ];
  d.parties = [{ id: 'x-home', name: 'HOME TEAM', color: '#0F0', createdAt: 9 }];
  return d;
}

describe('restore with merge', () => {
  it('a backup from this phone updates in place', () => {
    const here = makeData();
    const h = here.hunt('2026-11-01', ['dad']);
    here.bird(h, 'dad', 'mall', 2);
    const backup = JSON.parse(JSON.stringify(here)) as Data;
    const out = apply(here, prepareMerge(here, backup));
    expect(out.hunters).toHaveLength(3);
    expect(out.hunts).toHaveLength(1);
    expect(out.harvests.reduce((n, r) => n + r.count, 0)).toBe(2);
  });

  it('matches hunters and parties by name instead of duplicating them', () => {
    const here = makeData();
    const other = otherPhone();
    const h = other.hunt('2026-11-08', ['x-dad', 'x-roz']);
    other.bird(h, 'x-dad', 'gwte', 3);
    const out = apply(here, prepareMerge(here, other));
    expect(out.hunters.map((x) => x.name).sort()).toEqual(['Dad', 'Kid', 'Roz', 'Uncle']);
    expect(out.parties).toHaveLength(2);
    expect(out.harvests.find((r) => r.speciesId === 'gwte')?.hunterId).toBe('dad');
    expect(out.hunters.find((x) => x.name === 'Roz')?.partyId).toBeNull();
  });

  it('joins a same-day hunt: entries here stay, new hunters are added', () => {
    const here = makeData();
    const mine = here.hunt('2026-11-15', ['dad', 'kid']);
    here.bird(mine, 'dad', 'mall', 4);
    const other = otherPhone();
    const theirs = other.hunt('2026-11-15', ['x-dad', 'x-roz']);
    other.bird(theirs, 'x-dad', 'mall', 1); // Dad's already logged here: ignored
    other.bird(theirs, 'x-roz', 'wodu', 2);
    const out = apply(here, prepareMerge(here, other));
    expect(out.hunts.filter((h) => h.date === '2026-11-15')).toHaveLength(1);
    const party = out.huntHunters.filter((p) => p.huntId === mine).map((p) => p.hunterId).sort();
    expect(party).toEqual(['dad', 'kid', 'x-roz']);
    const birds = out.harvests.filter((r) => r.huntId === mine);
    expect(birds.filter((r) => r.hunterId === 'dad').reduce((n, r) => n + r.count, 0)).toBe(4);
    expect(birds.find((r) => r.hunterId === 'x-roz')?.count).toBe(2);
  });

  it('keeps one duck-shoot round per hunt', () => {
    const here = makeData();
    const mine = here.hunt('2026-11-15', ['dad']);
    here.gameScores.push({ id: 'g-here', huntId: mine, hunterId: 'dad', date: '2026-11-15', score: 30, shots: 1, hits: 1, kos: 0, geese: 0, swans: 0, coots: 0, bands: 0, createdAt: 1 });
    const other = otherPhone();
    const theirs = other.hunt('2026-11-15', ['x-roz']);
    const later = other.hunt('2026-11-16', ['x-roz']);
    for (const [id, huntId] of [['g1', theirs], ['g2', later]] as const)
      other.gameScores.push({ id, huntId, hunterId: 'x-roz', date: '2026-11-15', score: 50, shots: 1, hits: 1, kos: 0, geese: 0, swans: 0, coots: 0, bands: 0, createdAt: 2 });
    const rows = prepareMerge(here, other);
    expect(rows.gameScores.map((g) => g.id)).toEqual(['g2']);
  });
});
