import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import type { BirdShape, Species } from '@/domain/species';

import { C } from './theme';

/**
 * Procedural pixel portrait for a Duck-dex card: one template per body shape,
 * painted with the species' drake colors. Pixels of one color are merged into a
 * single SVG path, so a whole card is about eight paths.
 *
 * H head · E eye · b bill · R breast · S body · W wing · A accent · T tail
 */
const TEMPLATES: Record<BirdShape, string[]> = {
  duck: [
    '..........HHH...',
    '.........HHHHH..',
    '.........HHEHHbb',
    '..........HHHH..',
    '..........RRR...',
    '.TT.WWWWWRRRR...',
    'TTSWWAAWWWRRRR..',
    '.TSSSSWWWWRRRR..',
    '..SSSSSSSSSRRR..',
    '...SSSSSSSSSR...',
    '....SSSSSSSS....',
  ],
  goose: [
    '...........HH...',
    '..........HHHH..',
    '..........HAEHbb',
    '..........HAH...',
    '..........HH....',
    '..........HH....',
    '..........RR....',
    '.TT.WWWWWRRR....',
    'TTSWWWWWWRRRR...',
    '.TSSSSWWWWRRR...',
    '..SSSSSSSSSRR...',
    '...SSSSSSSSS....',
  ],
  coot: [
    '................',
    '.........HHH....',
    '........HHHHHA..',
    '........HHEHbbb.',
    '.........HHH....',
    '....WWWWWRRR....',
    '..TWWWWWWRRRR...',
    '..TSSSSSSRRRR...',
    '...SSSSSSSRR....',
    '....SSSSSSS.....',
    '................',
  ],
};

function colorFor(ch: string, s: Species): string {
  const k = s.colors;
  switch (ch) {
    case 'H': return k.head;
    case 'E': return '#111111';
    case 'b': return k.bill;
    case 'R': return k.breast;
    case 'S': return k.body;
    case 'W': return k.wing;
    case 'A': return k.accent;
    case 'T': return k.tail;
    default: return 'transparent';
  }
}

export const PixelBird = memo(function PixelBird({ species, size = 64, locked }: { species: Species; size?: number; locked?: boolean }) {
  const rows = TEMPLATES[species.shape];
  const h = rows.length;
  const paths = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = locked ? (ch === 'E' ? C.paper : C.locked) : colorFor(ch, species);
      paths.set(color, (paths.get(color) ?? '') + `M${x} ${y}h1v1h-1z`);
    }
  });
  return (
    <Svg width={size} height={(size * h) / 16} viewBox={`0 0 16 ${h}`}>
      {Array.from(paths.entries()).map(([color, d]) => (
        <Path key={color} d={d} fill={color} stroke={color} strokeWidth={0.04} />
      ))}
    </Svg>
  );
});
