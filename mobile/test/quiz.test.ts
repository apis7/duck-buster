import { describe, expect, it } from 'vitest';

import { CHOICES, makeChoices, makeRound } from '@/domain/quiz';
import { SPECIES_BY_ID } from '@/domain/species';

describe('quiz', () => {
  it('seven unique choices including the answer, look-alikes first', () => {
    const c = makeChoices('gwte');
    expect(c).toHaveLength(CHOICES);
    expect(new Set(c).size).toBe(CHOICES);
    expect(c).toContain('gwte');
    expect(c.filter((id) => SPECIES_BY_ID[id].group === 'dabbler').length).toBeGreaterThanOrEqual(4);
  });

  it('round uses only species with media and never repeats', () => {
    const r = makeRound(['mall', 'gwte', 'wodu'], ['mall', 'cago'], Math.random, 10);
    expect(r).toHaveLength(4);
    expect(new Set(r.map((q) => q.speciesId)).size).toBe(4);
    expect(r.find((q) => q.speciesId === 'cago')?.kind).toBe('audio');
    expect(r.find((q) => q.speciesId === 'wodu')?.kind).toBe('image');
  });
});
