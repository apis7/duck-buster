import { createPicture, Skia, type SkPicture } from '@shopify/react-native-skia';

import { PIXEL } from './engine';
import { DRAKE, DUCK_DOWN, DUCK_UP, GLYPHS, GUN, GUN_PALETTE, HEN, spritePixels, type Palette } from './sprites';

/** Sprites recorded once as Skia pictures; the frame loop only translates and stamps them. */

function picture(rows: string[], palette: Palette, scale = PIXEL): SkPicture {
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

let cache: GamePictures | null = null;

export type GamePictures = {
  drakeUp: SkPicture;
  drakeDown: SkPicture;
  henUp: SkPicture;
  henDown: SkPicture;
  gun: SkPicture;
  glyphs: Record<string, SkPicture>;
};

export function gamePictures(): GamePictures {
  if (cache) return cache;
  const glyphs: Record<string, SkPicture> = {};
  for (const [ch, rows] of Object.entries(GLYPHS)) glyphs[ch] = picture(rows, { '#': '#FFFFFF' }, 4);
  cache = {
    drakeUp: picture(DUCK_UP, DRAKE),
    drakeDown: picture(DUCK_DOWN, DRAKE),
    henUp: picture(DUCK_UP, HEN),
    henDown: picture(DUCK_DOWN, HEN),
    gun: picture(GUN, GUN_PALETTE),
    glyphs,
  };
  return cache;
}

/** Dawn sky in pixel bands, a blocky sun, and a reed line along the bottom. */
export function backgroundPicture(width: number, height: number, reedTop: number): SkPicture {
  return createPicture((canvas) => {
    const paint = Skia.Paint();
    const bands = ['#2B3F73', '#3E5A94', '#5F7DB3', '#8EA3C8', '#D9A98A', '#F0C38E'];
    const bandH = Math.ceil(reedTop / bands.length);
    bands.forEach((c, i) => {
      paint.setColor(Skia.Color(c));
      canvas.drawRect(Skia.XYWHRect(0, i * bandH, width, bandH + 1), paint);
    });
    // Sun, a stepped circle.
    paint.setColor(Skia.Color('#FFE29A'));
    const sx = width * 0.78;
    const sy = reedTop - 30;
    const r = 8;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      canvas.drawRect(Skia.XYWHRect(sx - half * 4, sy + y * 4, half * 8, 4), paint);
    }
    // Water.
    paint.setColor(Skia.Color('#30507E'));
    canvas.drawRect(Skia.XYWHRect(0, reedTop, width, height - reedTop), paint);
    // Reeds and cattails.
    const reed = Skia.Paint();
    reed.setColor(Skia.Color('#22381F'));
    const tail = Skia.Paint();
    tail.setColor(Skia.Color('#5A3A1E'));
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let x = 0; x < width; x += 6) {
      const h = 30 + rand() * 70;
      canvas.drawRect(Skia.XYWHRect(x, reedTop - h + 40, 4, h + height), reed);
      if (rand() < 0.18) canvas.drawRect(Skia.XYWHRect(x - 2, reedTop - h + 30, 8, 18), tail);
    }
    paint.setColor(Skia.Color('#1A2A18'));
    canvas.drawRect(Skia.XYWHRect(0, reedTop + 60, width, height), paint);
  });
}
