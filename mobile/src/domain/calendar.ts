import { isThanksgiving } from './season';

/**
 * The calendar the app decorates itself with: civil holidays and the (older,
 * more obscure) Catholic feasts the game celebrates. Dates are YYYY-MM-DD.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (date: string, n: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Lent runs Ash Wednesday (Easter − 46) through Holy Saturday. */
export function isLentenFriday(date: string): boolean {
  const y = Number(date.slice(0, 4));
  const e = easter(y);
  return parse(date).getDay() === 5 && date >= addDays(e, -46) && date < e;
}

/** Major Rogation (Apr 25) and the Minor Rogation days, Mon–Wed before Ascension. */
export function isRogationDay(date: string): boolean {
  if (date.slice(5) === '04-25') return true;
  const e = easter(Number(date.slice(0, 4)));
  return [36, 37, 38].some((n) => addDays(e, n) === date);
}

export type Feast =
  | 'hubert' | 'martinmas' | 'michaelmas' | 'lent' | 'candlemas' | 'isidore' | 'stjohn' | 'epiphany' | 'rogation'
  | 'easter' | 'christmas' | 'stpatrick' | 'halloween' | 'thanksgiving' | 'newyear' | 'july4';

export const FEAST_NAMES: Record<Feast, string> = {
  hubert: 'Feast of St. Hubert, patron of hunters',
  martinmas: 'Martinmas (St. Martin of Tours)',
  michaelmas: 'Michaelmas (St. Michael the Archangel)',
  lent: 'A Friday in Lent',
  candlemas: 'Candlemas',
  isidore: 'Feast of St. Isidore the Farmer',
  stjohn: "St. John's Eve",
  epiphany: 'The Epiphany',
  rogation: 'A Rogation Day',
  easter: 'Easter',
  christmas: 'Christmas',
  stpatrick: "St. Patrick's Day",
  halloween: 'Halloween',
  thanksgiving: 'Thanksgiving',
  newyear: "New Year's",
  july4: 'Independence Day',
};

/** Feasts and holidays falling on this exact date. */
export function feastsOn(date: string): Feast[] {
  const md = date.slice(5);
  const out: Feast[] = [];
  if (md === '11-03') out.push('hubert');
  if (md === '11-11') out.push('martinmas');
  if (md === '09-29') out.push('michaelmas');
  if (isLentenFriday(date)) out.push('lent');
  if (md === '02-02') out.push('candlemas');
  if (md === '05-15') out.push('isidore');
  if (md === '06-23') out.push('stjohn');
  if (md === '01-06') out.push('epiphany');
  if (isRogationDay(date)) out.push('rogation');
  if (date === easter(Number(date.slice(0, 4)))) out.push('easter');
  if (md === '12-25') out.push('christmas');
  if (md === '03-17') out.push('stpatrick');
  if (md === '10-31') out.push('halloween');
  if (isThanksgiving(date)) out.push('thanksgiving');
  if (md === '12-31' || md === '01-01') out.push('newyear');
  if (md === '07-04') out.push('july4');
  return out;
}

/**
 * A little seasonal ornament for the app's headers, on or around a holiday.
 * `crucifix` is drawn as a tiny pixel crucifix (there's no emoji for one).
 */
export type Ornament = { left: string; right: string; crucifix?: boolean };

export function ornamentFor(date: string): Ornament | null {
  const md = date.slice(5);
  const y = Number(date.slice(0, 4));
  const e = easter(y);
  if ((md >= '12-20' && md <= '12-30') || (md >= '01-02' && md <= '01-06')) return { left: '🎁', right: '🎄' };
  if (md === '12-31' || md === '01-01') return { left: '🎉', right: '🎄' };
  // Holy Week through the Octave of Easter.
  if (date >= addDays(e, -7) && date <= addDays(e, 7)) return { left: '', right: '', crucifix: true };
  if (md >= '03-14' && md <= '03-17') return { left: '☘️', right: '☘️' };
  if (md >= '10-25' && md <= '10-31') return { left: '🎃', right: '🦇' };
  for (let off = -3; off <= 3; off++) if (isThanksgiving(addDays(date, off))) return { left: '🦃', right: '🍂' };
  if (md >= '07-01' && md <= '07-04') return { left: '🇺🇸', right: '🎆' };
  if (md === '11-03') return { left: '🦌', right: '✝' };
  if (md === '11-11' || md === '09-29') return { left: '🪿', right: '' };
  return null;
}
