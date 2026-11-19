import { describe, expect, it } from 'vitest';

import { boardStatus, buildCard, combinedBoard, parseCard, slugfestTitles } from '@/domain/slugfest';

import { makeData } from './fixtures';

function crewA() {
  const d = makeData();
  const h = d.hunt('2026-10-01', ['dad', 'kid']);
  d.bird(h, 'dad', 'mall', 4, 'D'); // 12
  d.bird(h, 'kid', 'amco', 3, 'U'); // 0 points, 3 coots
  return d;
}

function crewB() {
  const d = makeData();
  const h = d.hunt('2026-10-02', ['dad', 'unc']);
  d.bird(h, 'dad', 'mall', 3, 'D'); // 9
  d.bird(h, 'unc', 'wodu', 3, 'D'); // 15
  return d;
}

describe('slugfest', () => {
  const july = new Date(2027, 6, 5);
  const nov = new Date(2026, 10, 20);
  const a = buildCard(crewA(), 2026, 'crew-a', 'Johnson Blind', july);
  const b = buildCard(crewB(), 2026, 'crew-b', 'The Cousins', nov);

  it('cards carry just the scoreboard numbers per hunter', () => {
    expect(a.hunters.map((h) => h.name)).toEqual(['Dad', 'Kid']);
    expect(a.hunters[0]).toMatchObject({ points: 12, birds: 4, hunts: 1 });
    expect(Object.keys(a.hunters[0]).sort()).toEqual(['bands', 'birds', 'coots', 'hunts', 'meatOz', 'name', 'points', 'species']);
    expect(a.final).toBe(true);
    expect(b.final).toBe(false);
  });

  it('combined board ranks every hunter from every crew; same names stay apart by crew', () => {
    const board = combinedBoard([a, b]);
    expect(board.map((r) => `${r.name}·${r.crewName}`)).toEqual(['Uncle·The Cousins', 'Dad·Johnson Blind', 'Dad·The Cousins', 'Kid·Johnson Blind']);
  });

  it('titles get the Slugfest prefix', () => {
    const t = slugfestTitles(combinedBoard([a, b]));
    expect(t.find((x) => x.id === 'first')?.title).toBe('Slugfest Grand Poombah of the Ducksters, Supreme Anatid Overlord');
    expect(t.find((x) => x.id === 'first')?.rows[0].name).toBe('Uncle');
    expect(t.find((x) => x.id === 'coots')?.rows[0].crewName).toBe('Johnson Blind');
  });

  it('status: final only when every season is over, else the oldest as-of date', () => {
    expect(boardStatus([a])).toEqual({ final: true, asOf: null });
    expect(boardStatus([a, b])).toEqual({ final: false, asOf: '2026-11-20' });
  });

  it('round-trips through JSON and rejects junk', () => {
    expect(parseCard(JSON.parse(JSON.stringify(a)))).toEqual(a);
    expect(() => parseCard({ kind: 'nope' })).toThrow();
    expect(() => parseCard({ ...a, v: 99 })).toThrow(/newer/);
  });
});
