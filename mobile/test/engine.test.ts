import { describe, expect, it } from 'vitest';

import { aimToward, DUCK_PX_W, fire, GAME_SECONDS, hitValue, newGame, step, type Duck } from '@/game/engine';

const duck = (x: number, y: number): Duck => ({ x, y, baseY: y, vx: 0, vy: 0, phase: 0, hen: false, alive: true, rot: 0 });

describe('engine', () => {
  it('vital zone is the front third', () => {
    const d = duck(100, 100);
    expect(hitValue(d, 100 + DUCK_PX_W - 2, 115)).toBe(3);
    expect(hitValue(d, 102, 115)).toBe(1);
    expect(hitValue(d, 90, 115)).toBe(0);
  });

  it('aim never points below horizontal', () => {
    const s = newGame(400, 800, 650, 80);
    aimToward(s, 600, 700);
    expect(s.aim).toBeLessThan(0);
    aimToward(s, 200, 300);
    expect(s.aim).toBeCloseTo(-Math.PI / 2);
  });

  it('a bullet fired straight up hits a duck overhead and scores', () => {
    const s = newGame(400, 800, 650, 80);
    s.nextFlock = 999;
    s.ducks.push(duck(200 - DUCK_PX_W + 4, 300));
    fire(s);
    for (let i = 0; i < 40; i++) step(s, 1 / 60);
    expect(s.score).toBe(3);
    expect(s.hits).toBe(1);
  });

  it('ends after twelve seconds', () => {
    const s = newGame(400, 800, 650, 80);
    for (let i = 0; i < GAME_SECONDS * 60 + 5; i++) step(s, 1 / 60);
    expect(s.over).toBe(true);
  });
});
