/**
 * The mini-game simulation. Plain data + pure functions marked as worklets, so
 * the same code runs on the UI thread (60 fps, no bridge hops between a touch and
 * a shot) and under Vitest.
 *
 * Units are screen points; time in seconds.
 *
 * Scoring:
 *  - Duck: body hit 1 (two body hits knock it out — 2 total). KO zone: hen 2, drake 3.
 *  - Coot: any hit −1, and the game mocks you.
 *  - Goose: damage adds up — 4 KO hits or 10 body hits. KO hit 3 (+1 on the killing
 *    blow → 13 for a clean four), body hit 1 (→ 10). Banded goose: everything ×2.
 *  - Swan: 3 KO hits or 8 body hits. KO hit 4 (→ 12), body hit 1 (→ 8).
 *  A retriever (two for a swan) jumps out of the reeds to fetch a downed goose or swan.
 */

import { COOT_H, COOT_W, DOG_H, DOG_W, DUCK_H, DUCK_W, FLOCK_SPECIES, GOOSE_H, GOOSE_W, SWAN_H, SWAN_W } from './sprites';

export const GAME_SECONDS = 12;
export const PIXEL = 3;
export const DUCK_PX_W = DUCK_W * PIXEL;
export const DUCK_PX_H = DUCK_H * PIXEL;
export const DOG_PX_W = DOG_W * PIXEL;
export const DOG_PX_H = DOG_H * PIXEL;
export const BULLET_SPEED = 1100;
export const GUN_LENGTH = 22 * PIXEL;
export const CLIP = 3;
export const RELOAD_SECONDS = 0.5;
const GRAVITY = 900;
/** Aim is clamped to the upper half-plane, a little above horizontal. */
export const MIN_AIM = -Math.PI + 0.15;
export const MAX_AIM = -0.15;

export type BirdKind = 'duck' | 'coot' | 'goose' | 'swan';

/** Fraction of the bird's width, from the head back, that counts as a knockout hit. */
export const KO_FRACTION: Record<BirdKind, number> = { duck: 0.33, coot: 1, goose: 0.8, swan: 0.6 };

export const SPECIAL = {
  goose: { koNeeded: 4, bodyNeeded: 10, koPts: 3, bodyPts: 1, koKillBonus: 1 },
  swan: { koNeeded: 3, bodyNeeded: 8, koPts: 4, bodyPts: 1, koKillBonus: 0 },
};

export type Bird = {
  id: number;
  kind: BirdKind;
  /** Index into FLOCK_SPECIES for ducks. */
  species: number;
  hen: boolean;
  banded: boolean;
  x: number;
  y: number;
  baseY: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  phase: number;
  alive: boolean;
  rot: number;
  koHits: number;
  bodyHits: number;
  earned: number;
  /** Seconds of hit-shake left. */
  flash: number;
  landed: boolean;
  gone: boolean;
};

export type Dog = { x: number; t: number; flip: boolean; birdId: number; lead: boolean };
export type Bullet = { x: number; y: number; vx: number; vy: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
export type Popup = { x: number; y: number; text: string; life: number };

export type GameEvent =
  | { k: 'shot' | 'dry' | 'reload' | 'dog' }
  | { k: 'hit' | 'ko'; pts: number }
  | { k: 'coot' }
  | { k: 'special'; kind: 'goose' | 'swan'; pts: number; banded: boolean; down: boolean };

export type GameState = {
  t: number;
  width: number;
  height: number;
  skyTop: number;
  skyBottom: number;
  /** Where downed big birds land and the dogs come up. */
  groundY: number;
  gunX: number;
  gunY: number;
  aim: number;
  aiming: boolean;
  ammo: number;
  reloadUntil: number;
  birds: Bird[];
  dogs: Dog[];
  bullets: Bullet[];
  particles: Particle[];
  popups: Popup[];
  events: GameEvent[];
  nextFlock: number;
  nextId: number;
  specialSeen: boolean;
  score: number;
  shots: number;
  hits: number;
  kos: number;
  geese: number;
  swans: number;
  coots: number;
  over: boolean;
};

export function newGame(width: number, height: number, gunY: number, skyTop: number): GameState {
  'worklet';
  const reedTop = gunY - 120;
  return {
    t: 0,
    width,
    height,
    skyTop,
    skyBottom: Math.min(reedTop - 30, skyTop + (gunY - skyTop) * 0.62),
    groundY: reedTop + 34,
    gunX: width / 2,
    gunY,
    aim: -Math.PI / 2,
    aiming: false,
    ammo: CLIP,
    reloadUntil: 0,
    birds: [],
    dogs: [],
    bullets: [],
    particles: [],
    popups: [],
    events: [],
    nextFlock: 0,
    nextId: 1,
    specialSeen: false,
    score: 0,
    shots: 0,
    hits: 0,
    kos: 0,
    geese: 0,
    swans: 0,
    coots: 0,
    over: false,
  };
}

export function clampAim(angle: number): number {
  'worklet';
  // Pointing down-left wraps to +π; treat any downward aim as the nearest edge.
  if (angle > 0) return angle > Math.PI / 2 ? MIN_AIM : MAX_AIM;
  return Math.max(MIN_AIM, Math.min(MAX_AIM, angle));
}

/** Aim from the gun's pivot toward a finger position. Small wobbles near the pivot keep the old aim. */
export function aimToward(s: GameState, x: number, y: number): void {
  'worklet';
  const dx = x - s.gunX;
  const dy = y - s.gunY;
  if (dx * dx + dy * dy < 14 * 14) return;
  s.aim = clampAim(Math.atan2(dy, dx));
}

export function reloading(s: GameState): boolean {
  'worklet';
  return s.t < s.reloadUntil;
}

/** Shells to draw: full clip, what's left, or filling back up during a reload. */
export function shellsShown(s: GameState): number {
  'worklet';
  if (!reloading(s)) return s.ammo;
  return Math.floor(CLIP * (1 - (s.reloadUntil - s.t) / RELOAD_SECONDS));
}

export function fire(s: GameState): void {
  'worklet';
  if (s.over) return;
  if (reloading(s)) {
    s.events.push({ k: 'dry' });
    return;
  }
  const cos = Math.cos(s.aim);
  const sin = Math.sin(s.aim);
  s.bullets.push({ x: s.gunX + cos * GUN_LENGTH, y: s.gunY + sin * GUN_LENGTH, vx: cos * BULLET_SPEED, vy: sin * BULLET_SPEED });
  s.shots++;
  s.ammo--;
  s.events.push({ k: 'shot' });
  if (s.ammo <= 0) {
    s.ammo = CLIP;
    s.reloadUntil = s.t + RELOAD_SECONDS;
    s.events.push({ k: 'reload' });
  }
}

export function makeBird(s: GameState, kind: BirdKind, x: number, y: number, vx: number, opts: { species?: number; hen?: boolean; banded?: boolean } = {}): Bird {
  'worklet';
  const species = opts.species ?? 0;
  const scale = kind === 'duck' ? FLOCK_SPECIES[species].scale : 1;
  const [gw, gh] =
    kind === 'goose' ? [GOOSE_W, GOOSE_H] : kind === 'swan' ? [SWAN_W, SWAN_H] : kind === 'coot' ? [COOT_W, COOT_H] : [DUCK_W, DUCK_H];
  return {
    id: s.nextId++,
    kind,
    species,
    hen: opts.hen ?? false,
    banded: opts.banded ?? false,
    x,
    y,
    baseY: y,
    w: gw * PIXEL * scale,
    h: gh * PIXEL * scale,
    vx,
    vy: 0,
    phase: Math.random() * Math.PI * 2,
    alive: true,
    rot: 0,
    koHits: 0,
    bodyHits: 0,
    earned: 0,
    flash: 0,
    landed: false,
    gone: false,
  };
}

function pickSpecies(): number {
  'worklet';
  let total = 0;
  for (const f of FLOCK_SPECIES) total += f.weight;
  let r = Math.random() * total;
  for (let i = 0; i < FLOCK_SPECIES.length; i++) {
    r -= FLOCK_SPECIES[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

function spawnFlock(s: GameState): void {
  'worklet';
  const species = pickSpecies();
  const sp = FLOCK_SPECIES[species];
  const size = 3 + Math.floor(Math.random() * 4);
  const span = s.skyBottom - s.skyTop - DUCK_PX_H - 40;
  const leadY = s.skyTop + 20 + Math.random() * Math.max(10, span);
  const speed = (110 + Math.random() * 80) * sp.speed * Math.max(0.85, s.width / 400);
  for (let i = 0; i < size; i++) {
    const row = Math.ceil(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    const y = Math.max(s.skyTop, Math.min(s.skyBottom - DUCK_PX_H, leadY + side * row * 22));
    const x = -DUCK_PX_W - row * 44 - Math.random() * 10;
    // A mud hen tags along now and then.
    if (Math.random() < 0.07) s.birds.push(makeBird(s, 'coot', x, y, speed * 0.85));
    else s.birds.push(makeBird(s, 'duck', x, y, speed, { species, hen: Math.random() < 0.35 }));
  }
}

/** Roll for the big birds. At most one per game, and only early enough to be shot down. */
function maybeSpawnSpecial(s: GameState): void {
  'worklet';
  if (s.specialSeen || s.t > GAME_SECONDS - 6) return;
  const r = Math.random();
  const scale = Math.max(0.85, s.width / 400);
  const mid = s.skyTop + (s.skyBottom - s.skyTop) * (0.25 + Math.random() * 0.35);
  let bird: Bird | null = null;
  if (r < 0.006) bird = makeBird(s, 'goose', -GOOSE_W * PIXEL, mid, 70 * scale, { banded: true });
  else if (r < 0.05) bird = makeBird(s, 'swan', -SWAN_W * PIXEL, mid, 58 * scale);
  else if (r < 0.2) bird = makeBird(s, 'goose', -GOOSE_W * PIXEL, mid, 70 * scale);
  if (bird) {
    s.birds.push(bird);
    s.specialSeen = true;
  }
}

/** 0 miss, otherwise 'ko' or 'body'. The top fifth of the sprite is air above the back. */
export function hitZone(b: Bird, x: number, y: number): 'ko' | 'body' | null {
  'worklet';
  if (x < b.x || x > b.x + b.w || y < b.y + b.h * 0.2 || y > b.y + b.h) return null;
  return x >= b.x + b.w * (1 - KO_FRACTION[b.kind]) ? 'ko' : 'body';
}

function burst(s: GameState, x: number, y: number, n: number, colors: string[], speed = 140): void {
  'worklet';
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * speed;
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.6, color: colors[i % colors.length] });
  }
}

function popup(s: GameState, b: Bird, pts: number): void {
  'worklet';
  s.popups.push({ x: b.x + b.w / 2, y: b.y, text: pts > 0 ? `+${pts}` : `${pts}`, life: 0.9 });
}

function knockDown(b: Bird): void {
  'worklet';
  b.alive = false;
  b.vy = b.kind === 'goose' || b.kind === 'swan' ? -60 : -120;
}

/** Apply one bullet to one bird. Returns the points scored. */
export function applyHit(s: GameState, b: Bird, zone: 'ko' | 'body', bx: number, by: number): number {
  'worklet';
  s.hits++;
  let pts = 0;
  if (b.kind === 'coot') {
    pts = -1;
    knockDown(b);
    s.coots++;
    burst(s, bx, by, 8, ['#3A3A40', '#F4F4F4']);
    s.events.push({ k: 'coot' });
  } else if (b.kind === 'duck') {
    const feathers = b.hen ? ['#A8865E', '#F4F4F4', '#6E5236'] : ['#F4F4F4', '#B8B2A6', '#6E665C'];
    if (zone === 'ko') {
      pts = b.hen ? 2 : 3;
      s.kos++;
      knockDown(b);
      burst(s, bx, by, 6, ['#F4F4F4', '#C8342A']);
      s.events.push({ k: 'ko', pts });
    } else {
      pts = 1;
      b.bodyHits++;
      b.flash = 0.12;
      burst(s, bx, by, 16, feathers);
      if (b.bodyHits >= 2) knockDown(b);
      s.events.push({ k: 'hit', pts });
    }
  } else {
    const spec = SPECIAL[b.kind];
    if (zone === 'ko') b.koHits++;
    else b.bodyHits++;
    let base = zone === 'ko' ? spec.koPts : spec.bodyPts;
    const down = b.koHits / spec.koNeeded + b.bodyHits / spec.bodyNeeded >= 0.999;
    if (down && zone === 'ko') base += spec.koKillBonus;
    pts = base * (b.banded ? 2 : 1);
    b.earned += pts;
    b.flash = 0.15;
    burst(s, bx, by, 10, b.kind === 'swan' ? ['#F7F7F2', '#DADAD2'] : ['#F4F4F4', '#8C7A64', '#141414']);
    if (down) {
      knockDown(b);
      if (zone === 'ko') s.kos++;
      if (b.kind === 'goose') s.geese++;
      else s.swans++;
      burst(s, b.x + b.w / 2, b.y + b.h / 2, 46, ['#E8B923', '#FFFFFF', '#F26B1D', '#FFE29A'], 260);
    }
    s.events.push({ k: 'special', kind: b.kind, pts: down ? b.earned : pts, banded: b.banded, down });
  }
  s.score += pts;
  popup(s, b, pts);
  return pts;
}

/** Dog timeline: rise 0–0.3 s, hold the bird up 0.3–1.1 s, sink 1.1–1.45 s. */
export const DOG_SECONDS = 1.45;

export function dogLift(t: number): number {
  'worklet';
  if (t < 0.3) return t / 0.3;
  if (t < 1.1) return 1;
  return Math.max(0, 1 - (t - 1.1) / 0.35);
}

export function dogTop(s: GameState, d: Dog): number {
  'worklet';
  return s.groundY + 8 - DOG_PX_H * dogLift(d.t);
}

function sendDogs(s: GameState, b: Bird): void {
  'worklet';
  const cx = b.x + b.w / 2;
  if (b.kind === 'swan') {
    s.dogs.push({ x: cx - DOG_PX_W - 6, t: 0, flip: false, birdId: b.id, lead: true });
    s.dogs.push({ x: cx + 6, t: 0, flip: true, birdId: b.id, lead: false });
  } else {
    // Mouth (column 13) under the bird.
    s.dogs.push({ x: cx - 13 * PIXEL, t: 0, flip: false, birdId: b.id, lead: true });
  }
  s.events.push({ k: 'dog' });
}

export function step(s: GameState, dt: number): void {
  'worklet';
  dt = Math.min(dt, 0.05);
  // The dogs and falling birds finish their show even after the buzzer.
  if (!s.over) {
    s.t += dt;
    if (s.t >= GAME_SECONDS) {
      s.over = true;
      s.aiming = false;
    }
    if (s.t >= s.nextFlock && s.t < GAME_SECONDS - 1.2) {
      spawnFlock(s);
      maybeSpawnSpecial(s);
      s.nextFlock = s.t + 1.5 + Math.random() * 0.9;
    }
  }

  for (const b of s.birds) {
    if (b.flash > 0) b.flash -= dt;
    if (b.alive) {
      b.x += b.vx * dt;
      b.y = b.baseY + Math.sin(b.phase + s.t * (b.kind === 'duck' || b.kind === 'coot' ? 4 : 2)) * 4;
    } else if (!b.landed) {
      b.vy += GRAVITY * dt;
      b.y += b.vy * dt;
      b.x += b.vx * 0.3 * dt;
      b.rot += 7 * dt;
      const big = b.kind === 'goose' || b.kind === 'swan';
      if (big && b.y + b.h * 0.5 >= s.groundY) {
        b.landed = true;
        b.y = s.groundY - b.h * 0.5;
        sendDogs(s, b);
      }
    }
  }

  for (const d of s.dogs) {
    d.t += dt;
    if (!d.lead) continue;
    const b = s.birds.find((x) => x.id === d.birdId);
    if (!b) continue;
    // Held in the dog's mouth (or between two dogs), riding up and down with them.
    const top = dogTop(s, d);
    b.x = d.x + 13 * PIXEL - b.w / 2 + (s.dogs.some((o) => !o.lead && o.birdId === d.birdId) ? DOG_PX_W - 13 * PIXEL + 6 : 0);
    b.y = top - b.h * 0.55;
    b.rot = 0.25;
    if (d.t >= DOG_SECONDS) b.gone = true;
  }
  s.dogs = s.dogs.filter((d) => d.t < DOG_SECONDS);
  s.birds = s.birds.filter((b) => !b.gone && b.x < s.width + 40 && b.y < s.height + 40);

  const keep: Bullet[] = [];
  for (const bl of s.bullets) {
    // Sub-step so a fast bullet can't tunnel through a small bird.
    const steps = 3;
    let spent = false;
    for (let k = 0; k < steps && !spent; k++) {
      bl.x += (bl.vx * dt) / steps;
      bl.y += (bl.vy * dt) / steps;
      for (const b of s.birds) {
        if (!b.alive) continue;
        const zone = hitZone(b, bl.x, bl.y);
        if (!zone) continue;
        applyHit(s, b, zone, bl.x, bl.y);
        spent = true;
        break;
      }
    }
    if (!spent && bl.x > -20 && bl.x < s.width + 20 && bl.y > -20) keep.push(bl);
  }
  s.bullets = keep;

  for (const p of s.particles) {
    p.vy += 220 * dt;
    p.vx *= 0.96;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  for (const p of s.popups) {
    p.y -= 50 * dt;
    p.life -= dt;
  }
  s.popups = s.popups.filter((p) => p.life > 0);
}

/** True once the clock is out and the last dog has gone back into the reeds. */
export function finished(s: GameState): boolean {
  'worklet';
  return s.over && s.dogs.length === 0 && !s.birds.some((b) => !b.alive && !b.landed && (b.kind === 'goose' || b.kind === 'swan'));
}

export function wingsUp(b: Bird, t: number): boolean {
  'worklet';
  const beat = b.kind === 'coot' ? 0.09 : b.kind === 'duck' ? 0.14 : 0.24;
  return Math.floor((t + b.phase) / beat) % 2 === 0;
}
