import { PressStart2P_400Regular, useFonts } from '@expo-google-fonts/press-start-2p';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startAds } from '@/ads/ads';
import { initAudio, setMuted } from '@/audio/sfx';
import { StoreProvider, useStore } from '@/state/store';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Gate() {
  const { ready, settings } = useStore();
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });

  useEffect(() => {
    setMuted(settings.muted === '1');
  }, [settings.muted]);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsLoaded]);

  if (!ready || !fontsLoaded) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="game" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initAudio();
    startAds();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <Gate />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
