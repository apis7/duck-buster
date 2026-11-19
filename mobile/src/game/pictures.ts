import { createPicture, Skia, type SkPicture } from '@shopify/react-native-skia';

import { PIXEL } from './engine';
import {
  BANDED_GOOSE, COOT, COOT_DOWN, COOT_UP, DOG, DOG_PALETTE, DUCK_DOWN, DUCK_SIT, DUCK_UP, FLOCK_SPECIES, GLYPHS, GOOSE, GOOSE_DOWN,
  GOOSE_UP, GUN, GUN_PALETTE, PARTRIDGE_PALETTE, PARTRIDGE_TREE, SHELL, SHELL_PALETTE, spritePixels, SWAN, SWAN_DOWN, SWAN_UP,
  EAGLE_DOWN, EAGLE_PALETTE, EAGLE_UP, HEN_PHEASANT, PHEASANT_DOWN, PHEASANT_UP, PUMPKIN, PUMPKIN_PALETTE, ROOSTER, TURKEY, TURKEY_PALETTE,
  type Grid, type Palette,
} from './sprites';
import { THEMES, type Theme } from './theme';

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
  partridge: SkPicture;
  rooster: Flap;
  henPheasant: Flap;
  turkey: SkPicture;
  eagle: Flap;
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
    partridge: picture(PARTRIDGE_TREE, PARTRIDGE_PALETTE),
    rooster: flap(PHEASANT_UP, PHEASANT_DOWN, ROOSTER),
    henPheasant: flap(PHEASANT_UP, PHEASANT_DOWN, HEN_PHEASANT),
    turkey: picture(TURKEY, TURKEY_PALETTE),
    eagle: flap(EAGLE_UP, EAGLE_DOWN, EAGLE_PALETTE),
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

/** Marauder Mode's blood-red marsh; overrides the season. */
const MARAUDER_THEME: Theme = {
  ...THEMES.summer,
  sky: ['#1A0204', '#3A0508', '#5E0A0E', '#8A1014', '#B3261E', '#D9482C'],
  sun: '#FF3B2E',
  water: '#4A0A0E',
  ripple: '#7A1A1E',
  reeds: ['#1A0A0A'],
  frontReed: '#240C0C',
  mud: '#140404',
  snow: false,
  trees: false,
};

export function sceneTheme(theme: Theme, marauder: boolean): Theme {
  return marauder ? MARAUDER_THEME : theme;
}

/** A pixel Christmas tree with ornaments. 11 wide × 15 tall. */
const TREE = [
  '.....S.....',
  '.....G.....',
  '....GGG....',
  '...GGRGG...',
  '....GGG....',
  '...GGGGB...',
  '..GYGGGGG..',
  '....GGG....',
  '...GGRGGG..',
  '..GGGGGBGG.',
  '.GGBGGGGYGG',
  '...GGGGG...',
  '..GGGYGGGG.',
  '.GRGGGGGGBG',
  '.....T.....',
];
const TREE_PALETTE: Record<string, string> = { S: '#FFE29A', G: '#1E5A32', R: '#D7263D', B: '#3F88C5', Y: '#F2C230', T: '#5A3A1E' };

/** Dawn sky in pixel bands, a blocky sun, water, and the back row of reeds — dressed for the season. */
export function backgroundPicture(width: number, height: number, reedTop: number, theme: Theme): SkPicture {
  return createPicture((canvas) => {
    const paint = Skia.Paint();
    const bandH = Math.ceil(reedTop / theme.sky.length);
    theme.sky.forEach((c, i) => {
      paint.setColor(Skia.Color(c));
      canvas.drawRect(Skia.XYWHRect(0, i * bandH, width, bandH + 1), paint);
    });
    // St. Patrick's Day: a stepped pixel rainbow behind everything.
    if (theme.rainbow) {
      const colors = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#5E35B1'];
      const cx = width * 0.5;
      const cy = reedTop + 40;
      colors.forEach((c, i) => {
        paint.setColor(Skia.Color(c));
        const R = width * 0.62 - i * 10;
        for (let yy = -R; yy <= 0; yy += 4) {
          const half = Math.sqrt(Math.max(0, R * R - yy * yy));
          const inner = Math.sqrt(Math.max(0, (R - 10) * (R - 10) - yy * yy));
          canvas.drawRect(Skia.XYWHRect(cx - half, cy + yy, half - inner, 4), paint);
          canvas.drawRect(Skia.XYWHRect(cx + inner, cy + yy, half - inner, 4), paint);
        }
      });
    }

    // The sun — or, on a full moon, a big pale moon high in the sky.
    paint.setColor(Skia.Color(theme.sun));
    const sx = width * 0.78;
    const sy = theme.moon ? reedTop * 0.3 : reedTop - 30;
    const r = theme.moon ? 11 : 8;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      canvas.drawRect(Skia.XYWHRect(sx - half * 4, sy + y * 4, half * 8, 4), paint);
    }
    if (theme.moon) {
      paint.setColor(Skia.Color('#D6D2BC'));
      canvas.drawRect(Skia.XYWHRect(sx - 14, sy - 10, 10, 8), paint);
      canvas.drawRect(Skia.XYWHRect(sx + 10, sy + 6, 12, 10), paint);
      canvas.drawRect(Skia.XYWHRect(sx - 4, sy + 18, 8, 6), paint);
      // Stars.
      paint.setColor(Skia.Color('#F4F2E0'));
      const st = seeded(91);
      for (let i = 0; i < 40; i++) canvas.drawRect(Skia.XYWHRect(st() * width, st() * reedTop * 0.8, 2, 2), paint);
    }

    // Christmas trees on the far bank, behind the reeds.
    if (theme.trees) {
      const px = 4;
      for (const tx of [width * 0.06, width * 0.2, width * 0.82]) {
        const top = reedTop - TREE.length * px + 18;
        TREE.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const c = TREE_PALETTE[row[x]];
            if (!c) continue;
            paint.setColor(Skia.Color(c));
            canvas.drawRect(Skia.XYWHRect(tx + x * px, top + y * px, px + 0.5, px + 0.5), paint);
          }
        });
        // Snow on the boughs.
        paint.setColor(Skia.Color('#F4F7FA'));
        canvas.drawRect(Skia.XYWHRect(tx + 3 * px, top + 2 * px, 5 * px, px * 0.6), paint);
        canvas.drawRect(Skia.XYWHRect(tx + 2 * px, top + 6 * px, 7 * px, px * 0.6), paint);
        canvas.drawRect(Skia.XYWHRect(tx + px, top + 10 * px, 9 * px, px * 0.6), paint);
      }
    }

    paint.setColor(Skia.Color(theme.water));
    canvas.drawRect(Skia.XYWHRect(0, reedTop, width, height - reedTop), paint);
    const reed = Skia.Paint();
    const tail = Skia.Paint();
    tail.setColor(Skia.Color(theme.cattail));
    const snow = Skia.Paint();
    snow.setColor(Skia.Color('#F4F7FA'));
    const rand = seeded(7);
    for (let x = 0; x < width; x += 6) {
      const h = 30 + rand() * 70;
      const cat = rand() < 0.18;
      reed.setColor(Skia.Color(theme.reeds[Math.floor(rand() * theme.reeds.length)]));
      // The pond: only a few short reeds poke up at the back of the opening.
      if (inPond(x, width)) {
        if (rand() < 0.25) canvas.drawRect(Skia.XYWHRect(x, reedTop - 14, 3, 20), reed);
        continue;
      }
      const top = reedTop - h + 40;
      canvas.drawRect(Skia.XYWHRect(x, top, 4, h + height), reed);
      if (cat) canvas.drawRect(Skia.XYWHRect(x - 2, top - 10, 8, 18), tail);
      if (theme.snow) canvas.drawRect(Skia.XYWHRect(x - 1, cat ? top - 12 : top - 2, cat ? 10 : 6, 3), snow);
    }
    // Halloween: jack-o'-lanterns grinning along the bank.
    if (theme.pumpkins) {
      const px = 4;
      for (const fx of [0.04, 0.17, 0.79, 0.9]) {
        const top = reedTop + 26;
        PUMPKIN.forEach((row, yy) => {
          for (let xx = 0; xx < row.length; xx++) {
            const c = PUMPKIN_PALETTE[row[xx]];
            if (!c) continue;
            paint.setColor(Skia.Color(c));
            canvas.drawRect(Skia.XYWHRect(width * fx + xx * px, top + yy * px, px + 0.5, px + 0.5), paint);
          }
        });
      }
    }

    // Ripples on open water; ice cracks when it's frozen.
    const ripple = Skia.Paint();
    ripple.setColor(Skia.Color(theme.ripple));
    for (let i = 0; i < 14; i++) {
      const rx = width * 0.29 + rand() * width * 0.4;
      const ry = reedTop + 8 + rand() * 40;
      canvas.drawRect(Skia.XYWHRect(rx, ry, 10 + rand() * 18, 2), ripple);
    }
  });
}

/** The front row of reeds and the ground, drawn over the dogs so they come up out of cover. */
export function foregroundPicture(width: number, height: number, groundY: number, theme: Theme): SkPicture {
  return createPicture((canvas) => {
    const reed = Skia.Paint();
    reed.setColor(Skia.Color(theme.frontReed));
    const snow = Skia.Paint();
    snow.setColor(Skia.Color('#F4F7FA'));
    const rand = seeded(31);
    for (let x = -2; x < width; x += 5) {
      const h = 10 + rand() * 26;
      // Low bank in front of the pond so sitting ducks stay in view.
      const top = inPond(x, width) ? groundY + 2 : groundY - h;
      canvas.drawRect(Skia.XYWHRect(x, top, 4, height), reed);
      if (theme.snow) canvas.drawRect(Skia.XYWHRect(x - 1, top - 1, 6, 3), snow);
    }
    const mud = Skia.Paint();
    mud.setColor(Skia.Color(theme.mud));
    canvas.drawRect(Skia.XYWHRect(0, groundY + 6, width, height), mud);
    if (theme.snow) {
      // Drifts on the snowy ground.
      const drift = Skia.Paint();
      drift.setColor(Skia.Color('#D3DCE3'));
      for (let i = 0; i < 18; i++) canvas.drawRect(Skia.XYWHRect(rand() * width, groundY + 14 + rand() * 120, 18 + rand() * 30, 3), drift);
    }
  });
}
