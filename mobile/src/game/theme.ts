/**
 * The marsh changes with South Dakota's seasons: green in spring and summer,
 * yellowing in early fall, brown and orange in the fall, snow in winter, and
 * Christmas trees from Christmas through the twelve days after it. During those
 * twelve days a partridge in a pear tree may fly by.
 */

export type ThemeId = 'summer' | 'early-fall' | 'fall' | 'winter' | 'christmas' | 'halloween' | 'stpatrick' | 'night';

export type Theme = {
  id: ThemeId;
  /** Six sky bands, top to bottom. */
  sky: string[];
  sun: string;
  water: string;
  ripple: string;
  /** Back reeds, front reeds, cattail heads, mud. */
  reeds: string[];
  frontReed: string;
  cattail: string;
  mud: string;
  snow: boolean;
  trees: boolean;
  partridge: boolean;
  pumpkins?: boolean;
  rainbow?: boolean;
  /** A big pale moon instead of the sun. */
  moon?: boolean;
  fireworks?: boolean;
};

const BASE = {
  sky: ['#2B3F73', '#3E5A94', '#5F7DB3', '#8EA3C8', '#D9A98A', '#F0C38E'],
  sun: '#FFE29A',
  water: '#30507E',
  ripple: '#4A6E9E',
  cattail: '#5A3A1E',
  mud: '#1A2A18',
};

export const THEMES = {
  summer: { ...BASE, id: 'summer', reeds: ['#22381F', '#2E4A26'], frontReed: '#2C4A27', snow: false, trees: false, partridge: false },
  'early-fall': {
    ...BASE, id: 'early-fall', reeds: ['#3A4A1F', '#6B6A24', '#8A7A2A'], frontReed: '#4A5A22', snow: false, trees: false, partridge: false,
  },
  fall: {
    ...BASE,
    id: 'fall',
    sky: ['#2E3A66', '#4A5A8C', '#7A7FA8', '#C99A78', '#E0A060', '#F2B866'],
    sun: '#FFC870',
    reeds: ['#5A3A1E', '#8A5A24', '#B8862E', '#C8A040', '#6E4A20'],
    frontReed: '#6A4220',
    mud: '#2A1E12',
    snow: false,
    trees: false,
    partridge: false,
  },
  winter: {
    ...BASE,
    id: 'winter',
    sky: ['#3A4A66', '#55667F', '#73839A', '#95A2B4', '#B7C1CC', '#D6DCE2'],
    sun: '#F2F4F7',
    water: '#A9C2D6',
    ripple: '#D8E6EF',
    reeds: ['#6A5A40', '#7E6C50', '#8E7A58'],
    frontReed: '#5E5040',
    cattail: '#4A3A2A',
    mud: '#E8EEF2',
    snow: true,
    trees: false,
    partridge: false,
  },
  christmas: {
    ...BASE,
    id: 'christmas',
    sky: ['#1E2A4A', '#2E3E62', '#4A5A7E', '#6E7E9A', '#9AA6B8', '#C6CED8'],
    sun: '#FFF4D6',
    water: '#A9C2D6',
    ripple: '#D8E6EF',
    reeds: ['#6A5A40', '#7E6C50', '#8E7A58'],
    frontReed: '#5E5040',
    cattail: '#4A3A2A',
    mud: '#E8EEF2',
    snow: true,
    trees: true,
    partridge: true,
  },
} as Record<ThemeId, Theme>;

// Holiday and night looks, switched on by events.ts.
Object.assign(THEMES, {
  halloween: {
    ...THEMES.fall,
    id: 'halloween',
    sky: ['#140A22', '#26123A', '#3E1E52', '#5E2A62', '#9A4A5E', '#D8743E'],
    sun: '#FF8A2A',
    water: '#2A1E3E',
    ripple: '#4A3A62',
    reeds: ['#2A1A12', '#3A2416', '#4A2E1A'],
    frontReed: '#24160E',
    mud: '#140A0E',
    pumpkins: true,
  },
  stpatrick: {
    ...THEMES.summer,
    id: 'stpatrick',
    sky: ['#2B5F8A', '#3E7AA8', '#5F96C0', '#8EB8D6', '#BFDDB0', '#E8F2C0'],
    sun: '#FFD84A',
    reeds: ['#1E6A32', '#2E8A3E', '#3EA048'],
    frontReed: '#1E7A36',
    rainbow: true,
  },
  night: {
    ...THEMES.summer,
    id: 'night',
    sky: ['#05070F', '#0A0F1E', '#10182E', '#18223E', '#22304E', '#2E3E5E'],
    sun: '#F4F2E0',
    water: '#0E1A30',
    ripple: '#3A4E78',
    reeds: ['#0A120C', '#0E1810'],
    frontReed: '#0C140E',
    mud: '#06080A',
    moon: true,
  },
} satisfies Partial<Record<ThemeId, Theme>>);

/** Which marsh to show on a date (YYYY-MM-DD). */
export function themeFor(date: string): Theme {
  const [, m, d] = date.split('-').map(Number);
  // Christmas through the twelve days after it: Dec 25 – Jan 6.
  if ((m === 12 && d >= 25) || (m === 1 && d <= 6)) return THEMES.christmas;
  if (m === 12 || m === 1 || m === 2) return THEMES.winter;
  if (m === 9 || (m === 10 && d < 15)) return THEMES['early-fall'];
  if (m === 10 || m === 11) return THEMES.fall;
  return THEMES.summer;
}
