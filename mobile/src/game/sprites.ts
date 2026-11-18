/**
 * Pixel sprites as text grids. One character per pixel; `.` is transparent.
 * Kept free of Skia so the geometry can be unit-tested; game/pictures.ts turns
 * them into Skia pictures once at startup.
 */

export type Palette = Record<string, string>;

/** Facing right, wings up. 16 × 10. */
export const DUCK_UP = [
  '...DDD..........',
  '....DDD.........',
  '.....DDD...GG...',
  '.....DbDD.GGEG..',
  '......DDD.GGGYYY',
  'KKSSSSSSSWGG....',
  '.KSSSSSSSBBB....',
  '..SSSSSSBBB.....',
  '...SSSSSS.......',
  '.....OO.........',
];

/** Facing right, wings down. 16 × 10. */
export const DUCK_DOWN = [
  '................',
  '................',
  '...........GG...',
  '..........GGEG..',
  '..........GGGYYY',
  'KKSSSSSSSWGG....',
  '.KSSDDDDSBBB....',
  '..SSDbDDDBB.....',
  '....DDDDD.......',
  '.....DDD........',
];

export const DUCK_W = 16;
export const DUCK_H = 10;

export const DRAKE: Palette = {
  G: '#1F7A43', E: '#101010', Y: '#F2C230', W: '#F4F4F4', B: '#7A3A24',
  S: '#B8B2A6', D: '#6E665C', b: '#3550C8', K: '#202020', O: '#F08A2A',
};

export const HEN: Palette = {
  G: '#8A6A48', E: '#101010', Y: '#E07A2A', W: '#8A6A48', B: '#9A7652',
  S: '#A8865E', D: '#6E5236', b: '#3550C8', K: '#5A4430', O: '#F08A2A',
};

/** Shotgun pointing straight up; pivot is the bottom-centre. 5 × 22. */
export const GUN = [
  '.MM..',
  '.MM..',
  '.MM..',
  '.MM..',
  '.MM..',
  '.MM..',
  '.MM..',
  '.MM..',
  '.MMM.',
  '.MMM.',
  'WWWWW',
  'WWWWW',
  '.WWW.',
  '.WTW.',
  '.WTW.',
  '.WWW.',
  '.WWW.',
  '.WWW.',
  'WWWWW',
  'WWWWW',
  'WWWWW',
  '.WWW.',
];

export const GUN_W = 5;
export const GUN_H = 22;
export const GUN_PALETTE: Palette = { M: '#3A3F48', W: '#8A5A2E', T: '#2A2A2A' };

/** 3 × 5 digits and '+' for score popups. */
export const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

export type PixelRect = { x: number; y: number; color: string };

/** Grid → list of opaque pixels with their colors. */
export function spritePixels(rows: string[], palette: Palette): PixelRect[] {
  const out: PixelRect[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || !palette[ch]) continue;
      out.push({ x, y, color: palette[ch] });
    }
  });
  return out;
}
