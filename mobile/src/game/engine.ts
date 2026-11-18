/**
 * The mini-game simulation. Plain data + pure functions marked as worklets, so
 * the same code runs on the UI thread (60 fps, no bridge hops between a touch and
 * a shot) and under Vitest.
 *
 * Units are screen points; time in seconds.
 */

export const GAME_SECONDS = 12;
export const PIXEL = 3;
export const DUCK_PX_W = 16 * PIXEL;
export const DUCK_PX_H = 10 * PIXEL;
/** Front third of the bird (head, neck, breast) — the vital zone, worth 3. */
export const VITAL_FRACTION = 0.33;
export const BULLET_SPEED = 1100;
export const GUN_LENGTH = 22 * PIXEL;
const GRAVITY = 900;
/** Aim is clamped to the upper half-plane, a little above horizontal. */
export const MIN_AIM = -Math.PI + 0.15;
export const MAX_AIM = -0.15;

export type Duck = {
  x: number;
  y: number;
  baseY: number;
  vx: number;
  vy: number;
  phase: number;
  hen: boolean;
  alive: boolean;
  rot: number;
};

export type Bullet = { x: number; y: number; vx: number; vy: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
export type Popup = { x: number; y: number; text: string; life: number };

export type GameState = {
  t: number;
  width: number;
  height: number;
  /** Top of the flying zone and bottom (ducks stay above the reeds). */
  skyTop: number;
  skyBottom: number;
  gunX: number;
  gunY: number;
  aim: number;
  aiming: boolean;
  ducks: Duck[];
  bullets: Bullet[];
  particles: Particle[];
  popups: Popup[];
  nextFlock: number;
  score: number;
  shots: number;
  hits: number;
  vitals: number;
  over: boolean;
};

export function newGame(width: number, height: number, gunY: number, skyTop: number): GameState {
  'worklet';
  return {
    t: 0,
    width,
    height,
    skyTop,
    skyBottom: Math.min(gunY - 160, skyTop + (gunY - skyTop) * 0.62),
    gunX: width / 2,
    gunY,
    aim: -Math.PI / 2,
    aiming: false,
    ducks: [],
    bullets: [],
    particles: [],
    popups: [],
    nextFlock: 0,
    score: 0,
    shots: 0,
    hits: 0,
    vitals: 0,
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

export function fire(s: GameState): void {
  'worklet';
  if (s.over) return;
  const cos = Math.cos(s.aim);
  const sin = Math.sin(s.aim);
  s.bullets.push({
    x: s.gunX + cos * GUN_LENGTH,
    y: s.gunY + sin * GUN_LENGTH,
    vx: cos * BULLET_SPEED,
    vy: sin * BULLET_SPEED,
  });
  s.shots++;
}

function spawnFlock(s: GameState): void {
  'worklet';
  const size = 3 + Math.floor(Math.random() * 4);
  const span = s.skyBottom - s.skyTop - DUCK_PX_H - 40;
  const leadY = s.skyTop + 20 + Math.random() * Math.max(10, span);
  const speed = (110 + Math.random() * 80) * Math.max(0.85, s.width / 400);
  for (let i = 0; i < size; i++) {
    const row = Math.ceil(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    const y = Math.max(s.skyTop, Math.min(s.skyBottom - DUCK_PX_H, leadY + side * row * 22));
    s.ducks.push({
      x: -DUCK_PX_W - row * 44 - Math.random() * 10,
      y,
      baseY: y,
      vx: speed,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      hen: Math.random() < 0.35,
      alive: true,
      rot: 0,
    });
  }
}

/** Returns 0 for a miss, 1 for a body hit, 3 for a vital hit. */
export function hitValue(d: Duck, x: number, y: number): number {
  'worklet';
  const top = d.y + 2 * PIXEL;
  if (x < d.x || x > d.x + DUCK_PX_W || y < top || y > d.y + DUCK_PX_H) return 0;
  return x >= d.x + DUCK_PX_W * (1 - VITAL_FRACTION) ? 3 : 1;
}

function puff(s: GameState, x: number, y: number, n: number, colors: string[]): void {
  'worklet';
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 140;
    s.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      life: 0.5 + Math.random() * 0.5,
      color: colors[i % colors.length],
    });
  }
}

export function step(s: GameState, dt: number): void {
  'worklet';
  if (s.over) return;
  dt = Math.min(dt, 0.05);
  s.t += dt;
  if (s.t >= GAME_SECONDS) {
    s.over = true;
    s.aiming = false;
  }

  if (s.t >= s.nextFlock && s.t < GAME_SECONDS - 1.2) {
    spawnFlock(s);
    s.nextFlock = s.t + 1.5 + Math.random() * 0.9;
  }

  for (const d of s.ducks) {
    if (d.alive) {
      d.x += d.vx * dt;
      d.y = d.baseY + Math.sin(d.phase + s.t * 4) * 4;
    } else {
      d.vy += GRAVITY * dt;
      d.y += d.vy * dt;
      d.x += d.vx * 0.3 * dt;
      d.rot += 7 * dt;
    }
  }
  s.ducks = s.ducks.filter((d) => d.x < s.width + 20 && d.y < s.height + 40);

  const keep: Bullet[] = [];
  for (const b of s.bullets) {
    // Sub-step so a fast bullet can't tunnel through a 30-point bird.
    const steps = 3;
    let spent = false;
    for (let k = 0; k < steps && !spent; k++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      for (const d of s.ducks) {
        if (!d.alive) continue;
        const v = hitValue(d, b.x, b.y);
        if (v === 0) continue;
        d.alive = false;
        d.vy = -120;
        s.score += v;
        s.hits++;
        if (v === 3) {
          s.vitals++;
          puff(s, b.x, b.y, 6, ['#F4F4F4', '#C8342A']);
        } else {
          puff(s, b.x, b.y, 16, d.hen ? ['#A8865E', '#F4F4F4', '#6E5236'] : ['#F4F4F4', '#B8B2A6', '#6E665C']);
        }
        s.popups.push({ x: d.x + DUCK_PX_W / 2, y: d.y, text: `+${v}`, life: 0.9 });
        spent = true;
        break;
      }
    }
    if (!spent && b.x > -20 && b.x < s.width + 20 && b.y > -20) keep.push(b);
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

export function wingsUp(d: Duck, t: number): boolean {
  'worklet';
  return Math.floor((t + d.phase) / 0.14) % 2 === 0;
}
