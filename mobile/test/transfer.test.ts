import { describe, expect, it } from 'vitest';

import { encodeTransfer, parseFrame, TransferAssembler } from '@/transfer/frames';
import { SNAPSHOT_FORMAT, snapshotFromBytes, snapshotToBytes } from '@/transfer/snapshot';

import { makeData } from './fixtures';

function bigLog() {
  const d = makeData();
  for (let i = 0; i < 120; i++) {
    const h = d.hunt(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`, ['dad', 'kid']);
    d.bird(h, 'dad', 'mall', 3, 'D', i % 10 === 0 ? 1 : 0);
    d.bird(h, 'kid', 'gwte', 2, 'H');
  }
  return { hunters: d.hunters, parties: d.parties, customSpecies: [{ id: 'c1', name: 'Mystery Duck', sexed: true, createdAt: 1 }], hunts: d.hunts, huntHunters: d.huntHunters, harvests: d.harvests };
}

describe('QR transfer', () => {
  it('round-trips a season through the frame loop, even with frames missed', () => {
    const data = bigLog();
    const frames = encodeTransfer(snapshotToBytes(data), { session: 'ABCDEF', format: SNAPSHOT_FORMAT });
    expect(frames.length).toBeGreaterThan(2);
    expect(frames[0].startsWith('DKB1:')).toBe(true);

    const asm = new TransferAssembler();
    // Drop the first data frame of the loop; parity rebuilds it.
    frames.slice(1).forEach((f) => {
      const p = parseFrame(f, SNAPSHOT_FORMAT);
      if (p.type === 'frame') asm.accept(p.frame);
    });
    expect(asm.progress().complete).toBe(true);
    const snap = snapshotFromBytes(asm.result());
    expect(snap.data).toEqual(data);
  });

  it('ignores QRUNBOX codes and anything else', () => {
    expect(parseFrame('QRB1:ABCDEF:1:1:10:0:D0:AAAA', 1).type).toBe('not-ours');
    expect(parseFrame('https://example.com', 1).type).toBe('not-ours');
  });

  it('rejects malformed snapshots', () => {
    const bad = new TextEncoder().encode(JSON.stringify({ format: 1, data: { hunters: [{}], hunts: [], huntHunters: [], harvests: [] } }));
    expect(() => snapshotFromBytes(bad)).toThrow();
  });
});
