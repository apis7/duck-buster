import { SPECIES_BY_ID } from './species';
import { hunterStats, type Scope } from './stats';
import type { Data } from './types';

/**
 * Species leaders: for each duck or goose type, the one hunter who has bagged the
 * most. Ties lead nobody. Each lead counts as one badge for as long as it holds.
 */

export type SpeciesLead = { speciesId: string; count: number };

/** Badge ids for leads look like `lead:<speciesId>` so they sit beside real badges. */
export const LEAD_PREFIX = 'lead:';

export function speciesLeads(data: Data, scope: Scope = {}): Map<string, SpeciesLead[]> {
  const best = new Map<string, { hunterId: string; count: number; tied: boolean }>();
  for (const h of data.hunters) {
    for (const [speciesId, count] of Object.entries(hunterStats(data, h.id, scope).bySpecies)) {
      if (count <= 0) continue;
      const cur = best.get(speciesId);
      if (!cur || count > cur.count) best.set(speciesId, { hunterId: h.id, count, tied: false });
      else if (count === cur.count) cur.tied = true;
    }
  }
  const out = new Map<string, SpeciesLead[]>();
  for (const [speciesId, b] of best) {
    if (b.tied) continue;
    out.set(b.hunterId, [...(out.get(b.hunterId) ?? []), { speciesId, count: b.count }]);
  }
  for (const list of out.values()) list.sort((a, b) => b.count - a.count);
  return out;
}

/** Adds each hunter's leads to a badge map as `lead:<speciesId>` entries. */
export function withLeads(badges: Map<string, string[]>, leads: Map<string, SpeciesLead[]>): Map<string, string[]> {
  const out = new Map(badges);
  for (const [hunterId, list] of leads) out.set(hunterId, [...(out.get(hunterId) ?? []), ...list.map((l) => LEAD_PREFIX + l.speciesId)]);
  return out;
}

export function speciesLabel(data: Data, speciesId: string): string {
  return SPECIES_BY_ID[speciesId]?.name ?? data.customSpecies.find((c) => c.id === speciesId)?.name ?? speciesId;
}

/** Who has bagged the most of one species (several when tied); null if nobody has any. */
export function speciesLeader(data: Data, speciesId: string, scope: Scope = {}): { hunterIds: string[]; count: number } | null {
  let count = 0;
  let hunterIds: string[] = [];
  for (const h of data.hunters) {
    const n = hunterStats(data, h.id, scope).bySpecies[speciesId] ?? 0;
    if (n <= 0 || n < count) continue;
    if (n > count) {
      count = n;
      hunterIds = [h.id];
    } else hunterIds.push(h.id);
  }
  return count > 0 ? { hunterIds, count } : null;
}
