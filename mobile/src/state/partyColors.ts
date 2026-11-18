/** Party colors: bold and easy to tell apart. New parties get a random unused one. */
export const PARTY_COLORS = [
  '#D7263D', '#1B998B', '#F46036', '#2E294E', '#C5D86D', '#3F88C5', '#A23B72', '#F18F01',
  '#3B1F2B', '#44AF69', '#E4572E', '#5D5179', '#8C6A2F', '#0B6E4F', '#C2185B', '#607D8B',
];

export function pickPartyColor(used: string[]): string {
  const free = PARTY_COLORS.filter((c) => !used.includes(c));
  if (free.length) return free[Math.floor(Math.random() * free.length)];
  // All taken: a random color that isn't already in use.
  let c = '';
  do c = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
  while (used.includes(c));
  return c;
}
