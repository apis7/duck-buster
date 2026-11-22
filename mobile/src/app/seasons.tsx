import { router } from 'expo-router';
import { View } from 'react-native';

import { archivedSeasons } from '@/domain/archive';
import { seasonLabel } from '@/domain/season';
import { hunterStats } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Body, Card, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';
import { count } from '@/domain/plural';

/** Every finished season, newest first. Each opens its frozen final board. */
export default function Seasons() {
  const { data } = useStore();
  const seasons = archivedSeasons(data);

  return (
    <SubScreen title="PAST SEASONS">
      <Body muted>Seasons run July 1 to June 30. Each one is archived on July 1 — its board, awards, badges and duck-shoot scores stay here for good.</Body>
      {seasons.length === 0 ? <Body muted>No finished seasons yet. This one goes in the books on July 1.</Body> : null}
      {seasons.map((s) => {
        const ranked = data.hunters
          .map((h) => ({ h, birds: hunterStats(data, h.id, { season: s }).birds }))
          .filter((r) => r.birds > 0)
          .sort((a, b) => b.birds - a.birds);
        const total = ranked.reduce((n, r) => n + r.birds, 0);
        const hunts = data.hunts.filter((h) => h.date >= `${s}-07-01` && h.date < `${s + 1}-07-01`).length;
        return (
          <Card key={s} onPress={() => router.push({ pathname: '/season/[year]', params: { year: String(s) } })} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pixel size={13}>{seasonLabel(s)}</Pixel>
              <Pixel size={10} color={C.muted}>{'>'}</Pixel>
            </View>
            <Body muted style={{ fontSize: 13 }}>{`${count(hunts, 'hunt')} · ${count(total, 'bird')}`}</Body>
            {ranked[0] ? <Body>{`🏆 ${ranked[0].h.name} led with ${ranked[0].birds}`}</Body> : null}
          </Card>
        );
      })}
    </SubScreen>
  );
}
