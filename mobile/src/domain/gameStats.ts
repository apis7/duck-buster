import { inScope, type Scope } from './stats';
import type { Data, GameScore } from './types';

/** The duck-shoot side of the Bragging Board: rounds won by winning hunts. */

export type GameStats = {
  games: number;
  best: number;
  total: number;
  coots: number;
  bands: number;
  geese: number;
  swans: number;
  kos: number;
};

export function gamesFor(data: Data, hunterId: string, scope: Scope = {}): GameScore[] {
  return data.gameScores.filter((g) => g.hunterId === hunterId && inScope(g.date, scope));
}

export function gameStats(games: GameScore[]): GameStats {
  return {
    games: games.length,
    best: games.reduce((m, g) => Math.max(m, g.score), 0),
    total: games.reduce((n, g) => n + g.score, 0),
    coots: games.reduce((n, g) => n + g.coots, 0),
    bands: games.reduce((n, g) => n + g.bands, 0),
    geese: games.reduce((n, g) => n + g.geese, 0),
    swans: games.reduce((n, g) => n + g.swans, 0),
    kos: games.reduce((n, g) => n + g.kos, 0),
  };
}

export type GameLeader = { label: string; icon: string; hunterId: string; value: number; roast?: boolean };

/** Leaders for the board: best single round, best season total, most coots (boo), etc. */
export function gameLeaders(data: Data, scope: Scope = {}): GameLeader[] {
  const rows = data.hunters.map((h) => ({ id: h.id, s: gameStats(gamesFor(data, h.id, scope)) })).filter((r) => r.s.games > 0);
  if (!rows.length) return [];
  const lead = (label: string, icon: string, pick: (s: GameStats) => number, roast = false): GameLeader | null => {
    const best = [...rows].sort((a, b) => pick(b.s) - pick(a.s))[0];
    return best && pick(best.s) > 0 ? { label, icon, hunterId: best.id, value: pick(best.s), roast } : null;
  };
  return [
    lead('High score', '🕹️', (s) => s.best),
    lead('Highest overall', '🏆', (s) => s.total),
    lead('Rounds won', '🎮', (s) => s.games),
    lead('Most bands', '💍', (s) => s.bands),
    lead('Most geese', '🪿', (s) => s.geese),
    lead('Most swans', '🦢', (s) => s.swans),
    lead('Most coots (boo!)', '🐓', (s) => s.coots, true),
  ].filter((x): x is GameLeader => !!x);
}
