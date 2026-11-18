/**
 * A duck season straddles New Year, so it is named by the year it opens.
 * July 1 is the turnover: September teal through the January/February goose
 * seasons all land in one season.
 */

export function seasonOf(date: string): number {
  const [y, m] = date.split('-').map(Number);
  return m >= 7 ? y : y - 1;
}

export function seasonLabel(season: number): string {
  return `${season}–${String((season + 1) % 100).padStart(2, '0')}`;
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentSeason(now = new Date()): number {
  return seasonOf(todayISO(now));
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function prettyDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Fourth Thursday of November. */
export function isThanksgiving(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  if (m !== 11) return false;
  const firstDow = new Date(y, 10, 1).getDay();
  const firstThu = 1 + ((4 - firstDow + 7) % 7);
  return d === firstThu + 21;
}
