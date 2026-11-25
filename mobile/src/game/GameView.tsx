import { Canvas, createPicture, Group, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeOut, useDerivedValue, useFrameCallback, useSharedValue, ZoomIn } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { play } from '@/audio/sfx';
import { Pixel } from '@/ui/kit';
import { C } from '@/ui/theme';

import {
  angelX, aimToward, CANDLES, candlesLit, dogTop, finished, fire, GAME_SECONDS, ghostShowing, GUN_LENGTH, multLeft, newGame, POPUP_LIFE, reloading, shellsShown, step, wingsUp,
  type Bird, type GameEvent, type GameState,
} from './engine';
import type { GameLayout } from './layout';
import { backgroundPicture, foregroundPicture, gamePictures, sceneTheme, type GamePictures } from './pictures';
import { GUN_H, GUN_W } from './sprites';
import { NO_FX, type GameFx } from './events';
import type { Theme } from './theme';

export type GameResult = {
  score: number; shots: number; hits: number; kos: number; geese: number; swans: number; coots: number; bands: number; downs: number;
  /** Per bird type: knockout hits, other hits, base points. */
  tally: Record<string, { ko: number; hits: number; pts: number }>;
  /** Holiday and seasonal bonuses (negative for penalties). Rows + bonuses = score. */
  bonuses: Record<string, number>;
  /** Shot a bald eagle: the game warden ended the round. */
  busted: boolean;
};

/** Touches that start within this radius of the gun pick it up. */
const GRAB_RADIUS = 80;

const COOT_JABS = [
  'REALLY? A COOT?',
  'MUD HEN! -1',
  'NOBODY EATS COOTS',
  "THAT'S A COOT, BUD",
  "THE DOG WON'T FETCH THAT",
  'COOT SHAMING IN PROGRESS',
  'POULE D’EAU? POOR YOU.',
];

const SITTING_JABS = [
  'SITTING DUCK? REALLY?!?',
  'IT WAS SWIMMING. BRAVE.',
  'SKY-BUSTING TOO HARD?',
  "IT DIDN'T EVEN SEE YOU",
  'GROUND SWATTER!',
  'NEXT: SHOOT A DECOY?',
];

type Banner = { key: number; text: string; color: string; big?: boolean; small?: boolean };

// Worklet helpers sit above the worklets that use them (see engine.ts).
function spriteW(kind: Bird['kind']): number {
  'worklet';
  switch (kind) {
    case 'goose': return 24;
    case 'swan': return 26;
    case 'coot': return 12;
    case 'partridge': return 16;
    case 'pheasant': return 20;
    case 'turkey': return 14;
    case 'eagle': return 26;
    case 'stag': return 18;
    default: return 16;
  }
}

function drawBird(canvas: SkCanvas, pics: GamePictures, b: Bird, t: number) {
  'worklet';
  const up = b.alive ? wingsUp(b, t) : false;
  let flap;
  if (b.kind === 'goose') flap = b.banded ? pics.bandedGoose : pics.goose;
  else if (b.kind === 'swan') flap = pics.swan;
  else if (b.kind === 'coot') flap = pics.coot;
  else if (b.kind === 'partridge') flap = { up: pics.partridge, down: pics.partridge };
  else if (b.kind === 'pheasant') flap = b.hen ? pics.henPheasant : pics.rooster;
  else if (b.kind === 'turkey') flap = { up: pics.turkey, down: pics.turkey };
  else if (b.kind === 'eagle') flap = pics.eagle;
  else if (b.kind === 'stag') flap = { up: pics.stag, down: pics.stag };
  else flap = b.hen ? pics.ducks[b.species].hen : pics.ducks[b.species].drake;
  const pic = b.kind === 'duck' && b.sit === 2 && b.alive ? (flap as GamePictures['ducks'][number]['drake']).sit : up ? flap.up : flap.down;
  // Sprites are drawn at their native size; scale up for big ducks and full-moon nights.
  const scale = b.kind === 'duck' ? b.w / 48 : b.w / (spriteW(b.kind) * 3);
  // Halloween ghosts flicker; a pheasant flying left faces left.
  const alpha = b.ghost ? (ghostShowing(b, t) ? 0.75 : 0.12) : 1;
  const flip = b.kind === 'pheasant' && b.vx < 0;
  const shake = b.flash > 0 ? Math.sin(t * 90) * 3 : 0;
  canvas.save();
  if (b.alive) {
    canvas.translate(b.x + shake, b.y);
  } else {
    canvas.translate(b.x + b.w / 2, b.y + b.h / 2);
    canvas.rotate((b.rot * 180) / Math.PI, 0, 0);
    if (!b.landed) canvas.scale(1, -1);
    canvas.translate(-b.w / 2, -b.h / 2);
  }
  if (scale !== 1) canvas.scale(scale, scale);
  if (flip) {
    canvas.translate(b.w / scale, 0);
    canvas.scale(-1, 1);
  }
  if (alpha < 1) {
    const p = Skia.Paint();
    p.setAlphaf(alpha);
    canvas.saveLayer(p);
    canvas.drawPicture(pic);
    canvas.restore();
  } else canvas.drawPicture(pic);
  canvas.restore();
}

/** Fireworks on New Year's and the Fourth (never in Marauder Mode). */
function scene_fireworks(theme: Theme, marauder: boolean): boolean {
  return !marauder && !!theme.fireworks;
}

/**
 * The 12-second shoot. Simulation, drawing and touch handling all run on the UI
 * thread; the JS thread hears about events (sounds, banners) and the end.
 */
export function GameView({
  width, height, scale, layout, running, onEnd, marauder = false, theme, fx, banners = [],
}: {
  width: number;
  height: number;
  scale: number;
  layout: GameLayout;
  running: boolean;
  onEnd: (r: GameResult) => void;
  marauder?: boolean;
  /** The season's marsh (fall colors, snow, Christmas trees…). */
  theme: Theme;
  /** Today's events (holidays, blizzard, full moon…), plus their opening banners. */
  fx?: GameFx;
  banners?: string[];
}) {
  const dayFx = marauder ? NO_FX : (fx ?? NO_FX);
  const fireworks = !!scene_fireworks(theme, marauder);
  const windy = dayFx.wind !== 0;
  const scene = sceneTheme(theme, marauder);
  const snowing = scene.snow;
  const { gunY, skyTop } = layout;
  const pics = useMemo(() => gamePictures(), []);
  const initial = useMemo(
    () => newGame(width, height, layout, marauder, dayFx),
    [width, height, layout, marauder, dayFx],
  );
  const bg = useMemo(() => backgroundPicture(width, height, layout.reedTop, scene), [width, height, layout, scene]);
  const fg = useMemo(() => foregroundPicture(width, height, initial.groundY, scene), [width, height, initial.groundY, scene]);
  const state = useSharedValue<GameState>(initial);
  const live = useSharedValue(false);
  const lastScore = useSharedValue(0);
  const lastLeft = useSharedValue(GAME_SECONDS);
  const lastMult = useSharedValue(0);
  const lastBlessed = useSharedValue(false);
  const [hud, setHud] = useState({ score: 0, left: GAME_SECONDS, mult: 0, blessed: false });
  const [banner, setBanner] = useState<Banner | null>(null);
  const [reloadingNow, setReloadingNow] = useState(false);
  const ended = useRef(false);
  const bannerKey = useRef(0);
  const lastCry = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showBanner = (text: string, color: string, big = false, ms = 1300, small = false) => {
    bannerKey.current += 1;
    const key = bannerKey.current;
    setBanner({ key, text, color, big, small });
    later(ms, () => setBanner((b) => (b?.key === key ? null : b)));
  };

  const onHud = (score: number, left: number, mult: number, blessed: boolean) => setHud({ score, left, mult, blessed });

  const onEvents = (events: GameEvent[]) => {
    for (const e of events) {
      switch (e.k) {
        case 'shot': play('shot'); break;
        case 'dry': play('dry'); break;
        case 'reload':
          later(90, () => play('reload'));
          setReloadingNow(true);
          later(500, () => setReloadingNow(false));
          break;
        case 'hit': play('hit'); break;
        case 'ko': play('vital'); break;
        case 'coot':
          play('wrong');
          // Marauder Mode hits a lot of coots: keep the jab small and quick.
          if (marauder) showBanner(COOT_JABS[Math.floor(Math.random() * COOT_JABS.length)], '#FFB199', false, 650, true);
          else showBanner(COOT_JABS[Math.floor(Math.random() * COOT_JABS.length)], '#FFB199');
          break;
        case 'pop': {
          // Duck cries, but not a wall of them: at most one every 140 ms.
          const now = Date.now();
          if (now - lastCry.current > 140) {
            lastCry.current = now;
            play('cry');
          }
          play('boom');
          break;
        }
        case 'dog': play('woof'); break;
        case 'turkey':
          play('toot');
          showBanner('WRONG BIRD, PILGRIM!\n-2', '#FFB199');
          break;
        case 'henpheasant':
          play('wrong');
          showBanner('HEN PHEASANT!\nILLEGAL. -3', '#FFB199');
          break;
        case 'eagle':
          play('siren');
          showBanner('YOU SHOT A BALD EAGLE!\nFEDERAL OFFENSE — THE GAME WARDEN ENDED YOUR ROUND', '#FF5A4E', true, 3000);
          break;
        case 'penance':
          play('wrong');
          showBanner('PENANCE!\nYOU SHOT ST. HUBERT’S STAG — SCORE HALVED', '#FFB199', false, 2200);
          break;
        case 'blessing':
          play('celebrate');
          showBanner('ST. HUBERT’S BLESSING\n×3 FOR THE REST OF THE ROUND', C.gold, false, 2000);
          break;
        case 'candles':
          if (e.k === 'candles' && e.lit > 0) showBanner(`${e.lit} CANDLES STILL LIT\n+${e.lit * 2}`, C.gold, false, 1800);
          break;
        case 'midnight':
          play('celebrate');
          showBanner('MIDNIGHT!\nPOINTS ×2', C.gold, false, 1400);
          break;
        case 'lucky':
          showBanner('A LUCKY DUCK!\nWORTH 7', '#4ADE80', false, 1400);
          break;
        case 'partridge':
          play('celebrate');
          showBanner('A PARTRIDGE IN A PEAR TREE!\n×1.5 FOR 5 SECONDS', C.gold, false, 1800);
          break;
        case 'sitting':
          play('wrong');
          showBanner(SITTING_JABS[Math.floor(Math.random() * SITTING_JABS.length)], '#FFB199');
          break;
        case 'special':
          if (e.down) {
            play('celebrate');
            const name = e.kind === 'swan' ? 'SWAN DOWN!' : e.banded ? 'BANDED GOOSE!!' : 'GOOSE DOWN!';
            showBanner(`${name}\n+${e.pts}`, e.banded ? C.gold : C.white, true, 2000);
          } else play('hit');
          break;
      }
    }
  };

  const finish = (r: GameResult) => {
    if (ended.current) return;
    ended.current = true;
    play('gameover');
    onEnd(r);
  };

  useEffect(() => {
    live.set(running);
    // The day's events announce themselves as the round starts.
    if (running && banners.length && !marauder) {
      banners.forEach((b, i) => later(i * 1500, () => showBanner(b, C.gold, false, 1400)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, live]);

  useFrameCallback((frame) => {
    'worklet';
    if (!live.value) return;
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    let events: GameEvent[] = [];
    state.modify((s) => {
      'worklet';
      step(s, dt);
      if (s.events.length) {
        events = s.events;
        s.events = [];
      }
      return s;
    });
    if (events.length) scheduleOnRN(onEvents, events);
    const s = state.value;
    const left = Math.max(0, Math.ceil(GAME_SECONDS - s.t));
    const mult = multLeft(s);
    if (s.score !== lastScore.value || left !== lastLeft.value || mult !== lastMult.value || s.blessed !== lastBlessed.value) {
      lastScore.value = s.score;
      lastLeft.value = left;
      lastMult.value = mult;
      lastBlessed.value = s.blessed;
      scheduleOnRN(onHud, s.score, left, mult, s.blessed);
    }
    if (finished(s)) {
      live.set(false);
      scheduleOnRN(finish, { score: s.score, shots: s.shots, hits: s.hits, kos: s.kos, geese: s.geese, swans: s.swans, coots: s.coots, bands: s.bands, downs: s.downs, tally: { ...s.tally }, bonuses: { ...s.bonuses }, busted: s.busted });
    }
  });

  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    // Only touches that start down by the gun belong to the gun. Without this the
    // pan claimed every touch on screen — including a long-press on the duck up top.
    hitSlop: { top: -Math.max(0, (gunY - GRAB_RADIUS) * scale) },
    onBegin: (e) => {
      'worklet';
      const s = state.value;
      if (!live.value || s.busted) return;
      const dx = e.x / scale - s.gunX;
      const dy = e.y / scale - s.gunY;
      if (dx * dx + dy * dy > GRAB_RADIUS * GRAB_RADIUS) return;
      state.modify((st) => {
        'worklet';
        st.aiming = true;
        return st;
      });
    },
    onUpdate: (e) => {
      'worklet';
      if (!state.value.aiming) return;
      state.modify((st) => {
        'worklet';
        aimToward(st, e.x / scale, e.y / scale);
        return st;
      });
    },
    onFinalize: () => {
      'worklet';
      if (!state.value.aiming) return;
      state.modify((st) => {
        'worklet';
        st.aiming = false;
        fire(st);
        return st;
      });
    },
  });

  // Flying birds, then the dogs and what they fetch. The front reeds go on top of this.
  const world = useDerivedValue(() => {
    const s = state.value;
    return createPicture((canvas) => {
      const deco = Skia.Paint();
      // St. John's Eve: bonfires flicker along the bank, sparks rising.
      if (s.fx.bonfires) {
        for (const fx of [0.1, 0.84]) {
          const bx = s.width * fx;
          const by = s.groundY - 4;
          deco.setColor(Skia.Color('#5A3A1E'));
          canvas.drawRect(Skia.XYWHRect(bx - 14, by - 6, 28, 6), deco);
          for (let i = 0; i < 9; i++) {
            const h = 10 + ((Math.sin(s.t * 13 + i * 2.1) + 1) / 2) * 26;
            deco.setColor(Skia.Color(i % 3 === 0 ? '#FFE29A' : i % 3 === 1 ? '#F26B1D' : '#D7263D'));
            canvas.drawRect(Skia.XYWHRect(bx - 12 + i * 3, by - 6 - h, 3, h), deco);
          }
          deco.setColor(Skia.Color('#FFB44A'));
          for (let i = 0; i < 8; i++) {
            const life = (s.t * 0.9 + i / 8) % 1;
            canvas.drawRect(Skia.XYWHRect(bx + Math.sin(i * 3 + s.t) * 18, by - 40 - life * 160, 3, 3), deco);
          }
        }
      }
      // Epiphany: the star crosses the sky; the three kings follow along the bank.
      if (s.fx.epiphany) {
        const sx = s.width * (0.1 + (s.t / GAME_SECONDS) * 0.8);
        const sy = s.skyTop + 18;
        deco.setColor(Skia.Color('#FFF6C8'));
        canvas.drawRect(Skia.XYWHRect(sx - 2, sy - 12, 4, 24), deco);
        canvas.drawRect(Skia.XYWHRect(sx - 12, sy - 2, 24, 4), deco);
        canvas.drawRect(Skia.XYWHRect(sx - 4, sy - 4, 8, 8), deco);
        deco.setAlphaf(0.35);
        canvas.drawRect(Skia.XYWHRect(sx - 1, sy + 12, 2, 60), deco);
        deco.setAlphaf(1);
        pics.kings.forEach((k, i) => {
          canvas.save();
          canvas.translate(-60 + s.t * 30 - i * 26, s.groundY - 40 + (Math.floor(s.t * 5 + i) % 2));
          canvas.drawPicture(k);
          canvas.restore();
        });
      }
      // St. Isidore: the angel ploughs across the far bank.
      const ax = angelX(s);
      if (ax != null) {
        canvas.save();
        canvas.translate(ax, s.groundY - 40);
        canvas.drawPicture(pics.angel);
        canvas.restore();
      }
      // Rogation: a procession walks the bank behind a cross.
      if (s.fx.rogation) {
        const lead = -40 + (s.t / 10) * (s.width + 200);
        for (let i = 0; i < 5; i++) {
          const fx2 = lead - i * 24;
          const bob = Math.floor(s.t * 4 + i) % 2;
          if (i === 0) {
            deco.setColor(Skia.Color('#B8862E'));
            canvas.drawRect(Skia.XYWHRect(fx2 + 16, s.groundY - 60, 3, 32), deco);
            canvas.drawRect(Skia.XYWHRect(fx2 + 10, s.groundY - 54, 15, 3), deco);
          }
          canvas.save();
          canvas.translate(fx2, s.groundY - 36 + bob);
          canvas.drawPicture(pics.friar);
          canvas.restore();
        }
      }

      for (const b of s.birds) if (!b.landed) drawBird(canvas, pics, b, s.t);
      for (const d of s.dogs) {
        canvas.save();
        canvas.translate(d.x, dogTop(s, d));
        canvas.drawPicture(d.flip ? pics.dogFlipped : pics.dog);
        canvas.restore();
      }
      for (const b of s.birds) if (b.landed) drawBird(canvas, pics, b, s.t);
    });
  });

  // Particles, bullets, score pops, the gun and the shells — always on top.
  const overlay = useDerivedValue(() => {
    const s = state.value;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (const p of s.particles) {
        paint.setColor(Skia.Color(p.color));
        paint.setAlphaf(Math.min(1, p.life * 2));
        if (p.present) {
          // A little gift box with a white ribbon.
          canvas.drawRect(Skia.XYWHRect(p.x - 5, p.y - 5, 10, 10), paint);
          paint.setColor(Skia.Color('#FFFFFF'));
          canvas.drawRect(Skia.XYWHRect(p.x - 1, p.y - 5, 2, 10), paint);
          canvas.drawRect(Skia.XYWHRect(p.x - 5, p.y - 1, 10, 2), paint);
          canvas.drawRect(Skia.XYWHRect(p.x - 3, p.y - 7, 6, 2), paint);
        } else canvas.drawRect(Skia.XYWHRect(p.x, p.y, 4, 4), paint);
      }
      paint.setAlphaf(1);

      // Fireworks: bursts computed from the clock, no state to keep.
      if (fireworks) {
        const cols = ['#FF3B2E', '#FFE29A', '#3F88C5', '#FFFFFF', '#4ADE80', '#E05297'];
        for (let k = 0; k < 3; k++) {
          const tt = s.t + k * 0.45;
          const n = Math.floor(tt / 1.3);
          const lt = tt - n * 1.3;
          const fx = ((Math.sin(n * 12.9898 + k) * 43758.5453) % 1 + 1) % 1;
          const fy = ((Math.sin(n * 78.233 + k * 3) * 12345.678) % 1 + 1) % 1;
          const cx = s.width * (0.15 + fx * 0.7);
          const cy = s.skyTop + (s.skyBottom - s.skyTop) * (0.05 + fy * 0.4);
          const rad = lt * 110;
          paint.setColor(Skia.Color(cols[(n + k) % cols.length]));
          paint.setAlphaf(Math.max(0, 1 - lt / 1.3));
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            canvas.drawRect(Skia.XYWHRect(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad + lt * lt * 30, 4, 4), paint);
          }
        }
        paint.setAlphaf(1);
      }

      // Snow drifting down, from the clock alone (no state to keep).
      if (snowing) {
        paint.setColor(Skia.Color('#FFFFFF'));
        paint.setAlphaf(0.85);
        for (let i = 0; i < 60; i++) {
          const fall = 28 + (i % 7) * 9;
          const y = (i * 53 + s.t * fall) % s.height;
          const x = (i * 97 + Math.sin(s.t * 1.3 + i) * 14 + s.width * 4) % s.width;
          const size = i % 3 === 0 ? 4 : 3;
          canvas.drawRect(Skia.XYWHRect(x, y, size, size), paint);
        }
        paint.setAlphaf(1);
      }

      // Rogation: rain that thins and clears as the procession passes.
      if (s.fx.rogation) {
        const left = Math.max(0, 1 - s.t / 9);
        if (left > 0) {
          paint.setColor(Skia.Color('#22304E'));
          paint.setAlphaf(0.4 * left);
          canvas.drawRect(Skia.XYWHRect(0, 0, s.width, s.groundY), paint);
          paint.setColor(Skia.Color('#C8D8F0'));
          paint.setAlphaf(0.7 * left);
          const drops = Math.floor(70 * left);
          for (let i = 0; i < drops; i++) {
            const x = (i * 71 + s.t * 40) % s.width;
            const y = (i * 113 + s.t * 520) % s.groundY;
            canvas.drawRect(Skia.XYWHRect(x, y, 2, 10), paint);
          }
          paint.setAlphaf(1);
        }
      }

      // Candlemas: a row of candles on the bank; misses blow them out.
      if (s.fx.candles) {
        const lit = candlesLit(s);
        for (let i = 0; i < CANDLES; i++) {
          const cx = s.width * (0.08 + (i / (CANDLES - 1)) * 0.84);
          const cy = s.groundY + 2;
          paint.setColor(Skia.Color('#F4EEDC'));
          canvas.drawRect(Skia.XYWHRect(cx - 3, cy - 16, 6, 16), paint);
          if (i < lit) {
            const flick = Math.sin(s.t * 20 + i) * 1.5;
            paint.setColor(Skia.Color('#FFB44A'));
            canvas.drawRect(Skia.XYWHRect(cx - 2 + flick, cy - 24, 4, 7), paint);
            paint.setColor(Skia.Color('#FFF2B0'));
            canvas.drawRect(Skia.XYWHRect(cx - 1 + flick, cy - 22, 2, 4), paint);
          } else {
            paint.setColor(Skia.Color('#8A8A8A'));
            paint.setAlphaf(0.5);
            canvas.drawRect(Skia.XYWHRect(cx - 1, cy - 26 - ((s.t * 20) % 10), 2, 6), paint);
            paint.setAlphaf(1);
          }
        }
      }

      // Blizzard: whiteout gusts sweep across with the wind.
      if (windy) {
        paint.setColor(Skia.Color('#FFFFFF'));
        paint.setAlphaf(0.18 + 0.14 * Math.sin(s.t * 1.7));
        canvas.drawRect(Skia.XYWHRect(0, 0, s.width, s.height), paint);
        paint.setAlphaf(0.7);
        const dir = s.fx.wind > 0 ? 1 : -1;
        for (let i = 0; i < 40; i++) {
          const y = (i * 61) % s.height;
          const x = (((i * 131 + dir * s.t * 260) % s.width) + s.width) % s.width;
          canvas.drawRect(Skia.XYWHRect(x, y, 14, 2), paint);
        }
        paint.setAlphaf(1);
      }

      paint.setColor(Skia.Color('#FFE29A'));
      for (const b of s.bullets) canvas.drawRect(Skia.XYWHRect(b.x - 3, b.y - 3, 6, 6), paint);

      // Score pops: the bird's name over the points, bursting in large and settling.
      for (const pop of s.popups) {
        const age = POPUP_LIFE - pop.life;
        const grow = age < 0.12 ? 0.6 + (age / 0.12) * 0.9 : Math.max(1, 1.5 - (age - 0.12) * 2.5);
        canvas.save();
        canvas.translate(pop.x, pop.y);
        canvas.scale(grow, grow);
        const lines: [string, number, number][] = [[pop.label, 0.6, -18], [pop.text, 1, 0]];
        for (const [text, size, dy] of lines) {
          let x = (-text.length * 16 * size) / 2;
          for (const ch of text) {
            const g = pics.glyphs[ch];
            if (g) {
              canvas.save();
              canvas.translate(x, dy);
              canvas.scale(size, size);
              canvas.drawPicture(g);
              canvas.restore();
            }
            x += 16 * size;
          }
        }
        canvas.restore();
      }

      if (s.aiming) {
        paint.setColor(Skia.Color('#FFFFFF'));
        paint.setAlphaf(reloading(s) ? 0.3 : 0.7);
        const cos = Math.cos(s.aim);
        const sin = Math.sin(s.aim);
        for (let i = 0; i < 7; i++) {
          const dist = GUN_LENGTH + 14 + i * 18;
          canvas.drawRect(Skia.XYWHRect(s.gunX + cos * dist - 2, s.gunY + sin * dist - 2, 4, 4), paint);
        }
        paint.setAlphaf(1);
      }

      canvas.save();
      canvas.translate(s.gunX, s.gunY);
      canvas.rotate(((s.aim + Math.PI / 2) * 180) / Math.PI, 0, 0);
      canvas.translate((-GUN_W * 3) / 2, -GUN_H * 3 + 14);
      canvas.drawPicture(pics.gun);
      canvas.restore();

      if (!s.aiming) {
        paint.setColor(Skia.Color('#FFFFFF'));
        paint.setAlphaf(0.25);
        paint.setStyle(1);
        paint.setStrokeWidth(3);
        canvas.drawCircle(s.gunX, s.gunY, 34, paint);
        paint.setStyle(0);
        paint.setAlphaf(1);
      }

      const shown = shellsShown(s);
      for (let i = 0; i < s.clip; i++) {
        canvas.save();
        // Marauder Mode's 8 shells wrap into two rows.
        canvas.translate(s.gunX + 56 + (i % 4) * 18, s.gunY - 6 + Math.floor(i / 4) * 30 - (s.clip > 4 ? 15 : 0));
        if (i >= shown) {
          paint.setColor(Skia.Color('#FFFFFF'));
          paint.setAlphaf(0.18);
          canvas.drawRect(Skia.XYWHRect(0, 0, 12, 24), paint);
          paint.setAlphaf(1);
        } else canvas.drawPicture(pics.shell);
        canvas.restore();
      }
    });
  });

  return (
    <View style={{ width: width * scale, height: height * scale }}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width: width * scale, height: height * scale }}>
          <Group transform={[{ scale }]}>
            <Picture picture={bg} />
            <Picture picture={world} />
            <Picture picture={fg} />
            <Picture picture={overlay} />
          </Group>
        </Canvas>
      </GestureDetector>
      <View pointerEvents="none" style={[styles.hud, { top: (skyTop - 56) * scale }]}>
        <Pixel size={16 * scale} color={marauder ? '#FF5A4E' : C.white}>{`${hud.score}`}</Pixel>
        {hud.mult > 0 ? <Pixel size={11 * scale} color={C.gold}>{`×1.5 ${hud.mult}s`}</Pixel> : null}
        {hud.blessed ? <Pixel size={11 * scale} color={C.gold}>{'×3 ✝'}</Pixel> : null}
        <Pixel size={11 * scale} color={hud.left <= 3 ? '#FFB199' : C.white}>{`0:${String(hud.left).padStart(2, '0')}`}</Pixel>
      </View>
      {reloadingNow ? (
        <View pointerEvents="none" style={[styles.reload, { top: (gunY + 26) * scale, left: (width / 2 + 52) * scale }]}>
          <Pixel size={8} color="#FFE29A">RELOAD</Pixel>
        </View>
      ) : null}
      {banner ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bannerWrap]}>
          <Animated.View
            key={banner.key}
            entering={ZoomIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[styles.banner, banner.small && { paddingVertical: 5, paddingHorizontal: 8, borderWidth: 2 }]}
          >
            <Pixel size={banner.big ? 20 : banner.small ? 8 : 12} color={banner.color} style={{ textAlign: 'center', lineHeight: banner.big ? 34 : banner.small ? 13 : 20 }}>
              {banner.text}
            </Pixel>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reload: { position: 'absolute' },
  bannerWrap: { alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  banner: { backgroundColor: 'rgba(11,31,61,0.82)', borderWidth: 3, borderColor: C.orange, paddingVertical: 12, paddingHorizontal: 16, maxWidth: '88%' },
});
