/**
 * The mini-game simulation. Plain data + pure functions marked as worklets, so
 * the same code runs on the UI thread (60 fps, no bridge hops between a touch and
 * a shot) and under Vitest.
 *
 * Units are screen points; time in seconds.
 *
 * Marauder Mode (the hidden easter egg): a semi-auto shotgun that throws a random
 * spread of pellets, a sky packed with birds, and clipped popups. Nothing from it
 * is ever saved.
 *
 * Keep helpers above the worklets that call them: the worklet compiler captures a
 * worklet's dependencies where it's defined, so a helper declared further down is
 * undefined on the UI thread (it still works under Vitest, which hides the bug).
 *
 * Scoring — nothing counts until the bird is down; hits bank on the bird and pay out when it falls:
 *  - Duck: body hit 1 (two body hits knock it out — 2 total). KO zone: hen 2, drake 3.
 *  - Merganser: a fast loner, +2 on top when it goes down.
 *  - Gadwall and spoonies fly slow and sometimes land on the open water. Shooting a
 *    sitting duck still pays in full — and the game mocks you for it.
 *  - Coot: any hit −1, and the game mocks you.
 *  - Goose: damage adds up — 4 KO hits or 10 body hits. KO hit 3 (+1 on the killing
 *    blow → 13 for a clean four), body hit 1 (→ 10). Banded goose: everything ×2.
 *  - Swan: 3 KO hits or 8 body hits. KO hit 4 (→ 12), body hit 1 (→ 8).
 *  A retriever (two for a swan) jumps out of the reeds to fetch a downed goose or swan.
 */

import type { GameLayout } from './layout';
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
/** Marauder Mode: a semi-auto shotgun with a bigger magazine. */
export const MARAUDER_CLIP = 8;
const PELLETS_MIN = 5;
const PELLETS_MAX = 8;
/** Half-width of the pellet spread, radians — random per shot, never too wide. */
const SPREAD_MIN = 0.05;
const SPREAD_MAX = 0.16;
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
  /** Teal and wood ducks dart up or down now and then: when the next one starts, and the current one. */
  jinkNext: number;
  jinkStart: number;
  jinkAmp: number;
  /** Landing on the pond: 0 flying, 1 gliding down, 2 sitting. */
  sit: number;
  /** Where it drops in (x of its centre), or Infinity for birds that never land. */
  landX: number;
  landT0: number;
  landY0: number;
};

export type Dog = { x: number; t: number; flip: boolean; birdId: number; lead: boolean };
export type Bullet = { x: number; y: number; vx: number; vy: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
export type Popup = { x: number; y: number; text: string; life: number; label: string };

/** Popups live this long; they pop in large and settle. */
export const POPUP_LIFE = 1.1;

export type GameEvent =
  | { k: 'shot' | 'dry' | 'reload' | 'dog' }
  | { k: 'hit' | 'ko'; pts: number }
  | { k: 'coot' | 'sitting' }
  | { k: 'special'; kind: 'goose' | 'swan'; pts: number; banded: boolean; down: boolean };

export type GameState = {
  t: number;
  width: number;
  height: number;
  skyTop: number;
  skyBottom: number;
  /** Where downed big birds land and the dogs come up. */
  groundY: number;
  /** The open water in the middle of the reeds, where sitting ducks float. */
  waterY: number;
  pondL: number;
  pondR: number;
  gunX: number;
  gunY: number;
  /** The easter egg. */
  marauder: boolean;
  clip: number;
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
  /** Banded geese dropped. */
  bands: number;
  /** Birds knocked down (any kind). */
  downs: number;
  over: boolean;
};

export function newGame(width: number, height: number, layout: GameLayout, marauder = false): GameState {
  'worklet';
  const { gunY, skyTop, reedTop } = layout;
  return {
    t: 0,
    width,
    height,
    skyTop,
    skyBottom: Math.min(reedTop - 30, skyTop + (gunY - skyTop) * 0.62),
    groundY: reedTop + 34,
    waterY: reedTop + 26,
    pondL: width * 0.27,
    pondR: width * 0.73,
    gunX: width / 2,
    gunY,
    marauder,
    clip: marauder ? MARAUDER_CLIP : CLIP,
    aim: -Math.PI / 2,
    aiming: false,
    ammo: marauder ? MARAUDER_CLIP : CLIP,
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
    bands: 0,
    downs: 0,
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
  return Math.floor(s.clip * (1 - (s.reloadUntil - s.t) / RELOAD_SECONDS));
}

export function fire(s: GameState): void {
  'worklet';
  if (s.over) return;
  if (reloading(s)) {
    s.events.push({ k: 'dry' });
    return;
  }
  const muzzleX = s.gunX + Math.cos(s.aim) * GUN_LENGTH;
  const muzzleY = s.gunY + Math.sin(s.aim) * GUN_LENGTH;
  if (s.marauder) {
    // Buckshot: a random handful of pellets in a random (but not silly) spread.
    const pellets = PELLETS_MIN + Math.floor(Math.random() * (PELLETS_MAX - PELLETS_MIN + 1));
    const spread = SPREAD_MIN + Math.random() * (SPREAD_MAX - SPREAD_MIN);
    for (let i = 0; i < pellets; i++) {
      const a = s.aim + (Math.random() * 2 - 1) * spread;
      const v = BULLET_SPEED * (0.92 + Math.random() * 0.16);
      s.bullets.push({ x: muzzleX, y: muzzleY, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    }
  } else {
    s.bullets.push({ x: muzzleX, y: muzzleY, vx: Math.cos(s.aim) * BULLET_SPEED, vy: Math.sin(s.aim) * BULLET_SPEED });
  }
  s.shots++;
  s.ammo--;
  s.events.push({ k: 'shot' });
  if (s.ammo <= 0) {
    s.ammo = s.clip;
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
    jinkNext: kind === 'duck' && FLOCK_SPECIES[species].jinks ? s.t + 0.4 + Math.random() * 1.2 : Infinity,
    jinkStart: -1,
    jinkAmp: 0,
    sit: 0,
    landX: Infinity,
    landT0: 0,
    landY0: 0,
  };
}

/** A quick dart: out to the jink amplitude and back over 0.45 s. */
export function jinkOffset(b: Bird, t: number): number {
  'worklet';
  if (b.jinkStart < 0) return 0;
  const p = (t - b.jinkStart) / 0.45;
  return p >= 0 && p <= 1 ? b.jinkAmp * Math.sin(Math.PI * p) : 0;
}

function pickSpecies(): number {
  'worklet';
  let total = 0;
  for (const f of FLOCK_SPECIES) total += f.weight;
  // Mergansers have weight 0: they come in on their own (spawnMerganser).
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
  const size = s.marauder ? 6 + Math.floor(Math.random() * 7) : 3 + Math.floor(Math.random() * 4);
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
  // Gadwall and spoonies: sometimes one peels off and drops onto the pond.
  if (sp.lands && Math.random() < 0.45) {
    const flock = s.birds.slice(-size).filter((b) => b.kind === 'duck');
    const lander = flock[Math.floor(Math.random() * flock.length)];
    if (lander) {
      lander.landX = s.pondL + 30 + Math.random() * (s.pondR - s.pondL - 60);
      lander.jinkNext = Infinity;
    }
  }
}

/** A merganser now and then: alone, low and fast. */
function maybeSpawnMerganser(s: GameState): void {
  'worklet';
  if (Math.random() > 0.3) return;
  const options: number[] = [];
  FLOCK_SPECIES.forEach((f, i) => f.solo && options.push(i));
  const species = options[Math.floor(Math.random() * options.length)];
  const y = s.skyTop + 30 + Math.random() * Math.max(10, s.skyBottom - s.skyTop - DUCK_PX_H - 60);
  const speed = (150 + Math.random() * 50) * FLOCK_SPECIES[species].speed * Math.max(0.85, s.width / 400) * 0.8;
  s.birds.push(makeBird(s, 'duck', -DUCK_PX_W - 120 - Math.random() * 80, y, speed, { species, hen: Math.random() < 0.35 }));
}

/** Roll for the big birds. At most one per game, and only early enough to be shot down. */
function maybeSpawnSpecial(s: GameState): void {
  'worklet';
  if ((s.specialSeen && !s.marauder) || s.t > GAME_SECONDS - 6) return;
  const r = s.marauder ? Math.random() * 0.4 : Math.random();
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

export function birdName(b: Bird): string {
  'worklet';
  if (b.kind === 'duck') {
    const sp = FLOCK_SPECIES[b.species];
    return b.hen ? `${sp.name} HEN` : sp.name;
  }
  if (b.kind === 'goose') return b.banded ? 'BANDED GOOSE' : 'GOOSE';
  return b.kind === 'swan' ? 'SWAN' : 'COOT';
}

function popup(s: GameState, b: Bird, pts: number): void {
  'worklet';
  // Marauder Mode would be wall-to-wall popups: clip the name and cut the life short.
  const full = birdName(b);
  let label = full;
  if (s.marauder) {
    label = '';
    for (const ch of full) if (ch >= 'A' && ch <= 'Z' && label.length < 4) label += ch;
  }
  s.popups.push({ x: b.x + b.w / 2, y: b.y, text: pts > 0 ? `+${pts}` : `${pts}`, life: s.marauder ? POPUP_LIFE * 0.55 : POPUP_LIFE, label });
}

function knockDown(b: Bird): void {
  'worklet';
  b.alive = false;
  b.vy = b.kind === 'goose' || b.kind === 'swan' ? -60 : -120;
}

/**
 * Apply one bullet to one bird. Hits are banked on the bird and only pay out when
 * it goes down — a wounded bird that gets away scores nothing. Returns the points
 * scored by this shot (0 unless it knocked the bird down).
 */
export function applyHit(s: GameState, b: Bird, zone: 'ko' | 'body', bx: number, by: number): number {
  'worklet';
  s.hits++;
  let down = false;
  if (b.kind === 'coot') {
    b.earned = -1;
    down = true;
    s.coots++;
    burst(s, bx, by, 8, ['#3A3A40', '#F4F4F4']);
    s.events.push({ k: 'coot' });
  } else if (b.kind === 'duck') {
    if (zone === 'ko') {
      b.earned += b.hen ? 2 : 3;
      down = true;
      s.kos++;
      burst(s, bx, by, 22, ['#F4F4F4', '#C8342A', '#E8B923', '#FFFFFF'], 220);
      s.events.push({ k: 'ko', pts: b.earned });
    } else {
      b.earned += 1;
      b.bodyHits++;
      b.flash = 0.12;
      burst(s, bx, by, 16, b.hen ? ['#A8865E', '#F4F4F4', '#6E5236'] : ['#F4F4F4', '#B8B2A6', '#6E665C']);
      down = b.bodyHits >= 2;
      s.events.push({ k: down ? 'ko' : 'hit', pts: down ? b.earned : 0 });
    }
  } else {
    const spec = SPECIAL[b.kind];
    if (zone === 'ko') b.koHits++;
    else b.bodyHits++;
    let base = zone === 'ko' ? spec.koPts : spec.bodyPts;
    down = b.koHits / spec.koNeeded + b.bodyHits / spec.bodyNeeded >= 0.999;
    if (down && zone === 'ko') base += spec.koKillBonus;
    b.earned += base * (b.banded ? 2 : 1);
    b.flash = 0.15;
    burst(s, bx, by, 10, b.kind === 'swan' ? ['#F7F7F2', '#DADAD2'] : ['#F4F4F4', '#8C7A64', '#141414']);
    if (down) {
      if (zone === 'ko') s.kos++;
      if (b.kind === 'goose') s.geese++;
      else s.swans++;
      if (b.banded) s.bands++;
      burst(s, b.x + b.w / 2, b.y + b.h / 2, 46, ['#E8B923', '#FFFFFF', '#F26B1D', '#FFE29A'], 260);
    }
    s.events.push({ k: 'special', kind: b.kind, pts: down ? b.earned : 0, banded: b.banded, down });
  }
  if (!down) return 0;
  if (b.kind === 'duck') b.earned += FLOCK_SPECIES[b.species].bonus ?? 0;
  if (b.sit === 2) s.events.push({ k: 'sitting' });
  s.downs++;
  knockDown(b);
  s.score += b.earned;
  popup(s, b, b.earned);
  return b.earned;
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
      maybeSpawnMerganser(s);
      maybeSpawnSpecial(s);
      s.nextFlock = s.t + (s.marauder ? 0.3 + Math.random() * 0.35 : 1.5 + Math.random() * 0.9);
    }
  }

  for (const b of s.birds) {
    if (b.flash > 0) b.flash -= dt;
    if (b.alive && b.sit > 0) {
      const sitY = s.waterY - b.h * 0.85;
      if (b.sit === 1) {
        const p = Math.min(1, (s.t - b.landT0) / 0.8);
        b.x += b.vx * dt * (1 - p);
        b.y = b.landY0 + (sitY - b.landY0) * (p * p * (3 - 2 * p));
        if (p >= 1) b.sit = 2;
      } else {
        b.x += 5 * dt;
        b.y = sitY + Math.sin(s.t * 2 + b.phase) * 1.5;
      }
    } else if (b.alive) {
      if (b.x + b.w / 2 >= b.landX) {
        b.sit = 1;
        b.landT0 = s.t;
        b.landY0 = b.y;
        continue;
      }
      b.x += b.vx * dt;
      if (s.t >= b.jinkNext) {
        b.jinkStart = s.t;
        // Dip or pop up, staying inside the sky.
        const up = b.baseY - 70 > s.skyTop && (Math.random() < 0.5 || b.baseY + 70 > s.skyBottom);
        b.jinkAmp = (up ? -1 : 1) * (35 + Math.random() * 40);
        b.jinkNext = s.t + 0.9 + Math.random() * 1.4;
      }
      b.y = b.baseY + Math.sin(b.phase + s.t * (b.kind === 'duck' || b.kind === 'coot' ? 4 : 2)) * 4 + jinkOffset(b, s.t);
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
  if (b.sit === 1) return Math.floor(t / 0.07) % 2 === 0;
  const beat = b.kind === 'coot' ? 0.09 : b.kind === 'duck' ? 0.14 : 0.24;
  return Math.floor((t + b.phase) / beat) % 2 === 0;
}
