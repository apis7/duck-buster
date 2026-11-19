import { describe, expect, it } from 'vitest';

import { seasonAwards } from '@/domain/awards';
import { speciesLeader, speciesLeads, withLeads } from '@/domain/leads';
import { rivalry } from '@/domain/rivalry';
import { seasonLabel, seasonOf } from '@/domain/season';
import { titleFor } from '@/domain/titles';
import { crewWrapped, seasonWrapped } from '@/domain/wrapped';

import { makeData } from './fixtures';

describe('season', () => {
  it('straddles new year', () => {
    expect(seasonOf('2026-09-01')).toBe(2026);
    expect(seasonOf('2027-01-20')).toBe(2026);
    expect(seasonLabel(2026)).toBe('2026–27');
  });
});

describe('awards, rivalry, wrapped, titles', () => {
  const d = makeData();
  const a = d.hunt('2026-10-01', ['dad', 'kid']);
  d.bird(a, 'dad', 'mall', 4);
  d.bird(a, 'kid', 'amco', 1, 'U');
  d.hunt('2026-10-02', ['kid']);
  const res = seasonAwards(d, 2026);
  const win = (id: string) => res.find((r) => r.award.id === id)?.winners;

  it('serious and roast', () => {
    expect(win('mvp')).toEqual(['dad']);
    expect(win('iron_man')).toEqual(['kid']);
    expect(win('mud_hen_mayor')).toEqual(['kid']);
    expect(win('bird_watcher')).toEqual(['kid']);
    expect(win('participation')).toEqual(['kid']);
    expect(win('fair_weather')).toEqual(['dad']);
  });

  it('roast skips a field of one', () => {
    const solo = makeData();
    solo.hunt('2026-10-01', ['dad']);
    expect(seasonAwards(solo, 2026).some((r) => r.award.id === 'participation')).toBe(false);
  });

  it('rivalry and wrapped', () => {
    const r = rivalry(d, 'dad', 'kid');
    expect(r.together).toBe(1);
    expect(r.aWins).toBe(1);
    expect(r.rows.map((x) => x.label)).toContain('Duck shoot high');
    const withBadges = rivalry(d, 'dad', 'kid', {}, new Map([['dad', ['a', 'b']]]));
    expect(withBadges.rows.find((x) => x.label === 'Badges')).toMatchObject({ a: 2, b: 0 });
    const cards = seasonWrapped(d, 'dad', 2026, 'Decoy');
    expect(cards[0].big).toBe('1');
    expect(cards.at(-1)?.big).toBe('Decoy');
    const crew = crewWrapped(d, 2026, () => 'Decoy');
    expect(crew[0].id).toBe('hunts');
    expect(crew[0].rows.map((r) => r.hunterId).sort()).toEqual(['dad', 'kid']);
    expect(crew.at(-1)?.id).toBe('title');
    // Both finished as 'Decoy' with the same sign-off: shared taglines are dropped.
    expect(crew.at(-1)?.rows.every((r) => r.caption === '')).toBe(true);
  });

  it('titles', () => {
    expect(titleFor(0).name).toBe('Decoy');
    expect(titleFor(10).name).toBe('Mud Wader');
    expect(titleFor(5000).next).toBeNull();
  });
});

describe('species leads', () => {
  it('one leader per species, ties lead nobody', () => {
    const d = makeData();
    const h = d.hunt('2026-10-01', ['dad', 'kid']);
    d.bird(h, 'dad', 'mall', 4);
    d.bird(h, 'kid', 'mall', 1);
    d.bird(h, 'dad', 'gadw', 2);
    d.bird(h, 'kid', 'gadw', 2);
    const leads = speciesLeads(d);
    const all = Array.from(leads.values()).flat();
    expect(all.length).toBeGreaterThan(0);
    const ids = all.map((l) => l.speciesId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of all) {
      const top = speciesLeader(d, l.speciesId);
      expect(top?.hunterIds.length).toBe(1);
      expect(top?.count).toBe(l.count);
    }
    expect(leads.get('dad')).toEqual([{ speciesId: 'mall', count: 4 }]);
    expect(speciesLeader(d, 'gadw')?.hunterIds).toEqual(['dad', 'kid']);
    const merged = withLeads(new Map(), leads);
    expect(Array.from(merged.values()).flat().every((id) => id.startsWith('lead:'))).toBe(true);
  });
});
