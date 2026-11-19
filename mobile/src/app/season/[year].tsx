import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { seasonWindow } from '@/domain/archive';
import { seasonAwards } from '@/domain/awards';
import { BADGE_BY_ID } from '@/domain/badges';
import { gameLeaders } from '@/domain/gameStats';
import { HONORS, seasonHonors } from '@/domain/honors';
import { formatMeat } from '@/domain/meat';
import { seasonLabel } from '@/domain/season';
import { hunterStats, partyStats } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Body, Btn, Card, Dot, Pixel, Section } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C, MEDALS } from '@/ui/theme';

/** One season, as it ended: final board, parties, duck shoot, awards and the badges earned. */
export default function SeasonArchive() {
  const { year } = useLocalSearchParams<{ year: string }>();
  const season = Number(year);
  const { data, celebratedAt } = useStore();
  const scope = { season };
  const names = new Map(data.hunters.map((h) => [h.id, h]));

  const board = data.hunters
    .map((h) => ({ h, s: hunterStats(data, h.id, scope) }))
    .filter((r) => r.s.hunts > 0)
    .sort((a, b) => b.s.birds - a.s.birds);
  const parties = data.parties
    .map((p) => ({ p, s: partyStats(data, p.id, scope) }))
    .filter((r) => r.s.hunts > 0)
    .sort((a, b) => b.s.birds - a.s.birds);
  const leaders = gameLeaders(data, scope);
  const awards = seasonAwards(data, season);
  const honors = seasonHonors(data, season);
  const { start, end } = seasonWindow(season);
  const badges = celebratedAt.filter((c) => c.at >= start && c.at < end && BADGE_BY_ID[c.badgeId]);

  return (
    <SubScreen title={`${seasonLabel(season)} SEASON`}>
      <Body muted>Archived. This is how the season ended.</Body>

      {honors.length ? (
        <Section title="Season titles">
          <Card style={{ gap: 10, borderColor: C.gold }}>
            {honors.map((h) => (
              <View key={h.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 26 }}>{HONORS[h.id].icon}</Text>
                <View style={{ flex: 1 }}>
                  <Pixel size={9} style={{ lineHeight: 15 }}>{HONORS[h.id].title.toUpperCase()}</Pixel>
                  <Body style={{ fontSize: 13 }}>{h.hunterIds.map((id) => names.get(id)?.name ?? '?').join(' & ')}</Body>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Final board">
        <Card style={{ gap: 8 }}>
          {board.length === 0 ? <Body muted>No hunts this season.</Body> : null}
          {board.map((r, i) => (
            <View key={r.h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pixel size={11} color={MEDALS[i] ?? C.muted} style={{ width: 24 }}>{`${i + 1}`}</Pixel>
              <Dot color={r.h.color} />
              <Body style={{ flex: 1, fontWeight: '800' }}>{r.h.name}</Body>
              <Body muted style={{ fontSize: 12 }}>{`${r.s.hunts} hunts · ${formatMeat(r.s.meatOz)}`}</Body>
              <Pixel size={11}>{`${r.s.birds}`}</Pixel>
            </View>
          ))}
        </Card>
      </Section>

      {parties.length ? (
        <Section title="Parties">
          <Card style={{ gap: 8 }}>
            {parties.map((r, i) => (
              <View key={r.p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pixel size={11} color={MEDALS[i] ?? C.muted} style={{ width: 24 }}>{`${i + 1}`}</Pixel>
                <Dot color={r.p.color} />
                <Body style={{ flex: 1, fontWeight: '800' }}>{r.p.name}</Body>
                <Pixel size={11}>{`${r.s.birds}`}</Pixel>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {leaders.length ? (
        <Section title="Duck shoot">
          <Card style={{ gap: 8 }}>
            {leaders.map((l) => (
              <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>{l.icon}</Text>
                <Body style={{ flex: 1 }}>{l.label}</Body>
                <Body style={{ fontWeight: '800' }}>{`${names.get(l.hunterId)?.name ?? '?'} · ${l.value}`}</Body>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {awards.length ? (
        <Section title="Awards">
          <Card style={{ gap: 10 }}>
            {awards.map((a) => (
              <View key={a.award.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 24 }}>{a.award.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Pixel size={9} color={a.award.roast ? C.orange : C.navy}>{a.award.title.toUpperCase()}</Pixel>
                  <Body style={{ fontSize: 13 }}>{`${a.winners.map((w) => names.get(w)?.name ?? '?').join(' & ')} — ${a.text}`}</Body>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {badges.length ? (
        <Section title={`Badges earned (${badges.length})`}>
          <Card style={{ gap: 6 }}>
            {badges.map((b) => (
              <Body key={`${b.hunterId}-${b.badgeId}`}>{`${BADGE_BY_ID[b.badgeId].icon} ${BADGE_BY_ID[b.badgeId].name} — ${names.get(b.hunterId)?.name ?? '?'}`}</Body>
            ))}
          </Card>
        </Section>
      ) : null}

      <Btn label="🎁 SEASON WRAPPED" kind="secondary" onPress={() => router.push({ pathname: '/wrapped', params: { season: String(season) } })} />
      <Btn label="🏆 AWARDS NIGHT" kind="secondary" onPress={() => router.push({ pathname: '/awards', params: { season: String(season) } })} />
    </SubScreen>
  );
}
