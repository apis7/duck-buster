/**
 * What the app says when you mark a hunter SKUNKED: sympathetic on the surface,
 * condescending underneath. Aimed at the hunt, never at the hunter's life.
 */
export const SKUNK_LINES = [
  'Skunked? Next time maybe make sure your safety is off when you pull the trigger.',
  'Skunked? HahahaHAhahaHAHAhaHA!!!! Sorry… I’m so sorry to hear you got skunked.',
  'Skunked? I’ve heard chicken tastes better than duck anyway.',
  'Skunked? Glad we don’t have to rely on your hunting to survive…',
  'Skunked? The ducks wanted me to tell you they had a lovely morning.',
  'Skunked? Don’t worry, the decoys had a great time.',
  'Skunked? Look on the bright side: no plucking!',
  'Skunked? Your dog is very disappointed. He won’t say it. But he is.',
  'Skunked? Bold strategy, letting them all live. Very conservation-minded.',
  'Skunked? I’m sure the wind was wrong. And the moon. And the barometer. Aliens!',
  'Skunked? At least you had fun. And that’s what matters. (It isn’t.)',
  'Skunked? Make sure to open your eyes next time when you’re shooting.',
  'Skunked? Your shells would like to know why they were wasted.',
  'Skunked? Hey, a 0 is still a number. Technically.',
  'Skunked? The grocery store has ducks. No license needed.',
  'Skunked? I’ll tell everyone you “limited out on memories.”',
  'Skunked? Every duck in the county just high-fived.',
  'Skunked? It’s fine. Ducks are overrated. (Please don’t tell the ducks.)',
  'Skunked? You got up at 4 AM for this. Incredible.',
  'Skunked? At least you had fun making noise with the duck call.',
  'Skunked? Pro tip: the pointy end goes toward the birds.',
  'Skunked? Well, somebody has to keep the duck population healthy. Thank you for your service.',
  'Skunked? Don’t worry, I won’t tell the Bragging Board. (I’m the Bragging Board.)',
  'Skunked? On the plus side, your gun is really, really clean.',
  'Skunked? Oh, this was just a scouting trip!',
  'Skunked? The ducks think you’re a great shot!',
  'Skunked? Maybe the ducks just didn’t think you were ready for this relationship.',
  'Skunked? Sorry for your loss. Of dignity. The ducks are fine.',
  'Skunked? It’s not a competition. (It is.)',
  'Skunked? Chin up! There’s always the Participation Trophy at Awards Night.',
];

/** A random line index that isn't `last` (no repeats back to back). */
export function pickSkunkLine(last: number | null, rng: () => number = Math.random): number {
  if (SKUNK_LINES.length < 2) return 0;
  let i = Math.floor(rng() * SKUNK_LINES.length);
  if (i === last) i = (i + 1 + Math.floor(rng() * (SKUNK_LINES.length - 1))) % SKUNK_LINES.length;
  return i;
}
