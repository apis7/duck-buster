/**
 * South Dakota flavor for the Duck ID quiz.
 *
 * QUIZ_WEIGHT: how often a species comes up, roughly by how common it is in a
 * South Dakota bag (Central Flyway). Mallards and teal come up all the time;
 * sea ducks and coastal geese only now and then.
 *
 * RESTRICTIONS: species that are closed, permit-only, or usually carry a reduced
 * bag limit. Limits change every year — the notes say "usually" and point to the
 * regs on purpose. Shown on the photo after the question is answered.
 */

export const QUIZ_WEIGHT: Record<string, number> = {
  mall: 10, bwte: 9, cago: 9, gwte: 8, gadw: 8,
  sngo: 6, nopi: 6, amwi: 6, nsho: 6,
  wodu: 5, redh: 5, lesc: 5, cacg: 5,
  rndu: 4, canv: 4,
  rogo: 3, gwfg: 3, buff: 3, cogo: 3, rudu: 3, home: 3, amco: 3,
  come: 2, grsc: 2,
  cite: 1.5, abdu: 1, rbme: 1,
  ltdu: 0.5, bago: 0.4, susc: 0.4, wwsc: 0.4, blsc: 0.4, bran: 0.4,
  medu: 0.3, modu: 0.3, euwi: 0.3, fuwd: 0.3, bbwd: 0.3, hadu: 0.3,
  coei: 0.2, kiei: 0.2, emgo: 0.2,
};

/** Unknown species (new media before a weight is set) count as uncommon. */
export function quizWeight(speciesId: string): number {
  return QUIZ_WEIGHT[speciesId] ?? 1;
}

export type Restriction = { level: 'closed' | 'restricted'; text: string };

export const RESTRICTIONS: Record<string, Restriction> = {
  emgo: { level: 'closed', text: 'Mostly closed — Alaska permit hunt only' },
  hadu: { level: 'closed', text: 'Closed in the eastern U.S.; very limited elsewhere' },
  canv: { level: 'restricted', text: 'Reduced bag limit (usually 1–2 a day)' },
  nopi: { level: 'restricted', text: 'Reduced bag limit (usually 1–3 a day)' },
  lesc: { level: 'restricted', text: 'Reduced scaup bag limit' },
  grsc: { level: 'restricted', text: 'Reduced scaup bag limit' },
  redh: { level: 'restricted', text: 'Reduced bag limit (usually 2 a day)' },
  wodu: { level: 'restricted', text: 'Reduced bag limit (usually 3 a day)' },
  abdu: { level: 'restricted', text: 'Reduced bag limit (usually 1–2 a day)' },
  modu: { level: 'restricted', text: 'Reduced bag limit (usually 1 a day)' },
  mall: { level: 'restricted', text: 'Hen mallards limited (usually 2 a day)' },
  bran: { level: 'restricted', text: 'Short or quota seasons; closed some years' },
  fuwd: { level: 'restricted', text: 'Hunted only in a few southern states' },
  bbwd: { level: 'restricted', text: 'Hunted only in a few southern states' },
};
