import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, PIXEL_FONT } from '@/ui/theme';
import { useUpdateCheck } from '@/ui/useUpdateCheck';

const icon = (glyph: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  // Android draws edge to edge: the tab bar has to sit above the nav buttons / gesture bar itself.
  const insets = useSafeAreaInsets();
  useUpdateCheck();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.navy,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopWidth: 2.5,
          borderTopColor: C.navy,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontFamily: PIXEL_FONT, fontSize: 7, marginTop: 2 },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'HUNTS', tabBarIcon: icon('🦆') }} />
      <Tabs.Screen name="board" options={{ title: 'BRAG', tabBarIcon: icon('🏆') }} />
      <Tabs.Screen name="dex" options={{ title: 'DUCK-DEX', tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="quiz" options={{ title: 'QUIZ', tabBarIcon: icon('❓') }} />
      <Tabs.Screen name="more" options={{ title: 'MORE ⚙', tabBarIcon: icon('☰') }} />
    </Tabs>
  );
}
