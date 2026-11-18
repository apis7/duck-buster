import { Canvas, Picture, createPicture, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { play } from '@/audio/sfx';
import { C } from '@/ui/theme';
import { Pixel } from '@/ui/kit';

import { aimToward, DUCK_PX_H, DUCK_PX_W, fire, GAME_SECONDS, GUN_LENGTH, newGame, step, wingsUp, type GameState } from './engine';
import { backgroundPicture, gamePictures } from './pictures';
import { GUN_H, GUN_W } from './sprites';

export type GameResult = { score: number; shots: number; hits: number; vitals: number };

/** Touches that start within this radius of the gun pick it up. */
const GRAB_RADIUS = 80;

/**
 * The 12-second shoot. Simulation, drawing and touch handling all run on the UI
 * thread; the JS thread only hears about score changes (for the HUD) and the end.
 */
export function GameView({
  width, height, gunY, skyTop, running, onEnd,
}: { width: number; height: number; gunY: number; skyTop: number; running: boolean; onEnd: (r: GameResult) => void }) {
  const pics = useMemo(() => gamePictures(), []);
  const bg = useMemo(() => backgroundPicture(width, height, gunY - 120), [width, height, gunY]);
  const state = useSharedValue<GameState>(newGame(width, height, gunY, skyTop));
  const live = useSharedValue(false);
  const [hud, setHud] = useState({ score: 0, left: GAME_SECONDS });
  const ended = useRef(false);

  const lastScore = useSharedValue(0);
  const lastLeft = useSharedValue(GAME_SECONDS);

  const onHud = (score: number, left: number, sound: number) => {
    setHud({ score, left });
    if (sound === 3) play('vital');
    else if (sound === 1) play('hit');
  };
  const onShot = () => play('shot');
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
    state.modify((s) => {
      'worklet';
      step(s, dt);
      return s;
    });
    const s = state.value;
    const left = Math.max(0, Math.ceil(GAME_SECONDS - s.t));
    if (s.score !== lastScore.value || left !== lastLeft.value) {
      const gained = s.score - lastScore.value;
      lastScore.value = s.score;
      lastLeft.value = left;
      scheduleOnRN(onHud, s.score, left, gained);
    }
    if (s.over) {
      live.set(false);
      scheduleOnRN(finish, { score: s.score, shots: s.shots, hits: s.hits, vitals: s.vitals });
    }
  });

  const pan = usePanGesture({
    minDistance: 0,
    maxPointers: 1,
    onBegin: (e) => {
      'worklet';
      if (!live.value) return;
      const s = state.value;
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
      scheduleOnRN(onShot);
    },
  });

  const frame = useDerivedValue(() => {
    const s = state.value;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      for (const d of s.ducks) {
        const up = d.alive ? wingsUp(d, s.t) : false;
        const pic = d.hen ? (up ? pics.henUp : pics.henDown) : up ? pics.drakeUp : pics.drakeDown;
        canvas.save();
        if (d.alive) {
          canvas.translate(d.x, d.y);
        } else {
          canvas.translate(d.x + DUCK_PX_W / 2, d.y + DUCK_PX_H / 2);
          canvas.rotate((d.rot * 180) / Math.PI, 0, 0);
          canvas.scale(1, -1);
          canvas.translate(-DUCK_PX_W / 2, -DUCK_PX_H / 2);
        }
        canvas.drawPicture(pic);
        canvas.restore();
      }

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

      // Aim guide.
      if (s.aiming) {
        paint.setColor(Skia.Color('#FFFFFF'));
        paint.setAlphaf(0.7);
        const cos = Math.cos(s.aim);
        const sin = Math.sin(s.aim);
        for (let i = 0; i < 7; i++) {
          const dist = GUN_LENGTH + 14 + i * 18;
          canvas.drawRect(Skia.XYWHRect(s.gunX + cos * dist - 2, s.gunY + sin * dist - 2, 4, 4), paint);
        }
        paint.setAlphaf(1);
      }

      // Gun, pivoting on its butt.
      canvas.save();
      canvas.translate(s.gunX, s.gunY);
      canvas.rotate(((s.aim + Math.PI / 2) * 180) / Math.PI, 0, 0);
      canvas.translate((-GUN_W * 3) / 2, -GUN_H * 3 + 14);
      canvas.drawPicture(pics.gun);
      canvas.restore();

      // Grab ring hint while the gun is idle.
      if (!s.aiming) {
        paint.setColor(Skia.Color('#FFFFFF'));
        paint.setAlphaf(0.25);
        paint.setStyle(1);
        paint.setStrokeWidth(3);
        canvas.drawCircle(s.gunX, s.gunY, 34, paint);
        paint.setStyle(0);
        paint.setAlphaf(1);
      }
    });
  });

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          <Picture picture={bg} />
          <Picture picture={frame} />
        </Canvas>
      </GestureDetector>
      <View pointerEvents="none" style={[styles.hud, { top: skyTop - 56 }]}>
        <Pixel size={16} color={C.white}>{`${hud.score}`}</Pixel>
        <Pixel size={11} color={hud.left <= 3 ? '#FFB199' : C.white}>{`0:${String(hud.left).padStart(2, '0')}`}</Pixel>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
