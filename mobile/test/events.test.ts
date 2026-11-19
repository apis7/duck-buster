import { describe, expect, it } from 'vitest';

import { applyHit, fire, GAME_SECONDS, ghostShowing, makeBird, newGame, step, type GameState } from '@/game/engine';
import { gameDay, isFullMoon, NO_FX, type GameFx } from '@/game/events';
import { gameLayout } from '@/game/layout';

const calm = () => 0.99; // no random blizzard

describe('event calendar', () => {
  it.each([
    ['2026-09-26', 'opener'], // last Saturday of September 2026
    ['2026-09-27', 'opener'],
    ['2026-10-17', 'pheasants'], // 3rd Saturday of October 2026
    ['2026-10-28', 'ghosts'],
    ['2026-11-24', 'turkey'], // Thanksgiving week (Thu Nov 26)
    ['2026-12-31', 'midnight'],
    ['2027-01-01', 'midnight'],
    ['2027-03-01', 'snowOrder'],
    ['2027-03-17', 'lucky'],
    ['2027-07-04', 'eagle'],
  ] as [string, keyof GameFx][])('%s turns on %s', (date, flag) => {
    expect(gameDay(date, calm).fx[flag]).toBeTruthy();
  });

  it('an ordinary day has no events', () => {
    const d = gameDay('2026-08-12', calm);
    expect(Object.values({ ...d.fx, wind: 0 }).some(Boolean)).toBe(false);
  });

  it('Halloween and St. Patrick get their own looks; New Year keeps Christmas and adds fireworks', () => {
    expect(gameDay('2026-10-30', calm).theme.pumpkins).toBe(true);
    expect(gameDay('2027-03-17', calm).theme.rainbow).toBe(true);
    const ny = gameDay('2026-12-31', calm).theme;
    expect(ny.trees && ny.fireworks).toBe(true);
  });

  it('blizzards only in snow season, at random', () => {
    expect(gameDay('2027-01-20', () => 0.1).fx.wind).not.toBe(0);
    expect(gameDay('2026-08-12', () => 0.1).fx.wind).toBe(0);
  });

  it('full moon', () => {
    expect(isFullMoon('2024-01-25')).toBe(true);
    expect(isFullMoon('2024-01-11')).toBe(false);
  });
});

describe('event birds', () => {
  const game = (fx: Partial<GameFx> = {}): GameState => {
    const s = newGame(400, 800, gameLayout(400, 800, 24, 48), false, { ...NO_FX, ...fx });
    s.nextFlock = 999;
    return s;
  };

  it('rooster +4, hen pheasant −3, turkey −2', () => {
    const s = game();
    const rooster = makeBird(s, 'pheasant', 0, 0, 0);
    const hen = makeBird(s, 'pheasant', 0, 0, 0, { hen: true });
    const turkey = makeBird(s, 'turkey', 0, 0, 0);
    s.birds.push(rooster, hen, turkey);
    applyHit(s, rooster, 'body', 0, 0);
    applyHit(s, hen, 'body', 0, 0);
    applyHit(s, turkey, 'body', 0, 0);
    expect(s.score).toBe(4 - 3 - 2);
    expect(s.events.some((e) => e.k === 'turkey')).toBe(true);
  });

  it('shooting the eagle ends the round', () => {
    const s = game();
    const e = makeBird(s, 'eagle', 0, 0, 0);
    s.birds.push(e);
    applyHit(s, e, 'body', 0, 0);
    expect(s.over).toBe(true);
  });

  it('ghost ducks flicker', () => {
    const s = game();
    const g = makeBird(s, 'duck', 0, 0, 0, { ghost: true });
    const seen = new Set<boolean>();
    for (let t = 0; t < 4; t += 0.05) seen.add(ghostShowing(g, t));
    expect(seen.size).toBe(2);
  });

  it('a blizzard drifts shots sideways', () => {
    const s = game({ wind: 80 });
    fire(s);
    const startVx = s.bullets[0].vx;
    step(s, 1 / 60);
    expect(s.bullets[0].vx).toBeGreaterThan(startVx);
  });

  it("New Year's: the last 3 seconds count double", () => {
    const s = game({ midnight: true });
    while (s.t < GAME_SECONDS - 2) step(s, 1 / 60);
    const d = makeBird(s, 'duck', 0, 0, 0);
    s.birds.push(d);
    const before = s.score;
    applyHit(s, d, 'ko', 0, 0);
    expect(s.score - before).toBe(6);
  });

  it('pheasants flush from the reeds on the opener', () => {
    const s = game({ pheasants: true });
    let saw = false;
    for (let i = 0; i < 5 * 60; i++) {
      step(s, 1 / 60);
      if (s.birds.some((b) => b.kind === 'pheasant')) saw = true;
    }
    expect(saw).toBe(true);
  });
});
