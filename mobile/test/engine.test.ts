import { describe, expect, it } from 'vitest';

import {
  aimToward, applyHit, CLIP, fire, GAME_SECONDS, hitZone, makeBird, newGame, reloading, RELOAD_SECONDS, step, type BirdKind,
} from '@/game/engine';
import { gameLayout } from '@/game/layout';
import { FLOCK_SPECIES } from '@/game/sprites';

const game = () => {
  const s = newGame(400, 800, gameLayout(400, 800, 24, 48));
  s.nextFlock = 999;
  return s;
};

const bird = (kind: BirdKind, opts: { hen?: boolean; banded?: boolean } = {}) => {
  const s = game();
  const b = makeBird(s, kind, 100, 200, 0, opts);
  s.birds.push(b);
  return { s, b };
};

describe('hit zones', () => {
  it('duck KO zone is the front third', () => {
    const { b } = bird('duck');
    expect(hitZone(b, b.x + b.w - 2, b.y + b.h * 0.6)).toBe('ko');
    expect(hitZone(b, b.x + 2, b.y + b.h * 0.6)).toBe('body');
    expect(hitZone(b, b.x - 5, b.y + b.h * 0.6)).toBeNull();
  });

  it('goose KO zone is the front 80%, swan 60%', () => {
    const g = bird('goose').b;
    expect(hitZone(g, g.x + g.w * 0.25, g.y + g.h * 0.6)).toBe('ko');
    expect(hitZone(g, g.x + g.w * 0.15, g.y + g.h * 0.6)).toBe('body');
    const w = bird('swan').b;
    expect(hitZone(w, w.x + w.w * 0.45, w.y + w.h * 0.6)).toBe('ko');
    expect(hitZone(w, w.x + w.w * 0.35, w.y + w.h * 0.6)).toBe('body');
  });
});

describe('scoring', () => {
  it('KO drake 3, KO hen 2', () => {
    const d = bird('duck');
    expect(applyHit(d.s, d.b, 'ko', 0, 0)).toBe(3);
    expect(d.b.alive).toBe(false);
    const h = bird('duck', { hen: true });
    expect(applyHit(h.s, h.b, 'ko', 0, 0)).toBe(2);
  });

  it('two body hits knock a duck out for 2 total, hen or drake', () => {
    for (const hen of [false, true]) {
      const { s, b } = bird('duck', { hen });
      applyHit(s, b, 'body', 0, 0);
      expect(b.alive).toBe(true);
      expect(s.score).toBe(0);
      applyHit(s, b, 'body', 0, 0);
      expect(b.alive).toBe(false);
      expect(s.score).toBe(2);
    }
  });

  it('merganser pays +2 on knockdown', () => {
    const s = game();
    const home = FLOCK_SPECIES.findIndex((f) => f.id === 'home');
    const b = makeBird(s, 'duck', 100, 200, 0, { species: home });
    s.birds.push(b);
    applyHit(s, b, 'ko', 0, 0);
    expect(s.score).toBe(5);
  });

  it('teal dart up and down', () => {
    const s = game();
    const teal = FLOCK_SPECIES.findIndex((f) => f.id === 'gwte');
    const b = makeBird(s, 'duck', 100, 300, 10, { species: teal });
    s.birds.push(b);
    let moved = 0;
    for (let i = 0; i < 180; i++) {
      step(s, 1 / 60);
      moved = Math.max(moved, Math.abs(b.y - b.baseY));
    }
    expect(moved).toBeGreaterThan(20);
  });

  it('a gadwall can land on the pond; shooting it pays in full and mocks you', () => {
    const s = game();
    const gadw = FLOCK_SPECIES.findIndex((f) => f.id === 'gadw');
    const b = makeBird(s, 'duck', 0, 200, 120, { species: gadw });
    b.landX = 150;
    s.birds.push(b);
    for (let i = 0; i < 180; i++) step(s, 1 / 60);
    expect(b.sit).toBe(2);
    expect(b.y + b.h).toBeGreaterThan(s.waterY - b.h * 0.2);
    applyHit(s, b, 'ko', 0, 0);
    expect(s.score).toBe(3);
    expect(s.events.some((e) => e.k === 'sitting')).toBe(true);
    expect(s.popups.at(-1)?.label).toBe('GADWALL');
  });

  it('coot costs a point', () => {
    const { s, b } = bird('coot');
    applyHit(s, b, 'body', 0, 0);
    expect(s.score).toBe(-1);
    expect(s.events.some((e) => e.k === 'coot')).toBe(true);
  });

  it.each([
    ['goose', 'ko', 4, 13],
    ['goose', 'body', 10, 10],
    ['swan', 'ko', 3, 12],
    ['swan', 'body', 8, 8],
  ] as const)('%s: %i… %s hits to drop, worth %i', (kind, zone, hits, pts) => {
    const { s, b } = bird(kind);
    for (let i = 0; i < hits; i++) {
      expect(b.alive).toBe(true);
      expect(s.score).toBe(0);
      applyHit(s, b, zone, 0, 0);
    }
    expect(b.alive).toBe(false);
    expect(s.score).toBe(pts);
  });

  it('banded goose doubles', () => {
    const { s, b } = bird('goose', { banded: true });
    for (let i = 0; i < 4; i++) applyHit(s, b, 'ko', 0, 0);
    expect(s.score).toBe(26);
  });
});

describe('gun', () => {
  it('aim never points below horizontal', () => {
    const s = game();
    aimToward(s, 600, 700);
    expect(s.aim).toBeLessThan(0);
    aimToward(s, 200, 300);
    expect(s.aim).toBeCloseTo(-Math.PI / 2);
  });

  it('reloads after every three shots, and dry-fires during the reload', () => {
    const s = game();
    for (let i = 0; i < CLIP; i++) fire(s);
    expect(s.shots).toBe(3);
    expect(reloading(s)).toBe(true);
    fire(s);
    expect(s.shots).toBe(3);
    expect(s.events.at(-1)?.k).toBe('dry');
    s.t += RELOAD_SECONDS + 0.01;
    fire(s);
    expect(s.shots).toBe(4);
  });

  it('a shot fired straight up drops a duck overhead', () => {
    const s = game();
    const b = makeBird(s, 'duck', 200 - 44, 300, 0);
    s.birds.push(b);
    fire(s);
    for (let i = 0; i < 40; i++) step(s, 1 / 60);
    expect(s.score).toBe(3);
  });

  it('a downed goose lands and the dog fetches it', () => {
    const s = game();
    const b = makeBird(s, 'goose', 150, 300, 0);
    s.birds.push(b);
    for (let i = 0; i < 4; i++) applyHit(s, b, 'ko', 0, 0);
    for (let i = 0; i < 120 && s.dogs.length === 0; i++) step(s, 1 / 60);
    expect(s.dogs.length).toBe(1);
    for (let i = 0; i < 120; i++) step(s, 1 / 60);
    expect(s.dogs.length).toBe(0);
    expect(s.birds.find((x) => x.id === b.id)).toBeUndefined();
  });

  it('ends after twelve seconds', () => {
    const s = newGame(400, 800, gameLayout(400, 800, 24, 48));
    for (let i = 0; i < GAME_SECONDS * 60 + 5; i++) step(s, 1 / 60);
    expect(s.over).toBe(true);
  });
});
