/**
 * Close-enough edible meat per bird, in ounces: breasts and legs, cleaned —
 * about a third of the live weight. Good for bragging about a full freezer, not
 * for a recipe. Birds the user added get a middle-of-the-road duck guess.
 */
const MEAT_OZ: Record<string, number> = {
  mall: 10, abdu: 10, modu: 9, medu: 9, gadw: 8, amwi: 7, euwi: 7, nopi: 9, nsho: 6,
  bwte: 4, gwte: 3.5, cite: 4, wodu: 6, fuwd: 7, bbwd: 8,
  canv: 11, redh: 9, rndu: 6, grsc: 8, lesc: 7, buff: 3.5, cogo: 7, bago: 8, rudu: 5,
  home: 5, come: 11, rbme: 8,
  ltdu: 6, susc: 9, wwsc: 12, blsc: 9, hadu: 5, coei: 16, kiei: 14,
  cago: 40, cacg: 20, sngo: 28, rogo: 16, gwfg: 30, bran: 18, emgo: 30,
  amco: 4,
};

export const DEFAULT_MEAT_OZ = 7;

export function meatOz(speciesId: string): number {
  return MEAT_OZ[speciesId] ?? DEFAULT_MEAT_OZ;
}

/** "≈ 3.4 lb" — or ounces under a pound. */
export function formatMeat(oz: number): string {
  if (oz <= 0) return '0 lb';
  if (oz < 16) return `≈ ${Math.round(oz)} oz`;
  const lb = oz / 16;
  return `≈ ${lb >= 100 ? Math.round(lb) : lb.toFixed(1)} lb`;
}
