import QRCode from 'qrcode';

/**
 * A transfer frame as one SVG path, ready to draw.
 *
 * One `<Path>` per frame instead of one `<Rect>` per module: a version-16 code has
 * thousands of dark modules, and swapping that many native views five times a
 * second visibly stutters. Runs of dark modules on each row become one rectangle.
 *
 * Level L error correction on purpose — the opposite of the printed labels. A
 * screen is flat, lit and undamaged, so the extra redundancy would only make each
 * module smaller; and a frame read badly is simply caught again next lap.
 * The text is forced into alphanumeric mode, which is what Base45 was chosen for.
 */
export type QrPath = { size: number; d: string };

/** Quiet zone in modules. 2 is enough on a backlit screen and keeps modules larger. */
export const SCREEN_QUIET_ZONE = 2;

export function frameToPath(text: string): QrPath {
  const qr = QRCode.create([{ data: text, mode: 'alphanumeric' }], { errorCorrectionLevel: 'L' });
  const n = qr.modules.size;
  const q = SCREEN_QUIET_ZONE;
  let d = '';
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!qr.modules.get(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < n && qr.modules.get(x, y)) x++;
      d += `M${start + q} ${y + q}h${x - start}v1h${start - x}z`;
    }
  }
  return { size: n + 2 * q, d };
}
