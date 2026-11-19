import { currentSeason, daysBetween, seasonOf, todayISO } from './season';
import type { Data } from './types';

/**
 * Seasons run July 1 → June 30. On July 1 the old season is archived: its hunts
 * are locked, and its final board, awards, badges and duck-shoot scores stay
 * viewable under Past seasons. Nothing is ever deleted.
 */

export function isArchivedSeason(season: number, now = new Date()): boolean {
  return season < currentSeason(now);
}

/** Hunts in an archived season are read-only. */
export function isLockedDate(date: string, now = new Date()): boolean {
  return isArchivedSeason(seasonOf(date), now);
}

/** Past seasons that have at least one hunt, newest first. */
export function archivedSeasons(data: Data, now = new Date()): number[] {
  const cur = currentSeason(now);
  return Array.from(new Set(data.hunts.map((h) => seasonOf(h.date)).filter((s) => s < cur))).sort((a, b) => b - a);
}

/** The archive announcement to show, if a season closed since the user last saw one. */
export function newlyArchived(data: Data, lastSeen: number | null, now = new Date()): number | null {
  const latest = archivedSeasons(data, now)[0];
  return latest != null && (lastSeen == null || latest > lastSeen) ? latest : null;
}

/**
 * Awards Night is for when the shooting's done: it opens Feb 1, after duck seasons
 * close, and is always open for archived seasons. A crew whose season ends early
 * can open it sooner (the board asks first).
 */
export function awardsOpen(season: number, now = new Date()): boolean {
  return season < currentSeason(now) || now >= new Date(season + 1, 1, 1);
}

/** Season window as timestamps, for placing badge celebrations in a season. */
export function seasonWindow(season: number): { start: number; end: number } {
  return { start: new Date(season, 6, 1).getTime(), end: new Date(season + 1, 6, 1).getTime() };
}

export type Celebration = { hunterId: string; badgeId: string; at: number };

/** Badges each hunter earned during a season, from when each was first celebrated. */
export function seasonBadges(celebrated: Celebration[], season: number): Map<string, string[]> {
  const { start, end } = seasonWindow(season);
  const out = new Map<string, string[]>();
  for (const c of celebrated) {
    if (c.at < start || c.at >= end) continue;
    out.set(c.hunterId, [...(out.get(c.hunterId) ?? []), c.badgeId]);
  }
  return out;
}

/**
 * Nudge to save a backup once the winter's hunting is done: the season has hunts,
 * it's between January and June, the last hunt was at least five days ago, and
 * nothing has been backed up since that hunt was logged.
 */
export function shouldRemindBackup(data: Data, lastBackupAt: number | null, now = new Date()): boolean {
  const today = todayISO(now);
  const season = currentSeason(now);
  const month = now.getMonth() + 1;
  if (month > 6) return false;
  const hunts = data.hunts.filter((h) => seasonOf(h.date) === season);
  if (!hunts.length) return false;
  const last = hunts.reduce((a, b) => (b.date > a.date ? b : a));
  if (daysBetween(last.date, today) < 5) return false;
  const lastLogged = Math.max(...hunts.map((h) => h.createdAt));
  return lastBackupAt == null || lastBackupAt < lastLogged;
}
