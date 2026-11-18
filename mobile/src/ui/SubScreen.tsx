import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pixel } from './kit';
import { C } from './theme';

/** A pushed screen with a back link. */
export function SubScreen({ title, children, dark, scroll = true }: { title: string; children: ReactNode; dark?: boolean; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const fg = dark ? C.white : C.navy;
  return (
    <View style={{ flex: 1, backgroundColor: dark ? C.navyDark : C.paper }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16,
          backgroundColor: dark ? C.navyDark : C.white, borderBottomWidth: 2.5, borderColor: dark ? C.navy : C.navy,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Pixel size={10} color={fg}>{'< BACK'}</Pixel>
        </Pressable>
        <Pixel size={12} color={fg} style={{ flex: 1 }}>{title}</Pixel>
      </View>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>{children}</View>
      )}
    </View>
  );
}
