import { describe, expect, it } from 'vitest';

import { archivedSeasons, awardsOpen, hasPastSeasons, isLockedDate, newlyArchived, shouldRemindBackup } from '../src/domain/archive';
import { makeData } from './fixtures';

const at = (iso: string) => new Date(`${iso}T09:00:00`);

describe('season rollover (July 1)', () => {
  it('locks last season on July 1, not June 30', () => {
    expect(isLockedDate('2026-11-14', at('2027-06-30'))).toBe(false);
    expect(isLockedDate('2026-11-14', at('2027-07-01'))).toBe(true);
    expect(isLockedDate('2027-07-01', at('2027-07-01'))).toBe(false);
  });

  it('announces a newly archived season once, then stays quiet', () => {
    const d = makeData();
    d.hunt('2026-11-14', ['dad']);
    expect(newlyArchived(d, null, at('2027-06-30'))).toBeNull();
    expect(newlyArchived(d, null, at('2027-07-01'))).toBe(2026);
    expect(newlyArchived(d, 2026, at('2027-07-02'))).toBeNull();
  });

  it('hides all-time views until a past season has hunts', () => {
    const d = makeData();
    expect(hasPastSeasons(d, at('2027-07-01'))).toBe(false);
    d.hunt('2026-12-01', ['dad']);
    expect(hasPastSeasons(d, at('2027-01-10'))).toBe(false);
    expect(hasPastSeasons(d, at('2027-07-01'))).toBe(true);
    d.hunt('2025-10-01', ['dad']);
    expect(archivedSeasons(d, at('2027-07-01'))).toEqual([2026, 2025]);
  });

  it('opens Awards Night on Feb 1, and always for archived seasons', () => {
    expect(awardsOpen(2026, at('2027-01-31'))).toBe(false);
    expect(awardsOpen(2026, at('2027-02-01'))).toBe(true);
    expect(awardsOpen(2025, at('2026-11-01'))).toBe(true);
  });
});

describe('backup reminder', () => {
  const season = () => {
    const d = makeData();
    d.hunt('2027-01-10', ['dad']);
    return d;
  };
  it('waits for Jan–Jun and 5 quiet days after the last hunt', () => {
    expect(shouldRemindBackup(season(), null, at('2027-01-14'))).toBe(false);
    expect(shouldRemindBackup(season(), null, at('2027-01-15'))).toBe(true);
    expect(shouldRemindBackup(season(), null, at('2027-07-15'))).toBe(false);
  });
  it('goes quiet after a backup newer than the last logged hunt', () => {
    const d = season();
    const logged = Math.max(...d.hunts.map((h) => h.createdAt));
    expect(shouldRemindBackup(d, logged + 1, at('2027-02-01'))).toBe(false);
    expect(shouldRemindBackup(d, logged - 1, at('2027-02-01'))).toBe(true);
  });
});
