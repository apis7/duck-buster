import { Text, View } from 'react-native';

import { BADGE_BY_ID } from '@/domain/badges';
import { LEAD_PREFIX, speciesLabel } from '@/domain/leads';
import { useStore } from '@/state/store';

import { Body, Pixel, Section } from './kit';
import { C } from './theme';

/** Each hunter's badges for a season, most first. */
export function SeasonBadges({
  badges, names, dark,
}: { badges: Map<string, string[]>; names: Map<string, { name: string }>; dark?: boolean }) {
  const { data } = useStore();
  // Real badges plus species leads (`lead:<speciesId>`, see domain/leads).
  const show = (id: string) =>
    id.startsWith(LEAD_PREFIX)
      ? { icon: '🏆', name: `Top ${speciesLabel(data, id.slice(LEAD_PREFIX.length))}` }
      : BADGE_BY_ID[id];
  const rows = Array.from(badges.entries())
    .map(([hunterId, ids]) => ({ hunterId, ids: ids.filter((id) => show(id)) }))
    .filter((r) => r.ids.length)
    .sort((a, b) => b.ids.length - a.ids.length);
  const fg = dark ? C.white : C.navy;
  const sub = dark ? C.navySoft : C.muted;
  return (
    <Section title="Badges this season">
      {rows.length === 0 ? <Body style={{ color: sub }}>No badges earned this season.</Body> : null}
      {rows.map((r) => (
        <View
          key={r.hunterId}
          style={{ gap: 6, borderWidth: 2, borderColor: dark ? C.navy : C.navy, backgroundColor: dark ? C.navy : C.white, padding: 10 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pixel size={10} color={fg}>{(names.get(r.hunterId)?.name ?? '?').toUpperCase()}</Pixel>
            <Pixel size={10} color={C.gold}>{`${r.ids.length} 🎖️`}</Pixel>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {r.ids.map((id) => (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 16 }}>{show(id).icon}</Text>
                <Text style={{ fontSize: 12, color: sub }}>{show(id).name}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Section>
  );
}
