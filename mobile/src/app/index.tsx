import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { IntroFlow } from '@/game/IntroFlow';

/** Every launch opens on the mini-game; tap the duck seven times to skip it. */
export default function Intro() {
  return (
    <>
      <StatusBar style="light" />
      <IntroFlow onDone={() => router.replace('/(tabs)')} />
    </>
  );
}
