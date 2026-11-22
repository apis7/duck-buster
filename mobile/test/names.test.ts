import { describe, expect, it } from 'vitest';

import { firstDuplicate, nameTaken } from '../src/domain/names';

const crew = [{ id: 'a', name: 'Dad' }, { id: 'b', name: 'Uncle Nick' }];

describe('hunter names', () => {
  it('matches trimmed, case-insensitive, collapsed spaces', () => {
    expect(nameTaken(crew, '  uncle   nick ')?.id).toBe('b');
    expect(nameTaken(crew, 'Peter')).toBeUndefined();
  });
  it('ignores the hunter being renamed', () => {
    expect(nameTaken(crew, 'dad', 'a')).toBeUndefined();
    expect(nameTaken(crew, 'dad', 'b')?.id).toBe('a');
  });
  it('finds duplicates within a batch and against the crew', () => {
    expect(firstDuplicate(crew, ['Peter', 'Ben', 'peter'])).toBe('peter');
    expect(firstDuplicate(crew, ['Ben', 'DAD'])).toBe('DAD');
    expect(firstDuplicate(crew, ['Ben', '', '  ', 'Gus'])).toBeNull();
  });
});
