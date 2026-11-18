import { describe, expect, it } from 'vitest';

import { formatMeat, meatOz } from '@/domain/meat';
import { groupRivalry } from '@/domain/rivalry';
import { searchSpecies } from '@/domain/search';
import { registerCustomSpecies, SPECIES_BY_ID } from '@/domain/species';
import { hunterStats, partyMembers, partyStats } from '@/domain/stats';
import { pickPartyColor, PARTY_COLORS } from '@/state/partyColors';

import { makeData } from './fixtures';

describe('parties', () => {
  const d = makeData();
  const a = d.hunt('2026-10-01', ['dad', 'kid', 'unc']);
  d.bird(a, 'dad', 'mall', 2);
  d.bird(a, 'kid', 'gwte', 3);
  d.bird(a, 'unc', 'cago', 1, 'U');
  d.hunt('2026-10-02', ['unc']);

  it('party stats add up their members, counting each hunt once', () => {
    const home = partyStats(d, 'home');
    expect(partyMembers(d, 'home')).toEqual(['dad', 'kid']);
    expect(home.birds).toBe(5);
    expect(home.hunts).toBe(1);
    const away = partyStats(d, 'away');
    expect(away.birds).toBe(1);
    expect(away.hunts).toBe(2);
    expect(away.skunks).toBe(1);
  });

  it('party rivalry: shared hunt goes to the side that shot more', () => {
    const r = groupRivalry(d, partyMembers(d, 'home'), partyMembers(d, 'away'));
    expect(r.together).toBe(1);
    expect(r.aWins).toBe(1);
  });

  it('meat: rough edible ounces add up, goose counts big', () => {
    expect(hunterStats(d, 'unc').meatOz).toBe(meatOz('cago'));
    expect(meatOz('cago')).toBeGreaterThan(meatOz('mall'));
    expect(meatOz('mall')).toBeGreaterThan(meatOz('gwte'));
    expect(formatMeat(8)).toBe('≈ 8 oz');
    expect(formatMeat(40)).toBe('≈ 2.5 lb');
  });
});

describe('party colors', () => {
  it('picks an unused color, then still unique once all are taken', () => {
    const c = pickPartyColor(PARTY_COLORS.slice(1));
    expect(c).toBe(PARTY_COLORS[0]);
    const extra = pickPartyColor(PARTY_COLORS);
    expect(PARTY_COLORS).not.toContain(extra);
  });
});

describe('custom birds', () => {
  it('are searchable once added, and the list can change', () => {
    registerCustomSpecies([{ id: 'c_1', name: 'Tundra Swan', sexed: false }]);
    expect(searchSpecies('tundra')[0].id).toBe('c_1');
    expect(SPECIES_BY_ID.c_1.sexed).toBe(false);
    registerCustomSpecies([]);
    expect(SPECIES_BY_ID.c_1).toBeUndefined();
    expect(searchSpecies('tundra').some((s) => s.id === 'c_1')).toBe(false);
  });
});
