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
 *  - Fourth of July (Jul 3–5): fireworks, and a bald eagle. Shoot it and the game
 *    warden ends your round.
 *  - Full moon: a moonlit night marsh with fewer, bigger, slower flocks.
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
};

export const NO_FX: GameFx = {
  opener: false, pheasants: false, ghosts: false, turkey: false, partridge: false, midnight: false,
  snowOrder: false, wind: 0, eagle: false, night: false, lucky: false,
};

export type GameDay = { theme: Theme; fx: GameFx; banners: string[] };

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
  if (m === 7 && d >= 3 && d <= 5) {
    fx.eagle = true;
    theme = { ...theme, fireworks: true };
    banners.push('HAPPY FOURTH!\nDON’T SHOOT THE EAGLE');
  }
  if (base.snow && rng() < 0.25) {
    fx.wind = (rng() < 0.5 ? -1 : 1) * (50 + rng() * 50);
    banners.push('BLIZZARD!\nWIND DRIFTS YOUR SHOTS');
  }
  if (isFullMoon(date)) {
    fx.night = true;
    theme = { ...THEMES.night, snow: theme.snow, trees: theme.trees, fireworks: theme.fireworks, pumpkins: theme.pumpkins };
    banners.push('FULL MOON');
  }
  return { theme, fx, banners };
}
