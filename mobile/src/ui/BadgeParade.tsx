import { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { play } from '@/audio/sfx';
import type { Badge } from '@/domain/badges';

import { Btn, Pixel } from './kit';
import { C } from './theme';

/**
 * Newly earned badges, all on one card — grouped by hunter, one tap to close.
 * Nobody knew they existed until now.
 */
export function BadgeParade({ items, onDone }: { items: { badge: Badge; hunterName: string }[]; onDone: () => void }) {
  useEffect(() => {
    play('badge');
  }, []);
  if (!items.length) return null;

  const byHunter = new Map<string, Badge[]>();
  for (const { badge, hunterName } of items) byHunter.set(hunterName, [...(byHunter.get(hunterName) ?? []), badge]);
  const single = items.length === 1 ? items[0] : null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onDone}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
        <Animated.View entering={ZoomIn.duration(180)} style={styles.card}>
          <Pixel size={9} color={C.orange}>{single ? 'BADGE UNLOCKED' : `${items.length} BADGES UNLOCKED`}</Pixel>
          {single ? (
            <>
              <Text style={{ fontSize: 64, marginVertical: 6 }}>{single.badge.icon}</Text>
              <Pixel size={14} style={{ textAlign: 'center' }}>{single.badge.name.toUpperCase()}</Pixel>
              <Pixel size={9} color={C.muted}>{single.hunterName.toUpperCase()}</Pixel>
              <Text style={styles.blurb}>{single.badge.blurb}</Text>
            </>
          ) : (
            <ScrollView style={{ maxHeight: 360, alignSelf: 'stretch' }} contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
              {Array.from(byHunter.entries()).map(([name, badges]) => (
                <View key={name} style={{ gap: 6 }}>
                  <Pixel size={9} color={C.muted}>{name.toUpperCase()}</Pixel>
                  {badges.map((b) => (
                    <View key={b.id} style={styles.row}>
                      <Text style={{ fontSize: 28 }}>{b.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{b.name}</Text>
                        <Text style={styles.small}>{b.blurb}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
          <Btn label="NICE!" onPress={onDone} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,61,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: C.white, borderWidth: 3, borderColor: C.navy, borderBottomWidth: 7, borderRightWidth: 7, padding: 20, alignItems: 'center', gap: 4, width: '100%' },
  blurb: { fontSize: 16, textAlign: 'center', color: C.ink, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1.5, borderColor: C.line, paddingBottom: 8 },
  name: { fontSize: 15, fontWeight: '800', color: C.navy },
  small: { fontSize: 13, color: C.muted },
});
