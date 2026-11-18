import { describe, expect, it } from 'vitest';

import { applyHit, DOG_PX_H, DUCK_PX_H, fire, GAME_SECONDS, GUN_LENGTH, newGame, step } from '@/game/engine';
import { gameLayout, HUD_BAND } from '@/game/layout';

/** Screen sizes in dp: [name, width, height, top inset, bottom inset]. */
const SCREENS: [string, number, number, number, number][] = [
  ['small 320×568, nav buttons', 320, 568, 24, 48],
  ['budget 360×640', 360, 640, 24, 48],
  ['classic 360×740', 360, 740, 24, 48],
  ['Galaxy A54 384×854', 384, 854, 32, 48],
  ['moto g stylus 407×904', 407, 904, 32, 48],
  ['Pixel 412×915, gesture bar', 412, 915, 36, 24],
  ['tall 20:9 393×873', 393, 873, 48, 16],
  ['big 430×932', 430, 932, 54, 34],
  ['tablet 800×1280', 800, 1280, 24, 48],
];

describe.each(SCREENS)('%s', (_name, w, h, top, bottom) => {
  const l = gameLayout(w, h, top, bottom);
  const s = newGame(w, h, l);

  it('gun sits clear of the nav bar with room for the shells', () => {
    expect(l.gunY + 40).toBeLessThanOrEqual(h - bottom);
    expect(l.gunY).toBeGreaterThan(l.reedTop);
  });

  it('has a usable sky below the HUD', () => {
    expect(l.skyTop).toBeGreaterThanOrEqual(top + HUD_BAND);
    expect(s.skyBottom - s.skyTop).toBeGreaterThanOrEqual(DUCK_PX_H * 4);
  });

  it('the gun barrel never reaches up into the sky', () => {
    expect(l.gunY - GUN_LENGTH).toBeGreaterThan(s.skyBottom - 60);
  });

  it('the dog has room to come up out of the reeds below the sky', () => {
    expect(s.groundY - DOG_PX_H).toBeGreaterThan(s.skyTop);
    expect(s.groundY).toBeLessThan(l.gunY);
  });

  it('the pond sits between the reeds and the gun, and is wide enough to land on', () => {
    expect(s.waterY).toBeGreaterThan(l.reedTop);
    expect(s.waterY).toBeLessThan(l.gunY);
    expect(s.pondR - s.pondL).toBeGreaterThan(120);
  });

  it('a full game runs: flocks cross, shots land, it ends', () => {
    const g = newGame(w, h, l);
    let maxX = 0;
    for (let i = 0; i < GAME_SECONDS * 60 + 120; i++) {
      step(g, 1 / 60);
      for (const b of g.birds) maxX = Math.max(maxX, b.x);
      if (i % 20 === 0 && g.birds[0]?.alive) applyHit(g, g.birds[0], 'ko', 0, 0);
      if (i % 15 === 0) fire(g);
    }
    expect(g.over).toBe(true);
    expect(maxX).toBeGreaterThan(w * 0.6);
    expect(g.score).not.toBe(0);
  });
});
