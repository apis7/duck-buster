import { describe, expect, it } from 'vitest';

import { applyHit, makeBird, multLeft, newGame, PARTRIDGE_POINTS, step } from '@/game/engine';
import { gameLayout } from '@/game/layout';
import { NO_FX } from '@/game/events';
import { themeFor } from '@/game/theme';

describe('seasonal marsh', () => {
  it.each([
    ['2026-07-15', 'summer'],
    ['2026-09-20', 'early-fall'],
    ['2026-10-20', 'fall'],
    ['2026-11-28', 'fall'],
    ['2026-12-10', 'winter'],
    ['2026-12-25', 'christmas'],
    ['2027-01-06', 'christmas'],
    ['2027-01-07', 'winter'],
    ['2027-02-20', 'winter'],
    ['2027-04-01', 'summer'],
  ])('%s → %s', (date, id) => expect(themeFor(date).id).toBe(id));

  it('only Christmas has trees and the partridge; winter and Christmas have snow', () => {
    expect(themeFor('2026-12-26')).toMatchObject({ trees: true, partridge: true, snow: true });
    expect(themeFor('2027-01-20')).toMatchObject({ trees: false, partridge: false, snow: true });
    expect(themeFor('2026-10-20')).toMatchObject({ trees: false, partridge: false, snow: false });
  });
});

describe('partridge in a pear tree', () => {
  const game = () => {
    const s = newGame(400, 800, gameLayout(400, 800, 24, 48), false, NO_FX);
    s.nextFlock = 999;
    return s;
  };

  it('never flies outside the Christmas season', () => {
    for (let i = 0; i < 50; i++) expect(newGame(400, 800, gameLayout(400, 800, 24, 48), false, NO_FX).partridgeAt).toBe(Infinity);
  });

  it('scores 5, then 1.5× for 5 seconds', () => {
    const s = game();
    const p = makeBird(s, 'partridge', 100, 200, 0);
    s.birds.push(p);
    applyHit(s, p, 'body', 0, 0);
    expect(s.score).toBe(PARTRIDGE_POINTS);
    expect(multLeft(s)).toBe(5);

    const drake = makeBird(s, 'duck', 100, 200, 0);
    s.birds.push(drake);
    applyHit(s, drake, 'ko', 0, 0);
    expect(s.score).toBe(PARTRIDGE_POINTS + 5); // 3 × 1.5 rounds to 5

    for (let i = 0; i < 6 * 60; i++) step(s, 1 / 60);
    expect(multLeft(s)).toBe(0);
    const later = makeBird(s, 'duck', 100, 200, 0);
    s.birds.push(later);
    applyHit(s, later, 'ko', 0, 0);
    expect(s.score).toBe(PARTRIDGE_POINTS + 5 + 3);
  });
});
