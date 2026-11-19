/**
 * The marsh changes with South Dakota's seasons: green in spring and summer,
 * yellowing in early fall, brown and orange in the fall, snow in winter, and
 * Christmas trees from Christmas through the twelve days after it. During those
 * twelve days a partridge in a pear tree may fly by.
 */

export type ThemeId = 'summer' | 'early-fall' | 'fall' | 'winter' | 'christmas';

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
};

const BASE = {
  sky: ['#2B3F73', '#3E5A94', '#5F7DB3', '#8EA3C8', '#D9A98A', '#F0C38E'],
  sun: '#FFE29A',
  water: '#30507E',
  ripple: '#4A6E9E',
  cattail: '#5A3A1E',
  mud: '#1A2A18',
};

export const THEMES: Record<ThemeId, Theme> = {
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
};

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
