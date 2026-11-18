import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { shiftDate, todayISO } from '@/domain/season';

import { Btn, Pixel } from './kit';
import { C } from './theme';

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Month calendar for picking a hunt date. Future days can't be picked; days that
 * already have a hunt are marked (one hunt per day).
 */
export function DatePicker({
  visible, value, huntDays, onPick, onClose,
}: { visible: boolean; value: string; huntDays: Set<string>; onPick: (date: string) => void; onClose: () => void }) {
  const today = todayISO();
  const [y0, m0] = value.split('-').map(Number);
  const [cursor, setCursor] = useState({ y: y0, m: m0 - 1 });
  const { y, m } = cursor;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const atCurrentMonth = iso(y, m, 1) >= today.slice(0, 8) + '01';

  const move = (delta: number) => {
    const d = new Date(y, m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.head}>
            <Pressable onPress={() => move(-1)} hitSlop={12} style={styles.arrow}>
              <Pixel size={14}>{'<'}</Pixel>
            </Pressable>
            <Pixel size={11}>{`${MONTHS[m]} ${y}`}</Pixel>
            <Pressable onPress={() => !atCurrentMonth && move(1)} hitSlop={12} style={styles.arrow}>
              <Pixel size={14} color={atCurrentMonth ? C.locked : C.navy}>{'>'}</Pixel>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {DOW.map((d, i) => (
              <Text key={`h${i}`} style={styles.dow}>{d}</Text>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <View key={i} style={styles.cell} />;
              const date = iso(y, m, d);
              const future = date > today;
              const selected = date === value;
              const hunted = huntDays.has(date);
              return (
                <Pressable
                  key={i}
                  disabled={future}
                  onPress={() => onPick(date)}
                  style={[styles.cell, selected && { backgroundColor: C.orange }, date === today && !selected && styles.today]}
                >
                  <Text style={[styles.day, future && { color: C.locked }, selected && { color: C.white }]}>{d}</Text>
                  {hunted ? <Text style={styles.mark}>🦆</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="TODAY" small kind="secondary" onPress={() => onPick(today)} style={{ flex: 1 }} />
            <Btn label="YESTERDAY" small kind="secondary" onPress={() => onPick(shiftDate(today, -1))} style={{ flex: 1 }} />
          </View>
          <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>🦆 = already has a hunt · one hunt per day</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,61,0.75)', justifyContent: 'center', padding: 18 },
  card: { backgroundColor: C.white, borderWidth: 3, borderColor: C.navy, borderBottomWidth: 7, borderRightWidth: 7, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { padding: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', color: C.muted, fontWeight: '800', paddingBottom: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: C.orange },
  day: { fontSize: 16, fontWeight: '700', color: C.navy },
  mark: { fontSize: 9, position: 'absolute', bottom: 2 },
});
