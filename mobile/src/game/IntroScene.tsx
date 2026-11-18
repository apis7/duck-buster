import {
  Canvas, createPicture, FillType, Group, Image, Paint, Path, Picture, Rect, Skia, useImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import { play } from '@/audio/sfx';
import { Pixel } from '@/ui/kit';

import { SHARD_CELL, SHARDS } from './introShards';
import { C } from '@/ui/theme';

/**
 * Launch animation: dawn over the marsh, reeds swaying, the Duck Buster logo
 * flaps up out of the reeds, takes three shots (real holes, punched through
 * with dstOut), then explodes — chunks of the logo fly outward and get blockier,
 * more pixelated, the further they go. Then the countdown starts.
 *
 * The logo is one image; the wing is cut out of it with a clip path and hinged
 * at the shoulder, so the silhouette is exactly the icon's.
 */

export const INTRO_MS = 3900;

/** Logo cut-out size (assets/intro/duck.png). */
const IMG_W = 427;
const IMG_H = 516;
/** The far wing (raised, upper left), in image coordinates, and the shoulder it hinges on. */
const WING = [[-5, -5], [175, 40], [212, 148], [152, 192], [95, 224], [40, 172], [-5, 40]] as const;
const SHOULDER = { x: 150, y: 188 };
/** The near wing: the pixel band under the body, hinged along its top edge. */
const NEAR_WING = [[-5, 232], [432, 232], [432, 346], [-5, 346]] as const;
const NEAR_HINGE_Y = 238;
/** Where the shots land, in image coordinates, and when (seconds). */
const SHOTS = [
  { x: 250, y: 200, at: 2.0 },
  { x: 150, y: 288, at: 2.3 },
  { x: 334, y: 124, at: 2.6 },
];

/** A ragged hole with a few cracks running out of it; seeded so each one differs. */
function jaggedHole(cx: number, cy: number, seed: number) {
  let n = seed * 97 + 13;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const pts: { x: number; y: number }[] = [];
  const spikes = 13;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    const r = i % 2 === 0 ? 10 + rand() * 9 : 5 + rand() * 4;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  const b = Skia.PathBuilder.Make().addPoly(pts, true);
  for (let c = 0; c < 3; c++) {
    const a = rand() * Math.PI * 2;
    const len = 20 + rand() * 14;
    const w = 0.12;
    b.addPoly(
      [
        { x: cx + Math.cos(a - w) * 7, y: cy + Math.sin(a - w) * 7 },
        { x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len },
        { x: cx + Math.cos(a + w) * 7, y: cy + Math.sin(a + w) * 7 },
      ],
      true,
    );
  }
  return b.build();
}
/** The logo blows apart here (seconds), and the pieces fly for EXPLODE_FOR. */
const EXPLODE_AT = 2.85;
const EXPLODE_FOR = 1.0;
/** Shards fly out from about the middle of the bird. */
const BLAST = { x: 220, y: 215 };
const END = INTRO_MS / 1000;

const SKY = ['#2B3F73', '#3E5A94', '#5F7DB3', '#8EA3C8', '#D9A98A', '#F0C38E'];

const ease = (x: number) => {
  'worklet';
  const c = Math.min(1, Math.max(0, x));
  return 1 - (1 - c) * (1 - c) * (1 - c);
};

export function IntroScene({ width, height, scale = 1 }: { width: number; height: number; scale?: number }) {
  const image = useImage(require('../../assets/intro/duck.png'));
  const t = useSharedValue(0);
  const reedTop = height * 0.72;
  // Fit the logo to the screen both ways: narrow phones and short ones.
  const dispW = Math.min(width * 0.62, 300, ((height * 0.34) * IMG_W) / IMG_H);
  const k = dispW / IMG_W;
  const dispH = IMG_H * k;

  useEffect(() => {
    t.value = withTiming(END, { duration: INTRO_MS, easing: Easing.linear });
    const timers = SHOTS.map((s) => setTimeout(() => play('shot'), s.at * 1000));
    timers.push(setTimeout(() => play('boom'), EXPLODE_AT * 1000));
    return () => timers.forEach(clearTimeout);
  }, [t]);

  const wingPath = useMemo(
    () => Skia.PathBuilder.Make().addPoly(WING.map(([x, y]) => ({ x, y })), true).build(),
    [],
  );
  const nearWingPath = useMemo(
    () => Skia.PathBuilder.Make().addPoly(NEAR_WING.map(([x, y]) => ({ x, y })), true).build(),
    [],
  );
  // Everything that isn't wing: the image rect with both wings cut out.
  const bodyPath = useMemo(
    () =>
      Skia.PathBuilder.Make()
        .addRect(Skia.XYWHRect(-10, -10, IMG_W + 20, IMG_H + 20))
        .addPath(wingPath)
        .addPath(nearWingPath)
        .setFillType(FillType.EvenOdd)
        .build(),
    [wingPath, nearWingPath],
  );
  const holes = useMemo(() => SHOTS.map((h, i) => jaggedHole(h.x, h.y, i + 1)), []);

  // Duck placement: rises out of the reeds, glides to centre, jolts on each hit, then tumbles.
  const duckTransform = useDerivedValue(() => {
    const s = t.value;
    const rise = ease((s - 0.15) / 1.45);
    const startY = reedTop + 10;
    const restY = height * 0.3 - dispH / 2;
    let x = width * 0.3 + (width * 0.5 - width * 0.3) * rise - dispW / 2;
    let y = startY + (restY - startY) * rise + Math.sin(s * 3) * 6 * rise;
    let rot = -0.25 * (1 - rise);
    for (const shot of SHOTS) {
      const d = s - shot.at;
      if (d > 0 && d < 0.25) {
        rot += Math.sin(d * 40) * 0.08 * (1 - d / 0.25);
        x += Math.sin(d * 60) * 4;
      }
    }
    return [
      { translateX: x + dispW / 2 },
      { translateY: y + dispH / 2 },
      { rotate: rot },
      { translateX: -dispW / 2 },
      { translateY: -dispH / 2 },
      { scale: k },
    ];
  });

  const duckOpacity = useDerivedValue(() => (t.value < EXPLODE_AT ? 1 : 0));

  // The explosion: every inked cell of the logo flies out from the middle. Early on
  // it's a crisp chunk of the real logo; the further it flies the coarser it gets —
  // 3×3 fine pixels, then 2×2, then one big block — fading as it goes.
  const explosion = useDerivedValue(() => {
    const e = t.value - EXPLODE_AT;
    return createPicture((canvas) => {
      if (e <= 0 || e > EXPLODE_FOR) return;
      const p = e / EXPLODE_FOR;
      const paint = Skia.Paint();
      // Flash.
      if (e < 0.18) {
        paint.setColor(Skia.Color('#FFF6D8'));
        paint.setAlphaf(1 - e / 0.18);
        canvas.drawCircle(BLAST.x, BLAST.y, 60 + e * 900, paint);
      }
      const ink = Skia.Paint();
      ink.setColor(Skia.Color('#13315C'));
      const half = SHARD_CELL / 2;
      for (let i = 0; i < SHARDS.length; i++) {
        const [sx, sy, cov] = SHARDS[i];
        const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        const r2 = Math.abs(Math.sin(i * 78.233) * 12345.678) % 1;
        const cx = sx + half;
        const cy = sy + half;
        let dx = cx - BLAST.x;
        let dy = cy - BLAST.y;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        dx /= len;
        dy /= len;
        const speed = 300 + r1 * 520;
        const vx = dx * speed + (r2 - 0.5) * 160;
        const vy = dy * speed + (r1 - 0.5) * 160 - 140;
        const px = cx + vx * e;
        const py = cy + vy * e + 380 * e * e;

        if (p < 0.3 && image) {
          paint.setAlphaf(1 - p / 0.3);
          canvas.drawImageRect(
            image,
            Skia.XYWHRect(sx, sy, SHARD_CELL, SHARD_CELL),
            Skia.XYWHRect(px - half, py - half, SHARD_CELL, SHARD_CELL),
            paint,
          );
        }
        // Pixel phase: fewer, bigger blocks the further out, snapped to a 4px grid.
        const n = Math.max(1, 3 - Math.floor(p * 3));
        const block = (SHARD_CELL / n) * (1 + p * 0.7);
        const spread = block + p * 14;
        ink.setAlphaf(Math.min(1, p / 0.2) * Math.pow(1 - p, 0.8) * Math.min(1, cov * 1.4));
        for (let gx = 0; gx < n; gx++)
          for (let gy = 0; gy < n; gy++) {
            const bx = Math.round((px - (spread * n) / 2 + gx * spread) / 4) * 4;
            const by = Math.round((py - (spread * n) / 2 + gy * spread) / 4) * 4;
            canvas.drawRect(Skia.XYWHRect(bx, by, block, block), ink);
          }
      }
    });
  });

  // Wingbeat, both wings together: beat 1 = wings up, −1 = wings down. Once the
  // shooting starts the wings lock down (the logo's own near-wing pose).
  const beat = useDerivedValue(() => {
    const s = t.value;
    if (s >= SHOTS[0].at) return -1;
    const hz = s < 1.6 ? 5.5 : 3.5;
    return Math.cos(s * hz * Math.PI * 2);
  });
  const hinge = (x: number, y: number, scaleY: number) => {
    'worklet';
    return [{ translateX: x }, { translateY: y }, { scaleY }, { translateX: -x }, { translateY: -y }];
  };
  // Far wing: drawn up in the logo; squashes down through the shoulder.
  const wingTransform = useDerivedValue(() => {
    const b = beat.value;
    return hinge(SHOULDER.x, SHOULDER.y, -0.55 + 1.55 * ((b + 1) / 2));
  });
  // Near wing: drawn down in the logo; flips up over the back on the upstroke.
  const nearWingTransform = useDerivedValue(() => {
    const b = beat.value;
    return hinge(0, NEAR_HINGE_Y, 1 - 1.8 * ((b + 1) / 2));
  });

  const hole0 = useDerivedValue(() => (t.value >= SHOTS[0].at ? 1 : 0));
  const hole1 = useDerivedValue(() => (t.value >= SHOTS[1].at ? 1 : 0));
  const hole2 = useDerivedValue(() => (t.value >= SHOTS[2].at ? 1 : 0));
  const holeShown = [hole0, hole1, hole2];

  // Navy flecks blown out of each hole.
  const debris = useDerivedValue(() => {
    const s = t.value;
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color('#13315C'));
      SHOTS.forEach((shot, n) => {
        const d = s - shot.at;
        if (d <= 0 || d > 0.7) return;
        paint.setAlphaf(1 - d / 0.7);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + n;
          const v = 160 + ((i * 37) % 90);
          const px = shot.x + Math.cos(a) * v * d;
          const py = shot.y + Math.sin(a) * v * d + 500 * d * d;
          canvas.drawRect(Skia.XYWHRect(px, py, 9, 9), paint);
        }
      });
    });
  });

  // Reeds swaying in the dawn breeze; cattail heads on some.
  const reeds = useMemo(() => {
    const list: { x: number; h: number; cat: boolean; ph: number }[] = [];
    let seed = 11;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let x = -4; x < width + 8; x += 7) list.push({ x, h: 50 + rand() * 90, cat: rand() < 0.2, ph: rand() * 6 });
    return list;
  }, [width]);

  const reedPicture = useDerivedValue(() => {
    const s = t.value;
    return createPicture((canvas) => {
      const stem = Skia.Paint();
      stem.setColor(Skia.Color('#22381F'));
      const tail = Skia.Paint();
      tail.setColor(Skia.Color('#5A3A1E'));
      for (const r of reeds) {
        // Draw each reed as stacked 4px blocks that lean more toward the tip.
        const sway = Math.sin(s * 2.2 + r.ph) * 7 + Math.sin(s * 5.1 + r.ph * 2) * 2;
        const segs = Math.ceil(r.h / 8);
        for (let i = 0; i < segs; i++) {
          const f = i / segs;
          canvas.drawRect(Skia.XYWHRect(r.x + sway * f * f, reedTop - i * 8 + 40, 4, 9), stem);
        }
        if (r.cat) canvas.drawRect(Skia.XYWHRect(r.x - 2 + sway, reedTop - segs * 8 + 30, 8, 18), tail);
      }
      const mud = Skia.Paint();
      mud.setColor(Skia.Color('#1A2A18'));
      canvas.drawRect(Skia.XYWHRect(0, reedTop + 48, width, height), mud);
    });
  });

  const titleStyle = useAnimatedStyle(() => {
    const s = t.value;
    const inA = Math.min(1, Math.max(0, (s - 1.3) / 0.5));
    const outA = s > EXPLODE_AT ? Math.max(0, 1 - (s - EXPLODE_AT) / 0.5) : 1;
    return { opacity: inA * outA, transform: [{ translateY: 12 * (1 - inA) }] };
  });

  const bandH = Math.ceil(reedTop / SKY.length);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={{ width: width * scale, height: height * scale }}>
        <Group transform={[{ scale }]}>
        {SKY.map((c, i) => (
          <Rect key={c} x={0} y={i * bandH} width={width} height={bandH + 1} color={c} />
        ))}
        <Rect x={0} y={reedTop} width={width} height={height - reedTop} color="#30507E" />
        {image ? (
          <Group transform={duckTransform} opacity={duckOpacity} layer={<Paint />}>
            <Group clip={bodyPath}>
              <Image image={image} x={0} y={0} width={IMG_W} height={IMG_H} />
            </Group>
            <Group transform={wingTransform}>
              <Group clip={wingPath}>
                <Image image={image} x={0} y={0} width={IMG_W} height={IMG_H} />
              </Group>
            </Group>
            <Group transform={nearWingTransform}>
              <Group clip={nearWingPath}>
                <Image image={image} x={0} y={0} width={IMG_W} height={IMG_H} />
              </Group>
            </Group>
            {holes.map((hole, i) => (
              <Path key={i} path={hole} color="black" blendMode="dstOut" opacity={holeShown[i]} />
            ))}
            <Picture picture={debris} />
          </Group>
        ) : null}
        <Group transform={duckTransform}>
          <Picture picture={explosion} />
        </Group>
        <Picture picture={reedPicture} />
        </Group>
      </Canvas>
      <Animated.View pointerEvents="none" style={[styles.title, { top: (height * 0.3 + dispH / 2 + 18) * scale }, titleStyle]}>
        <Pixel size={24 * scale} color={C.white} style={{ textAlign: 'center', lineHeight: 34 * scale }}>
          DUCK BUSTER
        </Pixel>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
