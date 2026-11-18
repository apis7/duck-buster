import { describe, expect, it } from 'vitest';

import { pickSkunkLine, SKUNK_LINES } from '@/domain/skunk';

describe('skunk zingers', () => {
  it('has the full set, all starting with "Skunked?"', () => {
    expect(SKUNK_LINES.length).toBe(30);
    for (const l of SKUNK_LINES) expect(l.startsWith('Skunked?')).toBe(true);
  });

  it('never repeats the previous line back to back', () => {
    let last: number | null = null;
    for (let i = 0; i < 2000; i++) {
      const next = pickSkunkLine(last);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(SKUNK_LINES.length);
      last = next;
    }
  });

  it('dodges a repeat even when the dice land on it', () => {
    expect(pickSkunkLine(0, () => 0)).not.toBe(0);
  });
});
