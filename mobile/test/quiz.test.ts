import { describe, expect, it } from 'vitest';

import { CHOICES, makeChoices, makeRound } from '@/domain/quiz';
import { QUIZ_WEIGHT } from '@/domain/regs';
import { SPECIES, SPECIES_BY_ID } from '@/domain/species';

describe('quiz', () => {
  it('seven unique choices including the answer', () => {
    const c = makeChoices('gwte');
    expect(c).toHaveLength(CHOICES);
    expect(new Set(c).size).toBe(CHOICES);
    expect(c).toContain('gwte');
    expect(c.every((id) => SPECIES_BY_ID[id])).toBe(true);
  });

  it('only the right answer is fixed: the wrong ones change between asks', () => {
    for (const id of ['amco', 'gwte', 'fuwd']) {
      const sets = new Set(Array.from({ length: 30 }, () => makeChoices(id).filter((x) => x !== id).sort().join(',')));
      expect(sets.size).toBeGreaterThan(20);
    }
  });

  it('round uses only species with media and never repeats', () => {
    const r = makeRound(['mall', 'gwte', 'wodu'], ['mall', 'cago'], Math.random, 10);
    expect(r).toHaveLength(4);
    expect(new Set(r.map((q) => q.speciesId)).size).toBe(4);
    expect(r.find((q) => q.speciesId === 'cago')?.kind).toBe('audio');
    expect(r.find((q) => q.speciesId === 'wodu')?.kind).toBe('image');
  });
});

describe('quiz weighting', () => {
  it('common South Dakota birds come up far more than rarities', () => {
    let mall = 0;
    let kiei = 0;
    for (let i = 0; i < 400; i++) {
      const r = makeRound(['mall', 'kiei', 'gwte', 'gadw', 'bwte', 'wwsc', 'emgo', 'nopi'], [], Math.random, 3);
      if (r.some((q) => q.speciesId === 'mall')) mall++;
      if (r.some((q) => q.speciesId === 'kiei')) kiei++;
    }
    expect(mall).toBeGreaterThan(kiei * 4);
  });

  it('every quizzed species has a weight', () => {
    expect(SPECIES.map((s) => s.id).filter((id) => QUIZ_WEIGHT[id] == null)).toEqual([]);
  });
});
