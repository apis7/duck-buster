import { describe, expect, it } from 'vitest';

import { applyHit, finished, fire, GAME_SECONDS, MAX_ROUND_SECONDS, ghostShowing, makeBird, newGame, step, type GameState } from '@/game/engine';
import { gameDay, isFullMoon, NO_FX, practiceDay, type GameFx } from '@/game/events';
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
    fire(s);
    expect(s.bullets).toHaveLength(0);
  });

  it('the gun keeps firing after the buzzer while birds are still leaving', () => {
    const s = game();
    while (!s.over) step(s, 1 / 60);
    fire(s);
    expect(s.bullets).toHaveLength(1);
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

describe('feast days', () => {
  const game = (fx: Partial<GameFx> = {}): GameState => {
    const s = newGame(400, 800, gameLayout(400, 800, 24, 48), false, { ...NO_FX, ...fx });
    s.nextFlock = 999;
    s.stagAt = Infinity;
    return s;
  };

  it('Lenten Friday: every bird is −1', () => {
    const s = game({ lent: true });
    const d = makeBird(s, 'duck', 0, 0, 0);
    s.birds.push(d);
    applyHit(s, d, 'ko', 0, 0);
    expect(s.score).toBe(-1);
  });

  it('Martinmas: geese ×3 (13 → 39)', () => {
    const s = game({ geeseFeast: true });
    const g = makeBird(s, 'goose', 0, 0, 0);
    s.birds.push(g);
    for (let i = 0; i < 4; i++) applyHit(s, g, 'ko', 0, 0);
    expect(s.score).toBe(39);
  });

  it('St. Hubert: shoot the stag and the score is halved; let it pass and points triple', () => {
    const a = game({ hubert: true });
    a.score = 20;
    const stag = makeBird(a, 'stag', 0, 0, 0);
    a.birds.push(stag);
    applyHit(a, stag, 'body', 0, 0);
    expect(a.score).toBe(10);

    const b = game({ hubert: true });
    const passing = makeBird(b, 'stag', b.width - 5, 600, 60);
    b.birds.push(passing);
    for (let i = 0; i < 30; i++) step(b, 1 / 60);
    expect(b.blessed).toBe(true);
    const d = makeBird(b, 'duck', 0, 0, 0);
    b.birds.push(d);
    applyHit(b, d, 'ko', 0, 0);
    expect(b.score).toBe(9);
    expect(b.bonuses['St. Hubert’s blessing ×3']).toBe(6);
  });

  it('the summary rows add up to the score', () => {
    const s = game({ hubert: true, partridge: true, candles: true });
    s.score = 0;
    const p = makeBird(s, 'partridge', 0, 0, 0);
    s.birds.push(p);
    applyHit(s, p, 'body', 0, 0);
    const d = makeBird(s, 'duck', 0, 0, 0);
    s.birds.push(d);
    applyHit(s, d, 'body', 0, 0);
    applyHit(s, d, 'body', 0, 0);
    const stag = makeBird(s, 'stag', 0, 0, 0);
    s.birds.push(stag);
    applyHit(s, stag, 'body', 0, 0);
    while (!s.over || !s.finalized) step(s, 1 / 60);
    const rows = Object.values(s.tally).reduce((a, r) => a + r.pts, 0);
    const bonus = Object.values(s.bonuses).reduce((a, v) => a + v, 0);
    expect(rows + bonus).toBe(s.score);
    expect(s.bonuses['Partridge in a pear tree ×1.5']).toBeGreaterThan(0);
    expect(Object.values(s.tally).some((r) => r.hits === 2)).toBe(true);
  });

  it('Candlemas: lit candles pay +2 each at the end; misses blow them out', () => {
    const s = game({ candles: true });
    s.misses = 3;
    while (!s.over || !s.finalized) step(s, 1 / 60);
    expect(s.score).toBe((8 - 3) * 2);
  });

  it('St. Isidore: +1 while the angel ploughs', () => {
    const s = game({ isidore: true });
    while (s.t < 4) step(s, 1 / 60);
    const d = makeBird(s, 'duck', 0, 0, 0);
    s.birds.push(d);
    applyHit(s, d, 'ko', 0, 0);
    expect(s.score).toBe(4);
  });

  it('the summary names the day', () => {
    expect(gameDay('2026-11-03', calm).names[0]).toMatch(/Hubert/);
    expect(gameDay('2026-08-12', calm).names).toEqual([]);
  });
});

describe('practice', () => {
  it('only gets the plain season — no holidays, partridge, weather or banners', () => {
    const xmas = practiceDay('2026-12-26');
    expect(xmas.theme.id).toBe('winter');
    expect(xmas.fx).toEqual(NO_FX);
    expect(xmas.banners).toEqual([]);
    expect(practiceDay('2026-11-03').names).toEqual([]);
    expect(practiceDay('2026-10-20').theme.id).toBe('fall');
    expect(practiceDay('2027-02-02').fx).toEqual(NO_FX);
  });

  it('gets the eagle on the Fourth', () => {
    const fourth = practiceDay('2027-07-04');
    expect(fourth.fx).toEqual({ ...NO_FX, eagle: true });
    expect(fourth.banners).toHaveLength(1);
    expect(practiceDay('2027-07-06').fx).toEqual(NO_FX);
  });
});

describe('round end', () => {
  const game = (fx: Partial<GameFx> = {}): GameState => newGame(400, 800, gameLayout(400, 800, 24, 48), false, { ...NO_FX, ...fx });
  it('no birds after the buzzer; they all leave, then it ends — well before the cap', () => {
    for (const fx of [{}, { turkey: true }, { hubert: true }, { partridge: true }, { pheasants: true }] as Partial<GameFx>[]) {
      const s = game(fx);
      while (!finished(s)) step(s, 1 / 60);
      expect(s.birds).toHaveLength(0);
      expect(s.clock).toBeGreaterThanOrEqual(GAME_SECONDS);
      expect(s.clock).toBeLessThanOrEqual(MAX_ROUND_SECONDS);
    }
  });

  it('Marauder Mode swarms clear out too', () => {
    const s = newGame(400, 800, gameLayout(400, 800, 24, 48), true, NO_FX);
    while (!finished(s)) step(s, 1 / 60);
    expect(s.birds).toHaveLength(0);
    expect(s.clock).toBeLessThanOrEqual(MAX_ROUND_SECONDS);
  });

  it('sitting ducks and slow walkers get moving at the buzzer', () => {
    const s = game({});
    while (s.t < GAME_SECONDS - 0.5) step(s, 1 / 60);
    const sitter = makeBird(s, 'duck', s.width / 2, s.waterY - 10, 40);
    sitter.sit = 2;
    s.birds.push(sitter);
    while (!s.over) step(s, 1 / 60);
    step(s, 1 / 60);
    expect(sitter.sit).toBe(0);
    expect(Math.abs(sitter.vx)).toBeGreaterThan(100);
  });

  it('hard cap: 15 seconds no matter what', () => {
    const s = game({});
    s.dogs.push({ x: 0, t: -1000, flip: false, birdId: -1, lead: false });
    let n = 0;
    while (!finished(s) && n++ < 60 * 30) step(s, 1 / 60);
    expect(s.clock).toBeLessThanOrEqual(MAX_ROUND_SECONDS + 0.05);
  });
});
