import { describe, expect, it } from 'vitest';

import { earnedBadges } from '@/domain/badges';

import { makeData } from './fixtures';

describe('badges', () => {
  it('skunk streaks', () => {
    const d = makeData();
    d.hunt('2026-10-01', ['dad']);
    d.hunt('2026-10-02', ['dad']);
    d.hunt('2026-10-03', ['dad']);
    const b = earnedBadges(d, 'dad');
    expect(b).toEqual(expect.arrayContaining(['boots_wet', 'skunked', 'double_skunk', 'bird_watcher', 'iron_butt']));
    expect(b).not.toContain('first_bird');
  });

  it('teal deal, greenhead, gentleman, top gun', () => {
    const d = makeData();
    const h = d.hunt('2026-10-10', ['dad', 'kid']);
    d.bird(h, 'dad', 'gwte', 3);
    d.bird(h, 'dad', 'bwte', 2);
    d.bird(h, 'kid', 'mall', 1, 'D');
    expect(earnedBadges(d, 'dad')).toEqual(expect.arrayContaining(['teal_deal', 'gentlemans_limit', 'top_gun']));
    expect(earnedBadges(d, 'kid')).toContain('greenhead');
    expect(earnedBadges(d, 'kid')).not.toContain('top_gun');
  });

  it('got carried and bands', () => {
    const d = makeData();
    const h = d.hunt('2026-11-01', ['dad', 'kid']);
    d.bird(h, 'dad', 'mall', 5, 'D', 2);
    expect(earnedBadges(d, 'kid')).toContain('got_carried');
    expect(earnedBadges(d, 'dad')).toEqual(expect.arrayContaining(['jewelry', 'double_bling']));
  });

  it('grand slam needs one season', () => {
    const d = makeData();
    const a = d.hunt('2026-10-01', ['dad']);
    d.bird(a, 'dad', 'mall');
    d.bird(a, 'dad', 'nopi');
    const b = d.hunt('2027-01-10', ['dad']);
    d.bird(b, 'dad', 'amwi');
    d.bird(b, 'dad', 'gwte');
    expect(earnedBadges(d, 'dad')).toContain('grand_slam');

    const e = makeData();
    const c = e.hunt('2025-10-01', ['dad']);
    e.bird(c, 'dad', 'mall');
    e.bird(c, 'dad', 'nopi');
    const f = e.hunt('2026-10-01', ['dad']);
    e.bird(f, 'dad', 'amwi');
    e.bird(f, 'dad', 'gwte');
    expect(earnedBadges(e, 'dad')).not.toContain('grand_slam');
  });

  it('holidays', () => {
    const d = makeData();
    d.bird(d.hunt('2026-11-26', ['dad']), 'dad', 'mall');
    d.bird(d.hunt('2026-12-25', ['dad']), 'dad', 'mall');
    expect(earnedBadges(d, 'dad')).toEqual(expect.arrayContaining(['not_a_turkey', 'christmas_duck']));
  });
});
