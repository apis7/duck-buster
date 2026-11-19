import { describe, expect, it } from 'vitest';

import { honorsFor, seasonHonors } from '@/domain/honors';

import { makeData } from './fixtures';

describe('season titles', () => {
  const d = makeData();
  const a = d.hunt('2026-10-01', ['dad', 'kid', 'unc']);
  d.bird(a, 'dad', 'mall', 4, 'D'); // 12 points
  d.bird(a, 'kid', 'mall', 3, 'H'); // 6 points
  d.bird(a, 'unc', 'gwte', 1, 'D'); // 3 points
  d.bird(a, 'unc', 'amco', 2, 'U'); // coots: 0 points

  it('places 1-2-3 by season points', () => {
    const h = seasonHonors(d, 2026);
    expect(h.find((x) => x.id === 'first')?.hunterIds).toEqual(['dad']);
    expect(h.find((x) => x.id === 'second')?.hunterIds).toEqual(['kid']);
    expect(h.find((x) => x.id === 'third')?.hunterIds).toEqual(['unc']);
  });

  it('the coot title stacks with a place', () => {
    const titles = honorsFor(d, 'unc', [2026]).map((x) => x.id);
    expect(titles).toEqual(expect.arrayContaining(['third', 'coots']));
  });

  it('no coots, no coot title; ties share a place', () => {
    const e = makeData();
    const b = e.hunt('2026-10-01', ['dad', 'kid']);
    e.bird(b, 'dad', 'mall', 2, 'D');
    e.bird(b, 'kid', 'mall', 2, 'D');
    const h = seasonHonors(e, 2026);
    expect(h.find((x) => x.id === 'first')?.hunterIds).toEqual(['dad', 'kid']);
    expect(h.some((x) => x.id === 'coots')).toBe(false);
  });
});
