import { describe, expect, it } from 'vitest';

import { easter, feastsOn, isLentenFriday, isRogationDay, ornamentFor } from '@/domain/calendar';

describe('church calendar', () => {
  it.each([
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
  ])('Easter %i is %s', (y, d) => expect(easter(y)).toBe(d));

  it('Lenten Fridays run Ash Wednesday → Holy Saturday', () => {
    expect(isLentenFriday('2026-02-20')).toBe(true); // first Friday of Lent 2026 (Ash Wed Feb 18)
    expect(isLentenFriday('2026-04-03')).toBe(true); // Good Friday
    expect(isLentenFriday('2026-02-13')).toBe(false); // before Ash Wednesday
    expect(isLentenFriday('2026-04-10')).toBe(false); // after Easter
    expect(isLentenFriday('2026-02-19')).toBe(false); // a Thursday
  });

  it('Rogation days', () => {
    expect(isRogationDay('2026-04-25')).toBe(true);
    expect(isRogationDay('2026-05-11')).toBe(true); // Easter Apr 5 + 36
    expect(isRogationDay('2026-05-14')).toBe(false); // Ascension itself
  });

  it('feasts on a date', () => {
    expect(feastsOn('2026-11-03')).toContain('hubert');
    expect(feastsOn('2026-11-11')).toContain('martinmas');
    expect(feastsOn('2026-09-29')).toContain('michaelmas');
    expect(feastsOn('2027-02-02')).toContain('candlemas');
    expect(feastsOn('2027-01-06')).toContain('epiphany');
    expect(feastsOn('2026-08-12')).toEqual([]);
  });

  it('ornaments around the holidays, nothing on an ordinary day', () => {
    expect(ornamentFor('2026-12-23')?.left).toBe('🎁');
    expect(ornamentFor('2026-04-04')?.crucifix).toBe(true);
    expect(ornamentFor('2027-03-16')?.left).toBe('☘️');
    expect(ornamentFor('2026-08-12')).toBeNull();
  });
});
