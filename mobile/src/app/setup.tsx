import { router } from 'expo-router';

import { HunterSetup } from '@/ui/HunterSetup';
import { SubScreen } from '@/ui/SubScreen';

/** Bulk-add hunters (and parties) any time, from the Hunters screen. */
export default function Setup() {
  return (
    <SubScreen title="ADD HUNTERS">
      <HunterSetup onDone={() => router.back()} />
    </SubScreen>
  );
}
