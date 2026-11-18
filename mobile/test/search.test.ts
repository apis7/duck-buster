import { describe, expect, it } from 'vitest';

import { searchSpecies } from '@/domain/search';

const top = (q: string) => searchSpecies(q)[0]?.id;

describe('species search', () => {
  it.each([
    ['gwt', 'gwte'],
    ['gwte', 'gwte'],
    ['bwt', 'bwte'],
    ['green wing', 'gwte'],
    ['mall', 'mall'],
    ['malard', 'mall'],
    ['greenhead', 'mall'],
    ['spoonie', 'nsho'],
    ['sprig', 'nopi'],
    ['can', 'canv'],
    ['woodie', 'wodu'],
    ['honker', 'cago'],
    ['speck', 'gwfg'],
    ['mud hen', 'amco'],
    ['oldsquaw', 'ltdu'],
    ['ringneck', 'rndu'],
  ])('%s → %s', (q, id) => expect(top(q)).toBe(id));

  it('teal matches all three teal', () => {
    const ids = searchSpecies('teal').map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['bwte', 'gwte', 'cite']));
  });

  it('usage breaks ties', () => {
    expect(searchSpecies('bluebill', { grsc: 5 })[0].id).toBe('grsc');
    expect(searchSpecies('bluebill', { lesc: 5 })[0].id).toBe('lesc');
  });

  it('empty query gives quick picks, most-used first', () => {
    expect(searchSpecies('', { buff: 3 })[0].id).toBe('buff');
  });
});
