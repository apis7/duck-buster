import { Canvas, createPicture, Picture, Skia, type SkCanvas } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeOut, useDerivedValue, useFrameCallback, useSharedValue, ZoomIn } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { play } from '@/audio/sfx';
import { Pixel } from '@/ui/kit';
import { C } from '@/ui/theme';

import {
  aimToward, CLIP, dogTop, finished, fire, GAME_SECONDS, GUN_LENGTH, newGame, reloading, shellsShown, step, wingsUp,
  type Bird, type GameEvent, type GameState,
} from './engine';
import { backgroundPicture, foregroundPicture, gamePictures, type GamePictures } from './pictures';
import { GUN_H, GUN_W } from './sprites';

export type GameResult = { score: number; shots: number; hits: number; kos: number; geese: number; swans: number; coots: number };

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

type Banner = { key: number; text: string; color: string; big?: boolean };

function drawBird(canvas: SkCanvas, pics: GamePictures, b: Bird, t: number) {
  'worklet';
  const up = b.alive ? wingsUp(b, t) : false;
  let flap;
  if (b.kind === 'goose') flap = b.banded ? pics.bandedGoose : pics.goose;
  else if (b.kind === 'swan') flap = pics.swan;
  else if (b.kind === 'coot') flap = pics.coot;
  else flap = b.hen ? pics.ducks[b.species].hen : pics.ducks[b.species].drake;
  const pic = up ? flap.up : flap.down;
  const scale = b.kind === 'duck' ? b.w / 48 : 1;
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
  canvas.drawPicture(pic);
  canvas.restore();
}

/**
 * The 12-second shoot. Simulation, drawing and touch handling all run on the UI
 * thread; the JS thread hears about events (sounds, banners) and the end.
 */
export function GameView({
  width, height, gunY, skyTop, running, onEnd,
}: { width: number; height: number; gunY: number; skyTop: number; running: boolean; onEnd: (r: GameResult) => void }) {
  const pics = useMemo(() => gamePictures(), []);
  const initial = useMemo(() => newGame(width, height, gunY, skyTop), [width, height, gunY, skyTop]);
  const bg = useMemo(() => backgroundPicture(width, height, gunY - 120), [width, height, gunY]);
  const fg = useMemo(() => foregroundPicture(width, height, initial.groundY), [width, height, initial.groundY]);
  const state = useSharedValue<GameState>(initial);
  const live = useSharedValue(false);
  const lastScore = useSharedValue(0);
  const lastLeft = useSharedValue(GAME_SECONDS);
  const [hud, setHud] = useState({ score: 0, left: GAME_SECONDS });
  const [banner, setBanner] = useState<Banner | null>(null);
  const [reloadingNow, setReloadingNow] = useState(false);
  const ended = useRef(false);
  const bannerKey = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const showBanner = (text: string, color: string, big = false, ms = 1300) => {
    bannerKey.current += 1;
    const key = bannerKey.current;
    setBanner({ key, text, color, big });
    later(ms, () => setBanner((b) => (b?.key === key ? null : b)));
  };

  const onHud = (score: number, left: number) => setHud({ score, left });

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
          showBanner(COOT_JABS[Math.floor(Math.random() * COOT_JABS.length)], '#FFB199');
          break;
        case 'dog': play('woof'); break;
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
    if (s.score !== lastScore.value || left !== lastLeft.value) {
      lastScore.value = s.score;
      lastLeft.value = left;
      scheduleOnRN(onHud, s.score, left);
    }
    if (finished(s)) {
      live.set(false);
      scheduleOnRN(finish, { score: s.score, shots: s.shots, hits: s.hits, kos: s.kos, geese: s.geese, swans: s.swans, coots: s.coots });
    }
  });

  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    onBegin: (e) => {
      'worklet';
      const s = state.value;
      if (!live.value || s.over) return;
      const dx = e.x - s.gunX;
      const dy = e.y - s.gunY;
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
        aimToward(st, e.x, e.y);
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
        canvas.drawRect(Skia.XYWHRect(p.x, p.y, 4, 4), paint);
      }
      paint.setAlphaf(1);

      paint.setColor(Skia.Color('#FFE29A'));
      for (const b of s.bullets) canvas.drawRect(Skia.XYWHRect(b.x - 3, b.y - 3, 6, 6), paint);

      for (const pop of s.popups) {
        let x = pop.x - (pop.text.length * 16) / 2;
        for (const ch of pop.text) {
          const g = pics.glyphs[ch];
          if (g) {
            canvas.save();
            canvas.translate(x, pop.y);
            canvas.drawPicture(g);
            canvas.restore();
          }
          x += 16;
        }
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
      for (let i = 0; i < CLIP; i++) {
        canvas.save();
        canvas.translate(s.gunX + 56 + i * 18, s.gunY - 6);
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
    <View style={{ width, height }}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          <Picture picture={bg} />
          <Picture picture={world} />
          <Picture picture={fg} />
          <Picture picture={overlay} />
        </Canvas>
      </GestureDetector>
      <View pointerEvents="none" style={[styles.hud, { top: skyTop - 56 }]}>
        <Pixel size={16} color={C.white}>{`${hud.score}`}</Pixel>
        <Pixel size={11} color={hud.left <= 3 ? '#FFB199' : C.white}>{`0:${String(hud.left).padStart(2, '0')}`}</Pixel>
      </View>
      {reloadingNow ? (
        <View pointerEvents="none" style={[styles.reload, { top: gunY + 26, left: width / 2 + 52 }]}>
          <Pixel size={8} color="#FFE29A">RELOAD</Pixel>
        </View>
      ) : null}
      {banner ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bannerWrap]}>
          <Animated.View key={banner.key} entering={ZoomIn.springify().damping(9)} exiting={FadeOut.duration(200)} style={styles.banner}>
            <Pixel size={banner.big ? 20 : 12} color={banner.color} style={{ textAlign: 'center', lineHeight: banner.big ? 34 : 20 }}>
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
