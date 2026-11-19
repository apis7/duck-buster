import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { ornamentFor } from '@/domain/calendar';
import { todayISO } from '@/domain/season';

import { PixelSprite } from './PixelSprite';

/** A tiny pixel crucifix: gold cross, pale corpus. */
const CRUCIFIX = [
  '...WW...',
  '...WW...',
  'WWWccWWW',
  'WWcccWWW',
  '...cc...',
  '...WW...',
  '...WW...',
  '...cW...',
  '...WW...',
  '...WW...',
];
const CRUCIFIX_PALETTE = { W: '#B8862E', c: '#F2E2C8' };

/**
 * A little seasonal ornament for a header, on or around a holiday — presents at
 * Christmas, a crucifix through Holy Week and Easter, shamrocks for St. Patrick…
 * Nothing on ordinary days.
 */
export function HolidayOrnament({ side }: { side: 'left' | 'right' }) {
  const o = useMemo(() => ornamentFor(todayISO()), []);
  if (!o) return null;
  if (o.crucifix) return side === 'right' ? <PixelSprite rows={CRUCIFIX} palette={CRUCIFIX_PALETTE} pixel={2.4} /> : null;
  const glyph = side === 'left' ? o.left : o.right;
  if (!glyph) return null;
  return (
    <View>
      <Text style={{ fontSize: 16 }}>{glyph}</Text>
    </View>
  );
}
