import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { newlyArchived, shouldRemindBackup } from '@/domain/archive';
import { currentSeason, prettyDate, seasonLabel, seasonOf, shiftDate, todayISO } from '@/domain/season';
import { huntWinner } from '@/domain/winner';
import { SPECIES_BY_ID } from '@/domain/species';
import { useStore } from '@/state/store';
import { Body, Btn, Card, Dot, Pixel, Screen, Section } from '@/ui/kit';
import { useDialog } from '@/ui/Dialog';
import { HunterSetup } from '@/ui/HunterSetup';
import { C } from '@/ui/theme';

export default function Hunts() {
  const { data, settings, setSetting } = useStore();
  const ask = useDialog();
  const season = currentSeason();

  // July 1: last season goes in the books. Say so once, with a nudge to back up.
  useEffect(() => {
    const done = newlyArchived(data, settings.archiveSeen ? Number(settings.archiveSeen) : null);
    if (done == null) return;
    setSetting('archiveSeen', String(done));
    ask({
      icon: '🗄️',
      title: `${seasonLabel(done)} is in the books`,
      message: 'The season is archived — final board, awards, badges and duck-shoot scores are saved under Past seasons. Good time to save a backup too.',
      buttons: [
        { label: 'See the final board', value: 'view', kind: 'primary' },
        { label: 'Save a backup', value: 'backup' },
        { label: 'Later', value: 'later' },
      ],
    }).then((v) => {
      if (v === 'view') router.push({ pathname: '/season/[year]', params: { year: String(done) } });
      if (v === 'backup') router.navigate('/more');
    });
    // Once per load is plenty; the setting stops it repeating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.hunts.length]);

  const hunts = useMemo(
    () => [...data.hunts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [data.hunts],
  );
  const seasonHunts = hunts.filter((h) => seasonOf(h.date) === season);
  const seasonIds = new Set(seasonHunts.map((h) => h.id));
  const seasonBirds = data.harvests.filter((r) => seasonIds.has(r.huntId)).reduce((n, r) => n + r.count, 0);
  const hunterById = new Map(data.hunters.map((h) => [h.id, h]));

  if (data.hunters.length === 0) {
    return (
      <Screen title="DUCK BUSTER">
        <HunterSetup firstRun onDone={() => {}} />
      </Screen>
    );
  }

  // One hunt per day: if today's is already logged, the button opens it.
  const today = todayISO();
  const firstFreeDayBefore = (d: string) => {
    let x = shiftDate(d, -1);
    while (data.hunts.some((h) => h.date === x)) x = shiftDate(x, -1);
    return x;
  };
  const todays = data.hunts.find((h) => h.date === today);
  // Today's winner hasn't played their round yet (it expires at midnight).
  const winner = todays ? huntWinner(data, todays.id) : null;
  const roundWaiting = !!winner && !data.gameScores.some((g) => g.huntId === todays?.id);
  const winnerName = winner ? data.hunters.find((h) => h.id === winner.hunterId)?.name : '';
  const remindBackup = shouldRemindBackup(data, settings.lastBackupAt ? Number(settings.lastBackupAt) : null);

  return (
    <Screen
      title="DUCK BUSTER"
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pixel size={9} color={C.muted}>{seasonLabel(season)}</Pixel>
          <Pressable onPress={() => router.navigate('/more')} hitSlop={12} accessibilityLabel="Settings">
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </Pressable>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Pixel size={22}>{`${seasonBirds}`}</Pixel>
          <Pixel size={8} color={C.muted}>BIRDS</Pixel>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Pixel size={22}>{`${seasonHunts.length}`}</Pixel>
          <Pixel size={8} color={C.muted}>HUNTS</Pixel>
        </Card>
      </View>

      {roundWaiting && todays ? (
        <Pressable onPress={() => router.push({ pathname: '/round', params: { huntId: todays.id } })} style={styles.round}>
          <Text style={{ fontSize: 30 }}>🎮</Text>
          <View style={{ flex: 1 }}>
            <Pixel size={10} color={C.white}>{`${(winnerName ?? '').toUpperCase()}'S ROUND IS WAITING`}</Pixel>
            <Text style={{ color: C.navySoft, fontSize: 13 }}>Today's winner plays one round. Gone at midnight.</Text>
          </View>
          <Pixel size={12} color={C.gold}>{'›'}</Pixel>
        </Pressable>
      ) : null}

      {remindBackup ? (
        <Pressable onPress={() => router.navigate('/more')} style={styles.backup}>
          <Text style={{ fontSize: 24 }}>💾</Text>
          <View style={{ flex: 1 }}>
            <Pixel size={9}>SEASON WINDING DOWN?</Pixel>
            <Text style={{ color: C.ink, fontSize: 13 }}>Save a backup of everything. More › Backup.</Text>
          </View>
        </Pressable>
      ) : null}

      <Btn
        label={todays ? "OPEN TODAY'S HUNT" : '+ LOG A HUNT'}
        onPress={() => router.push(todays ? { pathname: '/hunt', params: { id: todays.id } } : '/hunt')}
      />
      {todays ? (
        // Today's done; this is for the hunt someone forgot to log.
        <Btn label="+ LOG AN EARLIER DAY" kind="secondary" small onPress={() => router.push({ pathname: '/hunt', params: { date: firstFreeDayBefore(today) } })} />
      ) : null}

      <Section title="Recent hunts">
        {hunts.length === 0 ? <Body muted>No hunts yet. Go get some!</Body> : null}
        {hunts.slice(0, 40).map((h) => {
          const rows = data.harvests.filter((r) => r.huntId === h.id);
          const birds = rows.reduce((n, r) => n + r.count, 0);
          const bands = rows.reduce((n, r) => n + r.banded, 0);
          const species = Array.from(new Set(rows.map((r) => r.speciesId)));
          const party = data.huntHunters.filter((p) => p.huntId === h.id).map((p) => hunterById.get(p.hunterId)).filter(Boolean);
          return (
            <Card key={h.id} onPress={() => router.push({ pathname: '/hunt', params: { id: h.id } })} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pixel size={10}>{prettyDate(h.date).toUpperCase()}</Pixel>
                <Pixel size={10} color={birds ? C.orange : C.muted}>
                  {birds ? `${birds} ${birds === 1 ? 'BIRD' : 'BIRDS'}${bands ? ` · ${bands}💍` : ''}` : 'SKUNKED 🦨'}
                </Pixel>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {party.map((p) => (
                  <View key={p!.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Dot color={p!.color} size={10} />
                    <Body style={{ fontSize: 13 }}>{p!.name}</Body>
                  </View>
                ))}
              </View>
              {species.length ? (
                <Body muted style={{ fontSize: 13 }}>
                  {species.map((s) => SPECIES_BY_ID[s]?.name ?? s).join(', ')}
                </Body>
              ) : null}
            </Card>
          );
        })}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.navy, borderWidth: 2.5, borderColor: C.gold, borderBottomWidth: 5, borderRightWidth: 5, padding: 12 },
  backup: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.orangeSoft, borderWidth: 2, borderColor: C.orange, padding: 12 },
});
