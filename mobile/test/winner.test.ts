import { describe, expect, it } from 'vitest';

import { archivedSeasons, isLockedDate, newlyArchived, shouldRemindBackup } from '@/domain/archive';
import { seasonAwards } from '@/domain/awards';
import { earnedBadges } from '@/domain/badges';
import { gameLeaders } from '@/domain/gameStats';
import { huntWinner, rowPoints } from '@/domain/winner';

import { makeData } from './fixtures';

const game = (hunterId: string, huntId: string, date: string, score: number, extra: Partial<{ coots: number; geese: number; bands: number }> = {}) => ({
  id: `g-${huntId}`, huntId, hunterId, date, score, shots: 10, hits: 5, kos: 2, geese: 0, swans: 0, coots: 0, bands: 0, createdAt: 1, ...extra,
});

describe('hunt winner', () => {
  it('points: drake 3, hen 2, wood duck bonus, coot 0', () => {
    expect(rowPoints({ id: '', huntId: '', hunterId: '', speciesId: 'mall', sex: 'D', count: 2, banded: 0 })).toBe(6);
    expect(rowPoints({ id: '', huntId: '', hunterId: '', speciesId: 'mall', sex: 'H', count: 1, banded: 0 })).toBe(2);
    expect(rowPoints({ id: '', huntId: '', hunterId: '', speciesId: 'wodu', sex: 'D', count: 1, banded: 0 })).toBe(5);
    expect(rowPoints({ id: '', huntId: '', hunterId: '', speciesId: 'amco', sex: 'U', count: 4, banded: 0 })).toBe(0);
  });

  it('most points wins', () => {
    const d = makeData();
    const h = d.hunt('2026-10-01', ['dad', 'kid']);
    d.bird(h, 'dad', 'mall', 2, 'H');
    d.bird(h, 'kid', 'wodu', 1, 'D');
    expect(huntWinner(d, h)?.hunterId).toBe('kid');
  });

  it('a band wins outright, even with fewer points', () => {
    const d = makeData();
    const h = d.hunt('2026-10-01', ['dad', 'kid']);
    d.bird(h, 'dad', 'mall', 5, 'D');
    d.bird(h, 'kid', 'gwte', 1, 'H', 1);
    expect(huntWinner(d, h)?.hunterId).toBe('kid');
  });

  it('nobody wins a skunk', () => {
    const d = makeData();
    const h = d.hunt('2026-10-01', ['dad', 'kid']);
    expect(huntWinner(d, h)).toBeNull();
  });
});

describe('duck shoot stats', () => {
  const d = makeData();
  const a = d.hunt('2026-10-01', ['dad', 'kid']);
  const b = d.hunt('2026-10-02', ['dad', 'kid']);
  const c = d.hunt('2026-10-03', ['dad', 'kid']);
  d.gameScores.push(game('dad', a, '2026-10-01', 42), game('kid', b, '2026-10-02', 35, { coots: 3 }), game('dad', c, '2026-10-03', 20));

  it('board leaders', () => {
    const leaders = gameLeaders(d, { season: 2026 });
    expect(leaders.find((l) => l.label === 'High score')).toMatchObject({ hunterId: 'dad', value: 42 });
    expect(leaders.find((l) => l.label === 'Highest overall')).toMatchObject({ hunterId: 'dad', value: 62 });
    expect(leaders.find((l) => l.roast)?.hunterId).toBe('kid');
  });

  it('badges and the Arcade Champion award', () => {
    expect(earnedBadges(d, 'dad')).toEqual(expect.arrayContaining(['winner_winner', 'arcade_ace']));
    expect(earnedBadges(d, 'kid')).toContain('coot_clown');
    const champ = seasonAwards(d, 2026).find((r) => r.award.id === 'arcade_champ');
    expect(champ?.winners).toEqual(['dad']);
  });
});

describe('archive', () => {
  const d = makeData();
  d.hunt('2025-11-01', ['dad']);
  d.hunt('2026-01-15', ['dad']);
  d.hunt('2026-10-01', ['dad']);
  const july = new Date(2026, 6, 2);

  it('past seasons are archived and locked on July 1', () => {
    expect(archivedSeasons(d, july)).toEqual([2025]);
    expect(isLockedDate('2026-01-15', july)).toBe(true);
    expect(isLockedDate('2026-10-01', july)).toBe(false);
    expect(isLockedDate('2026-01-15', new Date(2026, 5, 30))).toBe(false);
    expect(newlyArchived(d, null, july)).toBe(2025);
    expect(newlyArchived(d, 2025, july)).toBeNull();
  });

  it('reminds to back up once the winter hunting is done', () => {
    const e = makeData();
    const h = e.hunt('2027-01-20', ['dad']);
    e.hunts.find((x) => x.id === h)!.createdAt = new Date(2027, 0, 20).getTime();
    expect(shouldRemindBackup(e, null, new Date(2027, 0, 22))).toBe(false);
    expect(shouldRemindBackup(e, null, new Date(2027, 0, 27))).toBe(true);
    expect(shouldRemindBackup(e, new Date(2027, 0, 26).getTime(), new Date(2027, 0, 27))).toBe(false);
    expect(shouldRemindBackup(e, null, new Date(2026, 10, 27))).toBe(false);
  });
});
