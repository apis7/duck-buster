import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HolidayOrnament } from './Ornament';
import { C, PIXEL_FONT } from './theme';

/** Small shared building blocks: pixel headings, chunky buttons with hard shadows, cards. */

export function Pixel({ children, size = 12, color = C.navy, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  // The pixel font is wide; past ~1.3× it breaks tight layouts on small phones.
  return (
    <Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: PIXEL_FONT, fontSize: size, color, lineHeight: size * 1.6 }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style, muted }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return (
    <Text maxFontSizeMultiplier={1.6} style={[{ fontSize: 15, color: muted ? C.muted : C.ink, lineHeight: 21 }, style]}>
      {children}
    </Text>
  );
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Btn({
  label, onPress, kind = 'primary', style, disabled, small,
}: { label: string; onPress: () => void; kind?: BtnKind; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean }) {
  const bg = kind === 'primary' ? C.orange : kind === 'danger' ? C.red : kind === 'secondary' ? C.white : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? C.white : C.navy;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, borderColor: kind === 'ghost' ? 'transparent' : C.navy, opacity: disabled ? 0.45 : 1 },
        kind !== 'ghost' && !pressed && styles.hardShadow,
        pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
        style,
      ]}
    >
      <Pixel size={small ? 9 : 11} color={fg} style={{ textAlign: 'center' }}>
        {label}
      </Pixel>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, !pressed && styles.hardShadow, pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, styles.hardShadow, style]}>{children}</View>;
}

export function Chip({ label, on, onPress, color = C.navy, style }: { label: string; on?: boolean; onPress?: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={[styles.chip, { borderColor: color, backgroundColor: on ? color : C.white }, style]}
    >
      <Text style={{ color: on ? C.white : color, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Screen({ title, children, right, scroll = true, padded = true }: { title?: string; children: ReactNode; right?: ReactNode; scroll?: boolean; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  const body = padded ? <View style={{ padding: 16, gap: 14 }}>{children}</View> : children;
  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: insets.top }}>
      {title ? (
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <HolidayOrnament side="left" />
            <Pixel size={14}>{title}</Pixel>
            <HolidayOrnament side="right" />
          </View>
          {right}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children?: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pixel size={10} color={C.muted}>
          {title.toUpperCase()}
        </Pixel>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Dot({ color, size = 12 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, backgroundColor: color, borderWidth: 1.5, borderColor: C.navy }} />;
}

export function Stepper({ value, onChange, min = 0, max = Infinity, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      {label ? <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>{label}</Text> : null}
      <View style={styles.stepper}>
        <Pressable hitSlop={6} onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn}>
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <Pixel size={12} style={{ minWidth: 26, textAlign: 'center' }}>
          {value}
        </Pixel>
        <Pressable hitSlop={6} onPress={() => onChange(Math.min(max, value + 1))} style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}>
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0.02, value / max) : 0;
  return (
    <View style={{ height: 14, backgroundColor: C.line, borderWidth: 1.5, borderColor: C.navy, flex: 1 }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: { borderWidth: 2.5, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  // Thick bottom/right border reads as an 8-bit drop shadow on both platforms.
  hardShadow: { borderBottomWidth: 5, borderRightWidth: 5 },
  card: { backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy, padding: 14 },
  chip: { borderWidth: 2, paddingVertical: 7, paddingHorizontal: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 2.5, borderColor: C.navy, backgroundColor: C.white },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: C.navy, backgroundColor: C.white },
  stepBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navySoft },
  stepTxt: { fontSize: 20, fontWeight: '800', color: C.navy },
});

/** A one-line "here's what you're looking at" that updates as things are tapped. */
export function Explainer({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, backgroundColor: C.navySoft, borderLeftWidth: 4, borderColor: C.navy, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text style={{ fontSize: 14 }}>ℹ️</Text>
      <Text maxFontSizeMultiplier={1.5} style={{ flex: 1, fontSize: 13, lineHeight: 18, color: C.navy }}>
        {children}
      </Text>
    </View>
  );
}
