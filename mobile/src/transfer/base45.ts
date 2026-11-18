/**
 * Base45 (RFC 9285).
 *
 * Chosen because its 45 characters are exactly QR's alphanumeric set, which
 * packs 5.5 bits per character against byte mode's 8 bits per 6-bit Base64
 * character. Same bytes, noticeably smaller codes, so each frame can carry more.
 */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const VALUE = new Map<string, number>([...ALPHABET].map((ch, i) => [ch, i]));

export function base45Encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let n = bytes[i] * 256 + bytes[i + 1];
      const c = n % 45;
      n = (n - c) / 45;
      const d = n % 45;
      const e = (n - d) / 45;
      out += ALPHABET[c] + ALPHABET[d] + ALPHABET[e];
    } else {
      const n = bytes[i];
      out += ALPHABET[n % 45] + ALPHABET[Math.floor(n / 45)];
    }
  }
  return out;
}

export function base45Decode(text: string): Uint8Array {
  if (text.length % 3 === 1) throw new Error('Not valid Base45: bad length.');

  const out = new Uint8Array(Math.floor(text.length / 3) * 2 + (text.length % 3 === 2 ? 1 : 0));
  let o = 0;

  for (let i = 0; i < text.length; i += 3) {
    const group = text.slice(i, i + 3);
    let n = 0;
    let weight = 1;
    for (const ch of group) {
      const v = VALUE.get(ch);
      if (v === undefined) throw new Error('Not valid Base45: bad character.');
      n += v * weight;
      weight *= 45;
    }
    if (group.length === 3) {
      if (n > 0xffff) throw new Error('Not valid Base45: group out of range.');
      out[o++] = n >> 8;
      out[o++] = n & 0xff;
    } else {
      if (n > 0xff) throw new Error('Not valid Base45: group out of range.');
      out[o++] = n;
    }
  }
  return out;
}
