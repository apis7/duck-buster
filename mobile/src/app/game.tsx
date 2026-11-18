import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { maybeShowInterstitial } from '@/ads/ads';
import { IntroFlow } from '@/game/IntroFlow';

/** Replay from the More tab. Leaving a replayed round is a natural put-the-phone-down moment. */
export default function Game() {
  return (
    <>
      <StatusBar style="light" />
      <IntroFlow
        onDone={() => {
          router.back();
          maybeShowInterstitial();
        }}
      />
    </>
  );
}
