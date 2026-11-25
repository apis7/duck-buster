import { FEAST_NAMES, feastsOn } from '@/domain/calendar';
import { isThanksgiving } from '@/domain/season';

import { themeFor, THEMES, type Theme } from './theme';

/**
 * What's special about today's marsh. The season sets the look (theme.ts); on top
 * of it, dates turn on events:
 *
 *  - Opening Day (SD duck opener, last Sat of Sept + Sun): bigger flocks, blaze-orange confetti.
 *  - Pheasant Opener (3rd Sat of Oct + Sun): roosters flush from the reeds (+4);
 *    hens are illegal in SD (−3).
 *  - Halloween (Oct 25–31): purple dusk, jack-o'-lanterns, ghost ducks you can only
 *    hit while they're showing.
 *  - Thanksgiving week: a turkey wanders the bank. Shoot it: toot, −2.
 *  - Christmas + the twelve days (Dec 25 – Jan 6): trees and the partridge in a pear tree.
 *  - New Year's Eve / Day: fireworks, and the last 3 seconds count double.
 *  - Spring Snow Goose Conservation Order (Feb 15 – Apr 30): huge snow goose flocks.
 *  - Blizzard (random winter days): whiteout gusts, and wind drifts your shots.
 *  - St. Patrick's Day: a rainbow, and one emerald lucky duck worth 7.
 *  - Fourth of July (Jul 3–5): fireworks, and a bald eagle is far likelier. A rare
 *    eagle can fly over any round (engine.ts); shoot it and the game warden ends it.
 *  - Full moon: a moonlit night marsh with fewer, bigger, slower flocks.
 *
 * Feast days (domain/calendar.ts):
 *  - St. Hubert (Nov 3): a white stag with a cross walks the bank. Let it pass:
 *    ×3 for the rest of the round. Shoot it: PENANCE, score halved.
 *  - Martinmas (Nov 11) and Michaelmas (Sep 29): geese are worth 3× and show up
 *    a quarter more often.
 *  - Fridays in Lent: no meat — every bird scores −1.
 *  - Candlemas (Feb 2): candles on the bank; each miss blows one out; lit
 *    candles at the end are +2 each.
 *  - St. Isidore (May 15): an angel ploughs across the back; birds dropped while
 *    it's on screen are +1.
 *  - St. John's Eve, Epiphany, Rogation Days: just to look at — bonfires; the
 *    star and the three kings; rain that clears as a procession passes.
 */

export type GameFx = {
  opener: boolean;
  pheasants: boolean;
  ghosts: boolean;
  turkey: boolean;
  partridge: boolean;
  midnight: boolean;
  snowOrder: boolean;
  /** Blizzard wind, points per second (±); 0 = calm. */
  wind: number;
  eagle: boolean;
  night: boolean;
  lucky: boolean;
  hubert: boolean;
  /** Martinmas / Michaelmas. */
  geeseFeast: boolean;
  lent: boolean;
  candles: boolean;
  isidore: boolean;
  bonfires: boolean;
  epiphany: boolean;
  rogation: boolean;
};

export const NO_FX: GameFx = {
  opener: false, pheasants: false, ghosts: false, turkey: false, partridge: false, midnight: false,
  snowOrder: false, wind: 0, eagle: false, night: false, lucky: false,
  hubert: false, geeseFeast: false, lent: false, candles: false, isidore: false, bonfires: false, epiphany: false, rogation: false,
};

/** `names`: today's feast days and holidays, for the end-of-round summary. */
export type GameDay = { theme: Theme; fx: GameFx; banners: string[]; names: string[] };

const pad = (n: number) => String(n).padStart(2, '0');

/** The Nth weekday (0 = Sun … 6 = Sat) of a month, as a day number. */
function nthWeekday(y: number, month: number, weekday: number, n: number): number {
  const first = new Date(y, month - 1, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

function lastWeekday(y: number, month: number, weekday: number): number {
  const days = new Date(y, month, 0).getDate();
  const last = new Date(y, month - 1, days).getDay();
  return days - ((last - weekday + 7) % 7);
}

/** Days since the last new moon (0 … 29.5). Reference new moon: 2000-01-06 18:14 UTC. */
export function moonAge(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const synodic = 29.530588853;
  const days = (Date.UTC(y, m - 1, d, 12) - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000;
  return ((days % synodic) + synodic) % synodic;
}

export const isFullMoon = (date: string) => Math.abs(moonAge(date) - 14.765) < 1.0;

const isFourth = (m: number, d: number) => m === 7 && d >= 3 && d <= 5;

/** Practice: just the season's look — no holidays, feasts, weather or bonuses — except the Fourth's eagle. */
export function practiceDay(date: string): GameDay {
  const [, m, d] = date.split('-').map(Number);
  const base = themeFor(date);
  const theme = base.id === 'christmas' ? THEMES.winter : base;
  if (isFourth(m, d)) {
    return { theme: { ...theme, fireworks: true }, fx: { ...NO_FX, eagle: true }, banners: ['HAPPY FOURTH!\nDON’T SHOOT THE EAGLE'], names: [] };
  }
  return { theme, fx: NO_FX, banners: [], names: [] };
}

export function gameDay(date: string, rng: () => number = Math.random): GameDay {
  const [y, m, d] = date.split('-').map(Number);
  const base = themeFor(date);
  const fx: GameFx = { ...NO_FX, partridge: base.partridge };
  const banners: string[] = [];
  let theme: Theme = base;

  const opener = lastWeekday(y, 9, 6);
  if (m === 9 && (d === opener || d === opener + 1)) {
    fx.opener = true;
    banners.push('OPENING DAY!');
  }
  const pheasant = nthWeekday(y, 10, 6, 3);
  if (m === 10 && (d === pheasant || d === pheasant + 1)) {
    fx.pheasants = true;
    banners.push('PHEASANT OPENER!\nROOSTERS ONLY');
  }
  if (m === 10 && d >= 25) {
    fx.ghosts = true;
    theme = THEMES.halloween;
    banners.push('HAPPY HALLOWEEN');
  }
  // Thanksgiving week: the Monday before through the Sunday after.
  for (let off = -3; off <= 3; off++) {
    const dt = new Date(y, m - 1, d + off);
    if (isThanksgiving(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`)) fx.turkey = true;
  }
  if ((m === 12 && d === 31) || (m === 1 && d === 1)) {
    fx.midnight = true;
    theme = { ...theme, fireworks: true };
    banners.push('HAPPY NEW YEAR!\nLAST 3 SECONDS ×2');
  }
  if ((m === 2 && d >= 15) || m === 3 || m === 4) {
    fx.snowOrder = true;
    banners.push('SPRING SNOW GOOSE ORDER\nNO LIMIT!');
  }
  if (m === 3 && d === 17) {
    fx.lucky = true;
    theme = THEMES.stpatrick;
    banners.push("ST. PATRICK'S DAY\nFIND THE LUCKY DUCK");
  }
  if (isFourth(m, d)) {
    fx.eagle = true;
    theme = { ...theme, fireworks: true };
    banners.push('HAPPY FOURTH!\nDON’T SHOOT THE EAGLE');
  }
  if (base.snow && rng() < 0.25) {
    fx.wind = (rng() < 0.5 ? -1 : 1) * (50 + rng() * 50);
    banners.push('BLIZZARD!\nWIND DRIFTS YOUR SHOTS');
  }
  const feasts = feastsOn(date);
  if (feasts.includes('hubert')) {
    fx.hubert = true;
    banners.push('FEAST OF ST. HUBERT\nLET THE STAG PASS');
  }
  if (feasts.includes('martinmas') || feasts.includes('michaelmas')) {
    fx.geeseFeast = true;
    banners.push(feasts.includes('martinmas') ? 'MARTINMAS!\nGEESE ×3' : 'MICHAELMAS!\nGEESE ×3');
  }
  if (feasts.includes('lent')) {
    fx.lent = true;
    banners.push('NO MEAT ON\nLENTEN FRIDAYS!');
  }
  if (feasts.includes('candlemas')) {
    fx.candles = true;
    banners.push('CANDLEMAS\nEACH MISS BLOWS OUT A CANDLE');
  }
  if (feasts.includes('isidore')) {
    fx.isidore = true;
    banners.push('ST. ISIDORE THE FARMER\n+1 WHILE THE ANGEL PLOUGHS');
  }
  if (feasts.includes('stjohn')) fx.bonfires = true;
  if (feasts.includes('epiphany')) fx.epiphany = true;
  if (feasts.includes('rogation')) fx.rogation = true;

  if (isFullMoon(date)) {
    fx.night = true;
    theme = { ...THEMES.night, snow: theme.snow, trees: theme.trees, fireworks: theme.fireworks, pumpkins: theme.pumpkins };
    banners.push('FULL MOON');
  }
  const names = feasts.map((f) => FEAST_NAMES[f]);
  if (fx.opener) names.push('Duck Opener');
  if (fx.pheasants) names.push('Pheasant Opener');
  if (fx.turkey && !feasts.includes('thanksgiving')) names.push('Thanksgiving week');
  if (fx.snowOrder) names.push('Spring Snow Goose Order');
  if (fx.night) names.push('Full moon');
  return { theme, fx, banners, names };
}
