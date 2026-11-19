import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';

import { Pixel } from './kit';
import { C } from './theme';

/** The skunk zinger. Tap to dismiss; it fades on its own after six seconds. */
export function SkunkSplash({ name, message, onDismiss }: { name: string; message: string; onDismiss: () => void }) {
  const hop = useSharedValue(0);

  useEffect(() => {
    hop.set(withRepeat(withSequence(withTiming(-6, { duration: 160 }), withTiming(0, { duration: 160 })), 2));
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [hop, onDismiss]);

  const skunk = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));

  return (
    <Animated.View entering={ZoomIn.duration(200)} exiting={FadeOut.duration(250)} style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={onDismiss} style={styles.card}>
        <Animated.Text style={[{ fontSize: 46, textAlign: 'center' }, skunk]}>🦨</Animated.Text>
        <Pixel size={10} color={C.orange} style={{ textAlign: 'center' }}>{`${name.toUpperCase()} GOT SKUNKED`}</Pixel>
        <Text style={styles.msg}>{message}</Text>
        <Text style={styles.hint}>tap to dismiss</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: C.navyDark, borderWidth: 3, borderColor: C.orange, borderBottomWidth: 7, borderRightWidth: 7, padding: 18, gap: 8 },
  msg: { color: C.white, fontSize: 18, lineHeight: 25, textAlign: 'center' },
  hint: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center' },
});
