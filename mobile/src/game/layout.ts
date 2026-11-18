/**
 * Where everything in the mini-game sits, for any screen. Every phone shape has
 * to work — a 320 × 568 budget phone, a tall 20:9 flagship, a tablet — so the
 * layout is computed here and tested across sizes instead of hard-coded.
 *
 *   ┌ top inset ┐
 *   │ skip duck + HUD          (HUD_BAND)
 *   │ sky — where ducks fly    (skyTop … gunY − reedBand)
 *   │ reeds / pond             (reedBand)
 *   │ gun                      (gunLift above the bottom inset)
 *   └ bottom inset / nav bar ┘
 */

export type GameLayout = { gunY: number; skyTop: number; reedTop: number };

/** Space for the skip duck and the score/timer row under the status bar. */
export const HUD_BAND = 110;

export function gameLayout(width: number, height: number, insetTop: number, insetBottom: number): GameLayout {
  // Keep the gun well clear of the gesture bar / nav buttons, more on tall screens.
  const gunLift = clamp(height * 0.11, 78, 110);
  const gunY = height - Math.max(insetBottom, 24) - gunLift;
  const reedBand = clamp(height * 0.14, 90, 130);
  const skyTop = insetTop + HUD_BAND;
  return { gunY, skyTop, reedTop: gunY - reedBand };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
