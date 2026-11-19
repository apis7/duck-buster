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

/** Season window as timestamps, for placing badge celebrations in a season. */
export function seasonWindow(season: number): { start: number; end: number } {
  return { start: new Date(season, 6, 1).getTime(), end: new Date(season + 1, 6, 1).getTime() };
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
