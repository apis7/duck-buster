import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { currentSeason, seasonLabel } from '@/domain/season';
import { groupRivalry } from '@/domain/rivalry';
import { partyMembers } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Body, Card, Chip, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** Tale of the tape between two hunters. */
export default function Rivalry() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { data, titleOf } = useStore();
  const [parties, setParties] = useState(params.mode === 'parties');
  // Either side is a hunter or a party; both use the same tale of the tape.
  const sides = parties
    ? data.parties.map((p) => ({ id: p.id, name: p.name, color: p.color, members: partyMembers(data, p.id), sub: `${partyMembers(data, p.id).length} hunters` }))
    : data.hunters.map((h) => ({ id: h.id, name: h.name, color: h.color, members: [h.id], sub: titleOf(h.id).name }));
  const [aId, setA] = useState<string | undefined>(undefined);
  const [bId, setB] = useState<string | undefined>(undefined);
  const a = sides.some((x) => x.id === aId) ? aId : sides[0]?.id;
  const b = sides.some((x) => x.id === bId) && bId !== a ? bId : sides.find((x) => x.id !== a)?.id;
  const [allTime, setAllTime] = useState(false);
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

  const r = ha && hb ? groupRivalry(data, ha.members, hb.members, allTime ? {} : { season }) : null;
  const aScore = r ? r.rows.filter((x) => (x.lowerWins ? x.a < x.b : x.a > x.b)).length : 0;
  const bScore = r ? r.rows.filter((x) => (x.lowerWins ? x.b < x.a : x.b > x.a)).length : 0;

  return (
    <SubScreen title={parties ? 'PARTY RIVALRY' : 'RIVALRY'}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="HUNTERS" on={!parties} onPress={() => setParties(false)} />
        <Chip label="PARTIES" on={parties} onPress={() => setParties(true)} />
      </View>
      {picker(a, setA, b)}
      <Pixel size={12} style={{ textAlign: 'center' }}>VS</Pixel>
      {picker(b, setB, a)}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label={seasonLabel(season)} on={!allTime} onPress={() => setAllTime(false)} />
        <Chip label="ALL TIME" on={allTime} onPress={() => setAllTime(true)} />
      </View>

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
                {`Hunted together ${r.together}×. ${ha.name} outshot ${hb.name} ${r.aWins}×, ${hb.name} won ${r.bWins}×${r.ties ? `, ${r.ties} ties` : ''}.`}
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
