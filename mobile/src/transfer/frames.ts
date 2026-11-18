// Ported from QRUNBOX (C:/Dev/QRMoving/mobile/src/transfer) with its own "DKB" prefix,
// so the two apps never read each other's codes.
import { deflateSync, Inflate } from 'fflate';

import { base45Decode, base45Encode } from './base45';
import { crc32 } from './crc32';

/**
 * Phone-to-phone transfer over a loop of QR codes.
 *
 * The sender compresses the payload, cuts it into fixed-size chunks and shows one
 * QR per chunk on a loop. The receiver points its camera at the loop and collects
 * chunks in whatever order it happens to catch them.
 *
 * The weak spot of a plain loop is the last few frames: miss one and you wait a
 * whole lap for it to come round again, which on a long log is most of a minute
 * of holding two phones still. So every group of {@link GROUP_SIZE} data frames is
 * followed by one parity frame — the XOR of the group. Any single frame missed in
 * a group is rebuilt from the parity frame and the other seven, without waiting.
 *
 * Frame text, every character inside QR's alphanumeric set:
 *
 *     DKB1:<session>:<format>:<dataCount>:<byteLength>:<crc>:<seq>:<base45 bytes>
 *
 * - `DKB1`       protocol 1. An incompatible framing becomes DKB2; later apps keep
 *                reading DKB1 so an old phone can always send to a new one.
 * - `session`    random per Send screen, so pointing at a different phone mid-scan
 *                starts over cleanly instead of mixing two transfers.
 * - `format`     the sender's snapshot format, in every frame, so a phone too old
 *                to read it says so on the first frame rather than after the lap.
 * - `dataCount`  number of data frames.
 * - `byteLength` length of the compressed payload, so the last chunk's length and
 *                the parity padding are known without being sent.
 * - `crc`        CRC-32 of the compressed payload, base 36. Checked after assembly.
 * - `seq`        `D<i>` for data frame i, `P<g>` for group g's parity frame.
 */

export const PROTOCOL = 1;
const MAGIC = 'DKB';

/**
 * Bytes per frame. 450 bytes is 675 Base45 characters plus a ~40 character header,
 * which lands around QR version 15–16 at error-correction level L: dense enough
 * to keep the lap short, coarse enough to read off another phone's screen at a
 * comfortable distance.
 */
export const CHUNK_BYTES = 450;

/** Data frames covered by each parity frame. */
export const GROUP_SIZE = 8;

/** How long the sender shows each frame. Part of the protocol: the receiver's time-left estimate assumes it. */
export const FRAME_MS = 200;

/** Bounds a crafted header: 20,000 × 450 B ≈ 9 MB compressed, far beyond any real hunting log. */
const MAX_DATA_FRAMES = 20_000;

/** Stops a crafted payload from inflating into an out-of-memory crash. */
const MAX_INFLATED_BYTES = 64 * 1024 * 1024;

export type FrameSeq = { kind: 'D' | 'P'; index: number };

export type Frame = {
  session: string;
  format: number;
  dataCount: number;
  byteLength: number;
  crc: number;
  seq: FrameSeq;
  bytes: Uint8Array;
};

/* ── Geometry shared by both ends ─────────────────────────────────────────── */

function groupCount(dataCount: number): number {
  return Math.ceil(dataCount / GROUP_SIZE);
}

function groupLength(dataCount: number, group: number): number {
  return Math.min(GROUP_SIZE, dataCount - group * GROUP_SIZE);
}

/** A one-frame group gets no parity frame: it would just be a duplicate. */
function hasParity(dataCount: number, group: number): boolean {
  return groupLength(dataCount, group) > 1;
}

function chunkLength(byteLength: number, dataCount: number, index: number): number {
  return index < dataCount - 1 ? CHUNK_BYTES : byteLength - CHUNK_BYTES * (dataCount - 1);
}

/** Every frame in the order the sender plays them: a group's data, then its parity. */
export function loopOrder(dataCount: number): FrameSeq[] {
  const order: FrameSeq[] = [];
  for (let g = 0; g < groupCount(dataCount); g++) {
    const start = g * GROUP_SIZE;
    for (let i = start; i < start + groupLength(dataCount, g); i++) {
      order.push({ kind: 'D', index: i });
    }
    if (hasParity(dataCount, g)) order.push({ kind: 'P', index: g });
  }
  return order;
}

/** Where a frame sits in the loop. Only the last group can lack parity, so earlier groups are all G+1 long. */
function loopPosition(seq: FrameSeq, dataCount: number): number {
  if (seq.kind === 'D') return seq.index + Math.floor(seq.index / GROUP_SIZE);
  return seq.index * (GROUP_SIZE + 1) + groupLength(dataCount, seq.index);
}

function xorInto(target: Uint8Array, source: Uint8Array): void {
  for (let i = 0; i < source.length; i++) target[i] ^= source[i];
}

/* ── Sending ──────────────────────────────────────────────────────────────── */

const SESSION_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Six characters from 32, unambiguous to read. Collisions only matter between two phones in the same room. */
export function sessionFromBytes(random: Uint8Array): string {
  if (random.length < 6) throw new Error('Need 6 random bytes for a session id.');
  let s = '';
  for (let i = 0; i < 6; i++) s += SESSION_ALPHABET[random[i] % SESSION_ALPHABET.length];
  return s;
}

export function encodeTransfer(
  payload: Uint8Array,
  options: { session: string; format: number },
): string[] {
  const compressed = deflateSync(payload, { level: 9 });
  const byteLength = compressed.length;
  const dataCount = Math.max(1, Math.ceil(byteLength / CHUNK_BYTES));
  if (dataCount > MAX_DATA_FRAMES) {
    throw new Error('This is too much to send by QR code.');
  }

  const header = [
    `${MAGIC}${PROTOCOL}`,
    options.session,
    options.format,
    dataCount,
    byteLength,
    crc32(compressed).toString(36).toUpperCase(),
  ].join(':');

  const chunk = (i: number) => compressed.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);

  return loopOrder(dataCount).map((seq) => {
    let bytes: Uint8Array;
    if (seq.kind === 'D') {
      bytes = chunk(seq.index);
    } else {
      bytes = new Uint8Array(CHUNK_BYTES);
      const start = seq.index * GROUP_SIZE;
      for (let i = start; i < start + groupLength(dataCount, seq.index); i++) {
        xorInto(bytes, chunk(i));
      }
    }
    return `${header}:${seq.kind}${seq.index}:${base45Encode(bytes)}`;
  });
}

/* ── Receiving ────────────────────────────────────────────────────────────── */

export type ParseResult =
  | { type: 'frame'; frame: Frame }
  /** A Duck Buster transfer code this app is too old to read. */
  | { type: 'too-new' }
  /** Anything else: a Wi-Fi code, a QRUNBOX code, a misread. */
  | { type: 'not-ours' };

const NOT_OURS: ParseResult = { type: 'not-ours' };

function wholeNumber(text: string): number | null {
  return /^\d{1,9}$/.test(text) ? Number(text) : null;
}

/**
 * @param maxFormat the newest snapshot format this app can read.
 */
export function parseFrame(text: string, maxFormat: number): ParseResult {
  if (!text.startsWith(MAGIC)) return NOT_OURS;

  const parts = text.split(':');
  const protocol = wholeNumber(parts[0].slice(MAGIC.length));
  if (protocol == null) return NOT_OURS;
  // Only the protocol number is promised to stay put; past it a newer framing may differ.
  if (protocol > PROTOCOL) return { type: 'too-new' };
  if (protocol !== PROTOCOL || parts.length < 8) return NOT_OURS;

  const [, session, formatText, countText, lengthText, crcText, seqText] = parts;
  // Base45 uses ':' too, so the payload is everything after the seventh separator.
  const body = parts.slice(7).join(':');

  const format = wholeNumber(formatText);
  const dataCount = wholeNumber(countText);
  const byteLength = wholeNumber(lengthText);
  const seqMatch = /^([DP])(\d{1,9})$/.exec(seqText);
  if (
    !/^[A-Z0-9]{6}$/.test(session) ||
    !/^[0-9A-Z]{1,7}$/.test(crcText) ||
    format == null ||
    format < 1 ||
    dataCount == null ||
    byteLength == null ||
    seqMatch == null ||
    dataCount < 1 ||
    dataCount > MAX_DATA_FRAMES ||
    byteLength > dataCount * CHUNK_BYTES ||
    byteLength <= (dataCount - 1) * CHUNK_BYTES
  ) {
    return NOT_OURS;
  }
  if (format > maxFormat) return { type: 'too-new' };

  const seq: FrameSeq = { kind: seqMatch[1] as 'D' | 'P', index: Number(seqMatch[2]) };
  if (seq.kind === 'D' && seq.index >= dataCount) return NOT_OURS;
  if (seq.kind === 'P' && (seq.index >= groupCount(dataCount) || !hasParity(dataCount, seq.index))) {
    return NOT_OURS;
  }

  let bytes: Uint8Array;
  try {
    bytes = base45Decode(body);
  } catch {
    return NOT_OURS;
  }
  const expected =
    seq.kind === 'D' ? chunkLength(byteLength, dataCount, seq.index) : CHUNK_BYTES;
  if (bytes.length !== expected) return NOT_OURS;

  return {
    type: 'frame',
    frame: { session, format, dataCount, byteLength, crc: parseInt(crcText, 36), seq, bytes },
  };
}

export type TransferProgress = {
  /** Data frames in hand, including any rebuilt from parity. */
  received: number;
  total: number;
  /** Worst-case seconds until every missing frame has come round, or null before the first frame. */
  secondsLeft: number | null;
  complete: boolean;
};

/**
 * Collects the frames of one transfer. A frame from a different session starts
 * over: the user has pointed the camera at another phone, or the sender restarted.
 */
export class TransferAssembler {
  private header: Omit<Frame, 'seq' | 'bytes'> | null = null;
  private data: (Uint8Array | undefined)[] = [];
  private parity = new Map<number, Uint8Array>();
  private lastPosition = -1;

  /** The snapshot format the sender wrote, once the first frame is in. */
  get senderFormat(): number | null {
    return this.header?.format ?? null;
  }

  /** Returns true if the frame added anything. */
  accept(frame: Frame): boolean {
    const h = this.header;
    if (h == null || frame.session !== h.session) {
      this.reset();
      this.header = {
        session: frame.session,
        format: frame.format,
        dataCount: frame.dataCount,
        byteLength: frame.byteLength,
        crc: frame.crc,
      };
      this.data = new Array(frame.dataCount);
    } else if (
      frame.dataCount !== h.dataCount ||
      frame.byteLength !== h.byteLength ||
      frame.crc !== h.crc ||
      frame.format !== h.format
    ) {
      // Same session, different shape: a misread header. Ignore it.
      return false;
    }

    const header = this.header!;
    this.lastPosition = loopPosition(frame.seq, header.dataCount);

    const group =
      frame.seq.kind === 'D' ? Math.floor(frame.seq.index / GROUP_SIZE) : frame.seq.index;
    let added = false;
    if (frame.seq.kind === 'D') {
      if (this.data[frame.seq.index] === undefined) {
        this.data[frame.seq.index] = frame.bytes;
        added = true;
      }
    } else if (!this.parity.has(group)) {
      this.parity.set(group, frame.bytes);
      added = true;
    }

    if (added) this.recover(group);
    return added;
  }

  /** Rebuild the one missing data frame of a group from its parity frame. */
  private recover(group: number): void {
    const header = this.header!;
    const parity = this.parity.get(group);
    if (!parity) return;

    const start = group * GROUP_SIZE;
    const end = start + groupLength(header.dataCount, group);
    const missing: number[] = [];
    for (let i = start; i < end; i++) if (this.data[i] === undefined) missing.push(i);
    if (missing.length !== 1) return;

    const rebuilt = parity.slice();
    for (let i = start; i < end; i++) {
      const chunk = this.data[i];
      if (chunk) xorInto(rebuilt, chunk);
    }
    const index = missing[0];
    this.data[index] = rebuilt.subarray(0, chunkLength(header.byteLength, header.dataCount, index));
  }

  progress(): TransferProgress {
    const header = this.header;
    if (header == null) return { received: 0, total: 0, secondsLeft: null, complete: false };

    let received = 0;
    let framesToWait = 0;
    const loopLength = loopOrder(header.dataCount).length;
    for (let i = 0; i < header.dataCount; i++) {
      if (this.data[i] !== undefined) {
        received++;
        continue;
      }
      const position = loopPosition({ kind: 'D', index: i }, header.dataCount);
      const distance = (position - this.lastPosition + loopLength) % loopLength;
      framesToWait = Math.max(framesToWait, distance);
    }

    return {
      received,
      total: header.dataCount,
      secondsLeft: Math.ceil((framesToWait * FRAME_MS) / 1000),
      complete: received === header.dataCount,
    };
  }

  /**
   * The original payload, once every frame is in.
   * @throws if the reassembled bytes fail their checksum or won't decompress.
   */
  result(): Uint8Array {
    const header = this.header;
    if (header == null || !this.progress().complete) {
      throw new Error('The transfer is not complete yet.');
    }

    const compressed = new Uint8Array(header.byteLength);
    this.data.forEach((chunk, i) => compressed.set(chunk!, i * CHUNK_BYTES));
    if (crc32(compressed) !== header.crc) {
      throw new Error('The transfer arrived damaged. Scan it again.');
    }
    return inflateBounded(compressed);
  }

  reset(): void {
    this.header = null;
    this.data = [];
    this.parity.clear();
    this.lastPosition = -1;
  }
}

function inflateBounded(compressed: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total > MAX_INFLATED_BYTES) throw new Error('The transfer is too large to open.');
    parts.push(chunk);
  });
  inflater.push(compressed, true);

  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
