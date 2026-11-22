import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { hasPastSeasons, seasonBadges } from '@/domain/archive';
import { BADGE_BY_ID } from '@/domain/badges';
import { speciesLeads, withLeads } from '@/domain/leads';
import { currentSeason, seasonLabel } from '@/domain/season';
import { groupRivalry } from '@/domain/rivalry';
import { partyMembers } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Body, Card, Chip, Explainer, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';
import { count } from '@/domain/plural';

/** Tale of the tape between two hunters. */
export default function Rivalry() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { data, titleOf, celebratedAt } = useStore();
  const [parties, setParties] = useState(params.mode === 'parties');
  // Either side is a hunter or a party; both use the same tale of the tape.
  const sides = parties
    ? data.parties.map((p) => ({ id: p.id, name: p.name, color: p.color, members: partyMembers(data, p.id), sub: `${count(partyMembers(data, p.id).length, 'hunter')}` }))
    : data.hunters.map((h) => ({ id: h.id, name: h.name, color: h.color, members: [h.id], sub: titleOf(h.id).name }));
  const [aId, setA] = useState<string | undefined>(undefined);
  const [bId, setB] = useState<string | undefined>(undefined);
  const a = sides.some((x) => x.id === aId) ? aId : sides[0]?.id;
  const b = sides.some((x) => x.id === bId) && bId !== a ? bId : sides.find((x) => x.id !== a)?.id;
  const [allTimePicked, setAllTime] = useState(false);
  const history = hasPastSeasons(data);
  const allTime = history && allTimePicked;
  const ha = sides.find((h) => h.id === a);
  const hb = sides.find((h) => h.id === b);
  const season = currentSeason();

  const picker = (value: string | undefined, set: (id: string) => void, other: string | undefined) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {sides.filter((h) => h.id !== other).map((h) => (
        <Chip key={h.id} label={h.name} color={h.color} on={value === h.id} onPress={() => set(h.id)} />
      ))}
    </ScrollView>
  );

  const badges = useMemo(() => {
    const known = celebratedAt.filter((c) => BADGE_BY_ID[c.badgeId]);
    const leads = speciesLeads(data, allTime ? {} : { season });
    if (!allTime) return withLeads(seasonBadges(known, season), leads);
    const all = new Map<string, string[]>();
    for (const c of known) all.set(c.hunterId, [...(all.get(c.hunterId) ?? []), c.badgeId]);
    return withLeads(all, leads);
  }, [celebratedAt, season, allTime, data]);
  const r = ha && hb ? groupRivalry(data, ha.members, hb.members, allTime ? {} : { season }, badges) : null;
  const aScore = r ? r.rows.filter((x) => (x.lowerWins ? x.a < x.b : x.a > x.b)).length : 0;
  const bScore = r ? r.rows.filter((x) => (x.lowerWins ? x.b < x.a : x.b > x.a)).length : 0;

  return (
    <SubScreen title={parties ? 'PARTY RIVALRY' : 'RIVALRY'}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="HUNTERS" on={!parties} onPress={() => setParties(false)} />
        <Chip label="PARTIES" on={parties} onPress={() => setParties(true)} />
      </View>
      <Explainer>
        {ha && hb
          ? `Comparing ${ha.name} vs ${hb.name}, ${allTime ? 'all time' : `${seasonLabel(season)} season`}. Tap a name in the top row to change the left side, the bottom row for the right side.`
          : parties
            ? 'Make at least two parties to compare them.'
            : 'Add at least two hunters to compare them.'}
      </Explainer>
      {picker(a, setA, b)}
      <Pixel size={12} style={{ textAlign: 'center' }}>VS</Pixel>
      {picker(b, setB, a)}
      {history ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={seasonLabel(season)} on={!allTime} onPress={() => setAllTime(false)} />
          <Chip label="ALL TIME" on={allTime} onPress={() => setAllTime(true)} />
        </View>
      ) : null}

      {r && ha && hb ? (
        <Card style={{ gap: 12, backgroundColor: C.navyDark }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Pixel size={12} color={ha.color}>{ha.name.toUpperCase()}</Pixel>
              <Pixel size={7} color={C.navySoft}>{ha.sub.toUpperCase()}</Pixel>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Pixel size={12} color={hb.color}>{hb.name.toUpperCase()}</Pixel>
              <Pixel size={7} color={C.navySoft}>{hb.sub.toUpperCase()}</Pixel>
            </View>
          </View>
          {r.rows.map((row) => {
            const aWin = row.lowerWins ? row.a < row.b : row.a > row.b;
            const bWin = row.lowerWins ? row.b < row.a : row.b > row.a;
            return (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pixel size={14} color={aWin ? C.gold : C.white} style={{ width: 70 }}>{`${row.a}`}</Pixel>
                <Pixel size={8} color={C.navySoft} style={{ flex: 1, textAlign: 'center' }}>{row.label.toUpperCase()}</Pixel>
                <Pixel size={14} color={bWin ? C.gold : C.white} style={{ width: 70, textAlign: 'right' }}>{`${row.b}`}</Pixel>
              </View>
            );
          })}
          <View style={{ borderTopWidth: 2, borderColor: C.navy, paddingTop: 12, alignItems: 'center', gap: 6 }}>
            <Pixel size={10} color={C.orange}>
              {aScore === bScore ? 'DEAD EVEN' : `${(aScore > bScore ? ha : hb).name.toUpperCase()} WINS THE TAPE ${Math.max(aScore, bScore)}-${Math.min(aScore, bScore)}`}
            </Pixel>
            {r.together > 0 ? (
              <Body style={{ color: C.navySoft, textAlign: 'center', fontSize: 13 }}>
                {`Hunted together ${r.together}×. ${ha.name} outshot ${hb.name} ${r.aWins}×, ${hb.name} won ${r.bWins}×${r.ties ? `, ${count(r.ties, 'tie')}` : ''}.`}
              </Body>
            ) : (
              <Body style={{ color: C.navySoft, fontSize: 13 }}>Never in the same blind. Settle it.</Body>
            )}
          </View>
        </Card>
      ) : (
        <Body muted>{parties ? 'Make at least two parties (More › Hunters › Parties).' : 'Add at least two hunters.'}</Body>
      )}
    </SubScreen>
  );
}
