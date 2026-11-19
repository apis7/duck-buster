import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { exportSlugCard, pickSlugCard } from '@/db/backup';
import { currentSeason, prettyDate, seasonLabel, seasonOf } from '@/domain/season';
import { boardStatus, buildCard, combinedBoard, slugfestTitles, type SlugfestCard } from '@/domain/slugfest';
import { useStore } from '@/state/store';
import { useDialog } from '@/ui/Dialog';
import { Body, Btn, Card, Chip, Explainer, Pixel, Section } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C, MEDALS } from '@/ui/theme';

/**
 * Duck Season Slugfest: pick a season, add other crews' season cards (QR or file),
 * tick the ones to compare, and see every hunter from every crew on one board.
 */
export default function Slugfest() {
  const { data, crew, setSetting, addSlugCard, removeSlugCard } = useStore();
  const ask = useDialog();
  const boardRef = useRef<ComponentRef<typeof View>>(null);
  const [nameDraft, setNameDraft] = useState(crew.name);
  const [editingName, setEditingName] = useState(!crew.name);

  // Seasons with anything to show: ours, plus any we've received.
  const seasons = useMemo(() => {
    const s = new Set<number>([currentSeason()]);
    for (const h of data.hunts) s.add(seasonOf(h.date));
    for (const c of data.slugfest) s.add(c.season);
    return Array.from(s).sort((a, b) => b - a);
  }, [data.hunts, data.slugfest]);
  const defaultSeason = data.hunts.some((h) => seasonOf(h.date) === currentSeason()) ? currentSeason() : seasons.find((s) => data.hunts.some((h) => seasonOf(h.date) === s)) ?? currentSeason();
  const [season, setSeason] = useState(defaultSeason);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());

  const mine = crew.name ? buildCard(data, season, crew.id, crew.name) : null;
  const others = data.slugfest.filter((c) => c.season === season);
  const compared: SlugfestCard[] = [...(mine && mine.hunters.length ? [mine] : []), ...others.filter((c) => !unticked.has(c.crewId))];
  const board = combinedBoard(compared);
  const titles = slugfestTitles(board);
  const status = boardStatus(compared);

  async function saveName() {
    const n = nameDraft.trim();
    if (!n) return;
    await setSetting('crewName', n);
    setEditingName(false);
  }

  async function fail(e: unknown) {
    await ask({ icon: '⚠️', title: 'That didn’t work', message: e instanceof Error ? e.message : String(e), buttons: [{ label: 'OK', value: 'ok' }] });
  }

  async function addFromFile() {
    try {
      const card = await pickSlugCard();
      if (!card) return;
      if (card.crewId === crew.id) throw new Error('That’s your own season card.');
      await addSlugCard(card);
      setSeason(card.season);
      await ask({ icon: '🥊', title: `${card.crewName} is in`, message: `${seasonLabel(card.season)} · ${card.hunters.length} hunters · ${card.final ? 'final' : `as of ${prettyDate(card.asOf)}`}`, buttons: [{ label: 'Bring it', value: 'ok' }] });
    } catch (e) {
      await fail(e);
    }
  }

  async function sendFile() {
    if (!mine) return;
    try {
      await exportSlugCard(mine);
    } catch (e) {
      await fail(e);
    }
  }

  async function remove(c: SlugfestCard) {
    const yes = await ask({
      icon: '🗑️',
      title: `Remove ${c.crewName}?`,
      message: `Their ${seasonLabel(c.season)} season card comes off this phone. Your own data isn’t touched.`,
      buttons: [
        { label: 'Remove', value: 'yes', kind: 'danger' },
        { label: 'Keep', value: 'no' },
      ],
    });
    if (yes === 'yes') await removeSlugCard(c.crewId, c.season);
  }

  async function shareImage() {
    try {
      const uri = await captureRef(boardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share the Slugfest scoreboard' });
    } catch (e) {
      await fail(e);
    }
  }

  const toggle = (crewId: string) =>
    setUnticked((u) => {
      const n = new Set(u);
      if (n.has(crewId)) n.delete(crewId);
      else n.add(crewId);
      return n;
    });

  const headline = status.final ? 'FINAL SEASON RANKINGS' : `SEASON UPDATE: AS OF ${status.asOf ? prettyDate(status.asOf).toUpperCase() : ''}`;

  return (
    <SubScreen title="DUCK SEASON SLUGFEST">
      {/* Crew name: required, and it's how everyone else sees you. */}
      {editingName ? (
        <Card style={{ gap: 10, borderColor: C.orange }}>
          <Pixel size={10}>YOUR CREW'S NAME</Pixel>
          <Body muted style={{ fontSize: 13 }}>Every crew needs a name, so two "Dad"s don't get mixed up. E.g. "Johnson Blind".</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={nameDraft} onChangeText={setNameDraft} placeholder="Crew name" onSubmitEditing={saveName} style={styles.input} autoFocus />
            <Btn label="SAVE" small onPress={saveName} disabled={!nameDraft.trim()} />
          </View>
        </Card>
      ) : (
        <Pressable onPress={() => setEditingName(true)} style={styles.crewRow}>
          <Pixel size={9} color={C.muted}>YOUR CREW</Pixel>
          <Pixel size={12} style={{ flex: 1 }}>{crew.name.toUpperCase()}</Pixel>
          <Pixel size={8} color={C.muted}>EDIT</Pixel>
        </Pressable>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {seasons.map((s) => (
          <Chip key={s} label={seasonLabel(s)} on={season === s} onPress={() => setSeason(s)} />
        ))}
      </ScrollView>

      <Explainer>
        {!crew.name
          ? 'First, name your crew.'
          : compared.length < 2
            ? `${seasonLabel(season)}: only ${compared.length ? 'your crew is' : 'nobody is'} in so far. Add another crew's season below (scan their QR or open their file) to compare.`
            : `${seasonLabel(season)}: comparing ${compared.map((c) => c.crewName + (c.crewId === crew.id ? ' (you)' : '')).join(' vs ')} — ${board.length} hunters on one board.` +
              (others.some((c) => unticked.has(c.crewId))
                ? ` Left out: ${others.filter((c) => unticked.has(c.crewId)).map((c) => c.crewName).join(', ')}.`
                : '') +
              ' Tap a crew to add it or leave it out.'}
      </Explainer>

      {mine ? (
        <Section title="Send your season">
          <Card style={{ gap: 10 }}>
            <Body>
              {mine.hunters.length
                ? `${crew.name}: ${mine.hunters.length} hunters, ${mine.hunters.reduce((n, h) => n + h.birds, 0)} birds — ${mine.final ? 'final' : `as of today`}.`
                : `No hunts logged for ${seasonLabel(season)} yet.`}
            </Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label="📤 SHOW MY QR" small onPress={() => router.push({ pathname: '/slugfest-qr', params: { season: String(season) } })} disabled={!mine.hunters.length} style={{ flex: 1 }} />
              <Btn label="💾 SEND FILE" small kind="secondary" onPress={sendFile} disabled={!mine.hunters.length} style={{ flex: 1 }} />
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="Other crews">
        <Card style={{ gap: 10 }}>
          {others.length === 0 ? <Body muted>No crews added for {seasonLabel(season)} yet.</Body> : null}
          {others.map((c) => {
            const on = !unticked.has(c.crewId);
            return (
              <View key={c.crewId} style={styles.crewLine}>
                <Pressable onPress={() => toggle(c.crewId)} style={[styles.check, on && { backgroundColor: C.navy }]}>
                  {on ? <Text style={{ color: C.white, fontWeight: '900' }}>✓</Text> : null}
                </Pressable>
                <Pressable onPress={() => toggle(c.crewId)} style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '800' }}>{c.crewName}</Body>
                  <Body muted style={{ fontSize: 12 }}>
                    {`${c.hunters.length} hunters · ${c.final ? 'FINAL' : `as of ${prettyDate(c.asOf)}`}`}
                  </Body>
                </Pressable>
                <Pressable onPress={() => remove(c)} hitSlop={10}>
                  <Text style={{ fontSize: 20, color: C.muted, fontWeight: '800' }}>×</Text>
                </Pressable>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn label="📥 SCAN QR" small onPress={() => router.push('/slugfest-qr')} style={{ flex: 1 }} disabled={!crew.name} />
            <Btn label="📂 FROM FILE" small kind="secondary" onPress={addFromFile} style={{ flex: 1 }} disabled={!crew.name} />
          </View>
        </Card>
      </Section>

      {board.length && compared.length > 1 ? (
        <>
          {/* Everything inside this view is what the shared image shows. */}
          <View ref={boardRef} collapsable={false} style={styles.board}>
            <Pixel size={8} color={status.final ? C.gold : C.orange} style={{ textAlign: 'center' }}>{headline}</Pixel>
            <Pixel size={13} color={C.white} style={{ textAlign: 'center', lineHeight: 22 }}>{`DUCK SEASON SLUGFEST ${seasonLabel(season)}`}</Pixel>
            <Text style={{ color: C.navySoft, textAlign: 'center', fontSize: 12 }}>{compared.map((c) => c.crewName).join('  vs  ')}</Text>
            <View style={{ gap: 6, marginTop: 6 }}>
              {board.map((r, i) => (
                <View key={`${r.crewId}-${r.name}-${i}`} style={styles.boardRow}>
                  <Pixel size={10} color={MEDALS[i] ?? C.navySoft} style={{ width: 26 }}>{`${i + 1}`}</Pixel>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boardName}>{r.name}</Text>
                    <Text style={styles.boardCrew}>{`${r.crewName}${r.final ? '' : ` · as of ${prettyDate(r.asOf)}`}`}</Text>
                  </View>
                  <Text style={styles.boardStat}>{`${r.birds} birds${r.bands ? ` · ${r.bands}💍` : ''}`}</Text>
                  <Pixel size={11} color={C.white} style={{ width: 54, textAlign: 'right' }}>{`${r.points}`}</Pixel>
                </View>
              ))}
            </View>
            {titles.length ? (
              <View style={{ gap: 6, marginTop: 10, borderTopWidth: 2, borderColor: C.navy, paddingTop: 10 }}>
                {titles.map((t) => (
                  <View key={t.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{t.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Pixel size={7} color={C.gold} style={{ lineHeight: 12 }}>{t.title.toUpperCase()}</Pixel>
                      <Text style={styles.boardCrew}>{t.rows.map((r) => `${r.name} · ${r.crewName}`).join(' & ')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginTop: 8 }}>
              Points: drake 3 · hen 2 · rare bonus · coot 0 · Duck Buster
            </Text>
          </View>
          <Btn label="📸 SHARE SCOREBOARD IMAGE" onPress={shareImage} />
        </>
      ) : (
        <Body muted>Add at least one other crew's season to see the combined scoreboard.</Body>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 2, borderColor: C.navy, padding: 10, fontSize: 16, backgroundColor: C.white, flex: 1 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy, padding: 12 },
  crewLine: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderColor: C.line, paddingBottom: 8 },
  check: { width: 26, height: 26, borderWidth: 2.5, borderColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  board: { backgroundColor: C.navyDark, borderWidth: 3, borderColor: C.gold, padding: 14, gap: 6 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boardName: { color: C.white, fontWeight: '800', fontSize: 15 },
  boardCrew: { color: C.navySoft, fontSize: 11 },
  boardStat: { color: C.navySoft, fontSize: 12 },
});
