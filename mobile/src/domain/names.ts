/** Hunter names are compared trimmed and case-insensitively: "peter " and "Peter" are the same hunter. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** The existing hunter (other than `exceptId`) already using this name, if any. */
export function nameTaken<T extends { id: string; name: string }>(hunters: T[], name: string, exceptId?: string): T | undefined {
  const k = nameKey(name);
  return hunters.find((h) => h.id !== exceptId && nameKey(h.name) === k);
}

/** First name that appears twice in a batch of new names, or already belongs to a hunter. */
export function firstDuplicate(existing: { name: string }[], names: string[]): string | null {
  const seen = new Set(existing.map((h) => nameKey(h.name)));
  for (const n of names) {
    const k = nameKey(n);
    if (!k) continue;
    if (seen.has(k)) return n.trim();
    seen.add(k);
  }
  return null;
}
