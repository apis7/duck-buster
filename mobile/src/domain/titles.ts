import type { HunterStats } from './stats';

/**
 * A hunter's title climbs with lifetime XP. Showing up counts (a skunked hunt
 * still earns a point), so a beginner who hunts every weekend climbs too.
 */

export const TITLES: { xp: number; name: string }[] = [
  { xp: 0, name: 'Decoy' },
  { xp: 10, name: 'Mud Wader' },
  { xp: 30, name: 'Blind Rat' },
  { xp: 70, name: 'Swamp Rat' },
  { xp: 130, name: 'Flock Shot' },
  { xp: 220, name: 'Greenhead Slayer' },
  { xp: 350, name: 'Marsh Boss' },
  { xp: 550, name: 'Flyway Legend' },
  { xp: 800, name: 'Duck Buster' },
];

export function xpFor(stats: HunterStats, badgeCount: number): number {
  return stats.hunts + stats.birds + stats.species.size * 3 + stats.banded * 10 + badgeCount * 5;
}

export type TitleProgress = {
  name: string;
  level: number;
  xp: number;
  next: { name: string; xp: number } | null;
  /** 0..1 progress from this title to the next. */
  progress: number;
};

export function titleFor(xp: number): TitleProgress {
  let level = 0;
  for (let i = 0; i < TITLES.length; i++) if (xp >= TITLES[i].xp) level = i;
  const cur = TITLES[level];
  const next = TITLES[level + 1] ?? null;
  return {
    name: cur.name,
    level: level + 1,
    xp,
    next,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  };
}
