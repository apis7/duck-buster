import { createPicture, Skia, type SkPicture } from '@shopify/react-native-skia';

import { PIXEL } from './engine';
import {
  BANDED_GOOSE, COOT, COOT_DOWN, COOT_UP, DOG, DOG_PALETTE, DUCK_DOWN, DUCK_SIT, DUCK_UP, FLOCK_SPECIES, GLYPHS, GOOSE, GOOSE_DOWN,
  GOOSE_UP, GUN, GUN_PALETTE, SHELL, SHELL_PALETTE, spritePixels, SWAN, SWAN_DOWN, SWAN_UP, type Grid, type Palette,
} from './sprites';

/** Sprites recorded once as Skia pictures; the frame loop only translates and stamps them. */

function picture(rows: Grid, palette: Palette, scale = PIXEL): SkPicture {
  const pixels = spritePixels(rows, palette);
  return createPicture((canvas) => {
    const paint = Skia.Paint();
    for (const p of pixels) {
      paint.setColor(Skia.Color(p.color));
      // A hair of overlap hides seams between pixels at fractional scales.
      canvas.drawRect(Skia.XYWHRect(p.x * scale, p.y * scale, scale + 0.5, scale + 0.5), paint);
    }
  });
}

const mirror = (rows: Grid, width: number): Grid => rows.map((r) => r.padEnd(width, '.').split('').reverse().join(''));

export type Flap = { up: SkPicture; down: SkPicture };
export type DuckPics = Flap & { sit: SkPicture };

export type GamePictures = {
  /** Per FLOCK_SPECIES index. */
  ducks: { drake: DuckPics; hen: DuckPics }[];
  goose: Flap;
  bandedGoose: Flap;
  swan: Flap;
  coot: Flap;
  dog: SkPicture;
  dogFlipped: SkPicture;
  gun: SkPicture;
  shell: SkPicture;
  glyphs: Record<string, SkPicture>;
};

let cache: GamePictures | null = null;

export function gamePictures(): GamePictures {
  if (cache) return cache;
  const flap = (up: Grid, down: Grid, pal: Palette): Flap => ({ up: picture(up, pal), down: picture(down, pal) });
  const glyphs: Record<string, SkPicture> = {};
  for (const [ch, rows] of Object.entries(GLYPHS)) glyphs[ch] = picture(rows, { '#': '#FFFFFF' }, 4);
  cache = {
    ducks: FLOCK_SPECIES.map((f) => ({
      drake: { ...flap(DUCK_UP, DUCK_DOWN, f.drake), sit: picture(DUCK_SIT, f.drake) },
      hen: { ...flap(DUCK_UP, DUCK_DOWN, f.hen), sit: picture(DUCK_SIT, f.hen) },
    })),
    goose: flap(GOOSE_UP, GOOSE_DOWN, GOOSE),
    bandedGoose: flap(GOOSE_UP, GOOSE_DOWN, BANDED_GOOSE),
    swan: flap(SWAN_UP, SWAN_DOWN, SWAN),
    coot: flap(COOT_UP, COOT_DOWN, COOT),
    dog: picture(DOG, DOG_PALETTE),
    dogFlipped: picture(mirror(DOG, 16), DOG_PALETTE),
    gun: picture(GUN, GUN_PALETTE),
    shell: picture(SHELL, SHELL_PALETTE, 4),
    glyphs,
  };
  return cache;
}

function seeded(seed: number) {
  return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
}

const inPond = (x: number, width: number) => x > width * 0.27 && x < width * 0.73;

/** Dawn sky in pixel bands, a blocky sun, water, and the back row of reeds with an opening of open water in the middle. */
export function backgroundPicture(width: number, height: number, reedTop: number): SkPicture {
  return createPicture((canvas) => {
    const paint = Skia.Paint();
    const bands = ['#2B3F73', '#3E5A94', '#5F7DB3', '#8EA3C8', '#D9A98A', '#F0C38E'];
    const bandH = Math.ceil(reedTop / bands.length);
    bands.forEach((c, i) => {
      paint.setColor(Skia.Color(c));
      canvas.drawRect(Skia.XYWHRect(0, i * bandH, width, bandH + 1), paint);
    });
    paint.setColor(Skia.Color('#FFE29A'));
    const sx = width * 0.78;
    const sy = reedTop - 30;
    const r = 8;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      canvas.drawRect(Skia.XYWHRect(sx - half * 4, sy + y * 4, half * 8, 4), paint);
    }
    paint.setColor(Skia.Color('#30507E'));
    canvas.drawRect(Skia.XYWHRect(0, reedTop, width, height - reedTop), paint);
    const reed = Skia.Paint();
    reed.setColor(Skia.Color('#22381F'));
    const tail = Skia.Paint();
    tail.setColor(Skia.Color('#5A3A1E'));
    const rand = seeded(7);
    for (let x = 0; x < width; x += 6) {
      const h = 30 + rand() * 70;
      const cat = rand() < 0.18;
      // The pond: only a few short reeds poke up at the back of the opening.
      if (inPond(x, width)) {
        if (rand() < 0.25) canvas.drawRect(Skia.XYWHRect(x, reedTop - 14, 3, 20), reed);
        continue;
      }
      canvas.drawRect(Skia.XYWHRect(x, reedTop - h + 40, 4, h + height), reed);
      if (cat) canvas.drawRect(Skia.XYWHRect(x - 2, reedTop - h + 30, 8, 18), tail);
    }
    // Ripples on the open water.
    const ripple = Skia.Paint();
    ripple.setColor(Skia.Color('#4A6E9E'));
    for (let i = 0; i < 14; i++) {
      const rx = width * 0.29 + rand() * width * 0.4;
      const ry = reedTop + 8 + rand() * 40;
      canvas.drawRect(Skia.XYWHRect(rx, ry, 10 + rand() * 18, 2), ripple);
    }
  });
}

/** The front row of reeds and the mud, drawn over the dogs so they come up out of cover. */
export function foregroundPicture(width: number, height: number, groundY: number): SkPicture {
  return createPicture((canvas) => {
    const reed = Skia.Paint();
    reed.setColor(Skia.Color('#2C4A27'));
    const rand = seeded(31);
    for (let x = -2; x < width; x += 5) {
      const h = 10 + rand() * 26;
      // Low bank in front of the pond so sitting ducks stay in view.
      const top = inPond(x, width) ? groundY + 2 : groundY - h;
      canvas.drawRect(Skia.XYWHRect(x, top, 4, height), reed);
    }
    const mud = Skia.Paint();
    mud.setColor(Skia.Color('#1A2A18'));
    canvas.drawRect(Skia.XYWHRect(0, groundY + 6, width, height), mud);
  });
}
