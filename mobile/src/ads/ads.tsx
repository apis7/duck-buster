import { useState } from 'react';
import { View } from 'react-native';
import mobileAds, {
  AdEventType,
  AdsConsent,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from 'react-native-google-mobile-ads';

import { C } from '@/ui/theme';

/**
 * Ads are the app's only network traffic, and they only show where the user is
 * done with something: a banner on the screens you browse (Bragging Board,
 * Duck-dex), and a full-screen ad after a hunt is saved — when the phone is about
 * to go back in a pocket. Never during logging, never during the game.
 *
 * Content is capped at PG with child-directed treatment off: family-safe
 * without marking the app as made for kids. Blocking sensitive categories
 * (dating, gambling, sexual content…) is done in the AdMob console.
 */

// Real Apsinthion unit ids go here before release. Until then, Google's test ads.
const REAL = {
  banner: '',
  interstitial: '',
};

const unit = {
  banner: !__DEV__ && REAL.banner ? REAL.banner : TestIds.ADAPTIVE_BANNER,
  interstitial: !__DEV__ && REAL.interstitial ? REAL.interstitial : TestIds.INTERSTITIAL,
};

/** At most one full-screen ad per this many ms. */
const INTERSTITIAL_GAP = 3 * 60_000;

let started = false;
let interstitial: InterstitialAd | null = null;
let loaded = false;
let lastShown = 0;

export async function startAds(): Promise<void> {
  if (started) return;
  started = true;
  try {
    // EU/UK consent form when required; a no-op elsewhere.
    await AdsConsent.gatherConsent().catch(() => {});
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    loadInterstitial();
  } catch (e) {
    console.warn('Ads failed to start', e);
  }
}

function loadInterstitial() {
  loaded = false;
  interstitial = InterstitialAd.createForAdRequest(unit.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    loaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => loadInterstitial());
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    loaded = false;
    setTimeout(loadInterstitial, 60_000);
  });
  interstitial.load();
}

/** Show a full-screen ad if one is ready and it's been a while. Call only at "done" moments. */
export function maybeShowInterstitial(): void {
  if (!interstitial || !loaded || Date.now() - lastShown < INTERSTITIAL_GAP) return;
  lastShown = Date.now();
  interstitial.show().catch(() => {});
}

export function AdBanner() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <View style={{ alignItems: 'center', backgroundColor: C.paper }}>
      <BannerAd unitId={unit.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} onAdFailedToLoad={() => setFailed(true)} />
    </View>
  );
}
