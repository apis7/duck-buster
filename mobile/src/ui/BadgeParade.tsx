import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { play } from '@/audio/sfx';
import type { Badge } from '@/domain/badges';

import { Btn, Pixel } from './kit';
import { C } from './theme';

/** Pops newly earned badges one at a time. Nobody knew they existed until now. */
export function BadgeParade({ items, onDone }: { items: { badge: Badge; hunterName: string }[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const scale = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    play('badge');
    scale.value = 0;
    scale.value = withSpring(1, { damping: 7, stiffness: 160 });
    wobble.value = withSequence(withTiming(-10, { duration: 90 }), withTiming(10, { duration: 120 }), withTiming(0, { duration: 90 }));
  }, [i, scale, wobble]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${wobble.value}deg` }] }));
  const item = items[i];
  if (!item) return null;

  const next = () => (i + 1 < items.length ? setI(i + 1) : onDone());

  return (
    <Modal transparent animationType="fade" onRequestClose={next}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, style]}>
          <Pixel size={9} color={C.orange}>{items.length > 1 ? `BADGE UNLOCKED ${i + 1}/${items.length}` : 'BADGE UNLOCKED'}</Pixel>
          <Text style={{ fontSize: 72, marginVertical: 8 }}>{item.badge.icon}</Text>
          <Pixel size={14} style={{ textAlign: 'center' }}>{item.badge.name.toUpperCase()}</Pixel>
          <Pixel size={9} color={C.muted}>{item.hunterName.toUpperCase()}</Pixel>
          <Text style={{ fontSize: 16, textAlign: 'center', color: C.ink, marginVertical: 10 }}>{item.badge.blurb}</Text>
          <Btn label={i + 1 < items.length ? 'NEXT!' : 'NICE!'} onPress={next} style={{ alignSelf: 'stretch' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,61,0.8)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: C.white, borderWidth: 3, borderColor: C.navy, borderBottomWidth: 7, borderRightWidth: 7, padding: 22, alignItems: 'center', gap: 4, width: '100%' },
});
