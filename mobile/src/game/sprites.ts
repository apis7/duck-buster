/**
 * Pixel sprites as text grids. One character per pixel; `.` is transparent.
 * Kept free of Skia so the geometry can be unit-tested; game/pictures.ts turns
 * them into Skia pictures once at startup.
 */

export type Palette = Record<string, string>;
export type Grid = string[];

/* ── Ducks ─────────────────────────────────────────────────────────────── */
// G head · E eye · Y bill · W neck ring / cheek · B breast · S body · D wing
// b speculum · K tail · O feet

/** Facing right, wings up. 16 × 10. */
export const DUCK_UP: Grid = [
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
export const DUCK_DOWN: Grid = [
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

/** Sitting on the water, wings folded, facing right. 16 × 10. */
export const DUCK_SIT: Grid = [
  '................',
  '................',
  '..........GG....',
  '.........GGEG...',
  '.........GGGYYY.',
  '.........WGG....',
  '.KKSSSSSSBBB....',
  'KSSDDDDDSBBB....',
  '.SSSSSSSSSB.....',
  '..SSSSSSSS......',
];

export const DUCK_W = 16;
export const DUCK_H = 10;

const duck = (G: string, Y: string, W: string, B: string, S: string, D: string, b: string, K: string): Palette => ({
  G, E: '#101010', Y, W, B, S, D, b, K, O: '#F08A2A',
});

const DABBLER_HEN = duck('#8A6A48', '#5C5248', '#8A6A48', '#9A7652', '#A8865E', '#6E5236', '#3550C8', '#5A4430');
const DIVER_HEN = duck('#7A6450', '#6E7A86', '#7A6450', '#8A745E', '#9A8A78', '#6A5A4A', '#C9C9C2', '#4A3C30');

/**
 * Flock species, common on South Dakota's prairie potholes and the Missouri.
 * `weight` sets how often each shows up; teal are small and quick.
 */
export type FlockSpecies = {
  id: string;
  /** Relative odds of a flock being this species; 0 = never in a flock. */
  weight: number;
  scale: number;
  speed: number;
  drake: Palette;
  hen: Palette;
  /** Darts up and down at random (teal, wood ducks). */
  jinks?: boolean;
  /** Flies alone, never in a flock (mergansers). */
  solo?: boolean;
  /** Extra points when knocked down. */
  bonus?: number;
  /** What the knockdown burst calls it. */
  name: string;
  /** Sometimes drops onto the open water and sits there (gadwall, spoonies). */
  lands?: boolean;
};

export const FLOCK_SPECIES: FlockSpecies[] = [
  { id: 'mall', name: 'MALLARD', weight: 30, scale: 1, speed: 1,
    drake: duck('#1F7A43', '#F2C230', '#F4F4F4', '#7A3A24', '#B8B2A6', '#6E665C', '#3550C8', '#202020'),
    hen: { ...DABBLER_HEN, Y: '#E07A2A' } },
  { id: 'bwte', name: 'BLUE-WING', weight: 14, scale: 0.8, speed: 1.35, jinks: true,
    drake: duck('#4A5A7A', '#2A2A2A', '#F4F4F4', '#B08A62', '#9C7652', '#86A9D1', '#2E7A45', '#2A2A2A'),
    hen: { ...DABBLER_HEN, D: '#86A9D1' } },
  { id: 'gwte', name: 'GREEN-WING', weight: 12, scale: 0.78, speed: 1.4, jinks: true,
    drake: duck('#8E3A22', '#2A2A2A', '#1F7A48', '#E2CDB0', '#A3A6A8', '#7E8285', '#1F7A48', '#E8D27A'),
    hen: { ...DABBLER_HEN, b: '#1F7A48' } },
  { id: 'nopi', name: 'PINTAIL', weight: 9, scale: 1.05, speed: 1.1,
    drake: duck('#6B4B32', '#5C6E80', '#F4F4F4', '#F4F4F4', '#B9B9B5', '#8E8E8A', '#3F7A4A', '#222222'),
    hen: DABBLER_HEN },
  { id: 'gadw', name: 'GADWALL', weight: 10, scale: 0.95, speed: 0.78, lands: true,
    drake: duck('#8A7F72', '#3A3A3A', '#8A7F72', '#7C756C', '#8E8A84', '#6D665E', '#F2F2F2', '#1E1E1E'),
    hen: { ...DABBLER_HEN, b: '#F2F2F2' } },
  { id: 'amwi', name: 'WIGEON', weight: 8, scale: 0.92, speed: 1.05,
    drake: duck('#CFCAB8', '#9BB5C9', '#2E7A45', '#B27A5C', '#B27A5C', '#8C7A6A', '#2E7A45', '#2A2A2A'),
    hen: { ...DABBLER_HEN, Y: '#9BB5C9' } },
  { id: 'nsho', name: 'SPOONIE', weight: 8, scale: 0.95, speed: 0.78, lands: true,
    drake: duck('#1E5A36', '#1C1C1C', '#1E5A36', '#F4F2EC', '#B25A2E', '#9BB7D4', '#2E7A45', '#222222'),
    hen: { ...DABBLER_HEN, D: '#9BB7D4' } },
  { id: 'redh', name: 'REDHEAD', weight: 5, scale: 1, speed: 1.15,
    drake: duck('#B5452A', '#8FA8C0', '#B5452A', '#1E1E1E', '#9C9C98', '#8A8A86', '#C9C9C2', '#1E1E1E'),
    hen: DIVER_HEN },
  { id: 'canv', name: 'CANVASBACK', weight: 4, scale: 1.05, speed: 1.2,
    drake: duck('#8E3A22', '#1E1E1E', '#8E3A22', '#1E1E1E', '#ECECE6', '#D8D8D0', '#ECECE6', '#1E1E1E'),
    hen: DIVER_HEN },
  { id: 'wodu', name: 'WOODIE', weight: 10, scale: 0.9, speed: 1.15, jinks: true,
    drake: duck('#1F5A44', '#D9452E', '#F4F4F4', '#7A3A2A', '#C8B07A', '#2E3A5A', '#3550C8', '#1A1A2A'),
    hen: duck('#6E6A66', '#4A4A4A', '#F4F4F4', '#8A7460', '#7E7468', '#4E4A50', '#3550C8', '#3A3634') },
  // Mergansers: alone, fast, +2 on knockdown.
  { id: 'home', name: 'HOODIE', weight: 0, scale: 0.9, speed: 1.6, solo: true, bonus: 2,
    drake: duck('#1E1E1E', '#1E1E1E', '#F4F4F4', '#F4F4F4', '#A8642E', '#1E1E1E', '#F4F4F4', '#2A2A2A'),
    hen: duck('#A0703E', '#5A4A3A', '#A0703E', '#8A7A6A', '#7A6E62', '#4E4640', '#F4F4F4', '#4A4038') },
  { id: 'come', name: 'MERGANSER', weight: 0, scale: 1.05, speed: 1.6, solo: true, bonus: 2,
    drake: duck('#1E4A30', '#C8342A', '#F4F0E8', '#F4F0E8', '#F4F0E8', '#1E1E1E', '#F4F4F4', '#8A8A8A'),
    hen: duck('#9A4A28', '#C8342A', '#F4F0E8', '#C8C8C4', '#9A9A96', '#6A6A66', '#F4F4F4', '#6A6A66') },
];

/* ── Goose: N head/neck · C chinstrap · Y bill · B breast · S body · D wing · K tail · U rump · O feet ── */

export const GOOSE_UP: Grid = [
  '...DDD',
  '....DDD',
  '.....DDD',
  '.....DDDD..........NNN',
  '......DDD.........NNCNNY',
  'KKSSSSSSSSSBBBNNNNNN',
  '.KUSSSSSSSSBBBB',
  '..SSSSSSSSBBB',
  '....SSSSSS',
  '......OO',
  '',
];

export const GOOSE_DOWN: Grid = [
  '',
  '',
  '',
  '...................NNN',
  '..................NNCNNY',
  'KKSSSSSSSSSBBBNNNNNN',
  '.KUSSDDDDDSBBBB',
  '..SSSDDDDDDBB',
  '......DDDDD',
  '.......DDD',
  '........DD',
];

export const GOOSE_W = 24;
export const GOOSE_H = 11;

export const GOOSE: Palette = {
  N: '#141414', C: '#F4F4F4', Y: '#141414', B: '#C8B8A0', S: '#8C7A64', D: '#6E5E4C', K: '#141414', U: '#F4F4F4', O: '#2A2A2A',
};
/** The band: a silver leg band and a hint of gold on the wing. */
export const BANDED_GOOSE: Palette = { ...GOOSE, O: '#D9DEE5', D: '#8A744C' };

/* ── Swan: W body · V wing shade · N neck · K bill/feet · T tail ── */

export const SWAN_UP: Grid = [
  '...VVV',
  '....VVV',
  '.....VVVV',
  '.....VVVV.............NN',
  '......VVV............NNNKK',
  'TWWWWWWWWWWWWWWNNNNNNNN',
  '.TWWWWWWWWWWWWW',
  '..WWWWWWWWWW',
  '....WWWWWW',
  '......KK',
  '',
];

export const SWAN_DOWN: Grid = [
  '',
  '',
  '',
  '......................NN',
  '.....................NNNKK',
  'TWWWWWWWWWWWWWWNNNNNNNN',
  '.TWWVVVVVVWWWWW',
  '..WWWVVVVVVW',
  '......VVVVV',
  '.......VVV',
  '........VV',
];

export const SWAN_W = 26;
export const SWAN_H = 11;
export const SWAN: Palette = { W: '#F7F7F2', V: '#DADAD2', N: '#F7F7F2', K: '#141414', T: '#E6E6DE' };

/* ── Coot: H head · E red eye · W white bill · S body · D wing · F green feet ── */

export const COOT_UP: Grid = [
  '..DD',
  '...DD',
  '....DD...HH',
  '....DD..HEHW',
  'SSSSSSSSHHW',
  '.SSSSSSSS',
  '..SSSSSS',
  '...FF.FF',
  '',
];

export const COOT_DOWN: Grid = [
  '',
  '',
  '.........HH',
  '........HEHW',
  'SSSSSSSSHH',
  '.SSDDDDSS',
  '..SDDDDS',
  '...FDDF',
  '....D',
];

export const COOT_W = 12;
export const COOT_H = 9;
export const COOT: Palette = { H: '#1E1E1E', E: '#A83A2A', W: '#F4F4F4', S: '#3A3A40', D: '#2A2A30', F: '#8AA84A' };

/* ── The partridge in a pear tree (Christmas + 12 days): o face · E eye · K beak · g body · b bars · f feet · L leaves · Y pears · T trunk ── */

export const PARTRIDGE_TREE: Grid = [
  '......oo........',
  '.....oEoK.......',
  '...ggggo........',
  '..gggggg........',
  '...gbgbg........',
  '....LLfLLLLL....',
  '..LLLLYLLLLLLL..',
  '.LLLLLLLLYLLLLL.',
  'LLLYLLLLLLLLLLLL',
  'LLLLLLLLLLLYLLLL',
  '.LLLLLYLLLLLLLL.',
  '..LLLLLLLLLLLL..',
  '....LLLLLLLL....',
  '......TTT.......',
  '......TTT.......',
  '.....TTTTT......',
];
export const PARTRIDGE_W = 16;
export const PARTRIDGE_H = 16;
export const PARTRIDGE_PALETTE: Palette = {
  o: '#E07A3A', E: '#111111', K: '#555555', g: '#8A8A80', b: '#8A3A24', f: '#C08060', L: '#3E7A2E', Y: '#E8D24A', T: '#5A3A1E',
};

/* ── Retriever, facing right: Y coat · L ear · E eye · N nose ── */

export const DOG: Grid = [
  '.........YYY....',
  '........YYYYY...',
  '........YEYYYNN.',
  '........YYYYYYY.',
  '.......LYYYYYY..',
  '......LLYYYY....',
  '.....YYYYYY.....',
  '....YYYYYYYY....',
  '...YYYYYYYYYY...',
  '..YYYYYYYYYYY...',
  '.YYYYYYYYYYYY...',
  '.YYY.YYY.YYY....',
  '.YY..YY..YY.....',
];

export const DOG_W = 16;
export const DOG_H = 13;
export const DOG_PALETTE: Palette = { Y: '#D9A441', L: '#B8832A', E: '#1A1A1A', N: '#1A1A1A' };

/* ── Gun ── */

/** Shotgun pointing straight up; pivot is the bottom-centre. 5 × 22. */
export const GUN: Grid = [
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

/** A shotgun shell for the ammo counter. 3 × 6. */
export const SHELL: Grid = ['RRR', 'RRR', 'RRR', 'RRR', 'BBB', 'BBB'];
export const SHELL_PALETTE: Palette = { R: '#C8342A', B: '#D4A017' };

/** 3 × 5 digits, '+' and '-' for score popups. */
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
  '-': ['...', '...', '###', '...', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};

export type PixelRect = { x: number; y: number; color: string };

/** Grid → list of opaque pixels with their colors. */
export function spritePixels(rows: Grid, palette: Palette): PixelRect[] {
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
