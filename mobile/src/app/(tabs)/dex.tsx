import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AdBanner } from '@/ads/ads';
import { speciesLeader } from '@/domain/leads';
import { currentSeason, prettyDate, seasonLabel } from '@/domain/season';
import { GROUP_LABEL, SPECIES, SPECIES_BY_ID, type Species } from '@/domain/species';
import { bandTrophies, dexEntries, type DexEntry } from '@/domain/stats';
import { useStore } from '@/state/store';
import { Bar, Body, Btn, Chip, Pixel, Screen } from '@/ui/kit';
import { PixelBird } from '@/ui/PixelBird';
import { C } from '@/ui/theme';

const RARITY_BORDER = { common: C.navy, uncommon: C.silver, rare: C.gold };

export default function Dex() {
  const { data } = useStore();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'dex' | 'bands'>('dex');
  const [open, setOpen] = useState<Species | null>(null);
  const entries = useMemo(() => dexEntries(data), [data]);
  const bands = useMemo(() => bandTrophies(data), [data]);
  const names = new Map(data.hunters.map((h) => [h.id, h]));
  // About 120 dp per card: 3 across on a small phone, more on big phones and tablets.
  const cols = Math.max(3, Math.floor((width - 32) / 120));
  const cardW = (width - 32 - 8 * (cols - 1)) / cols;

  return (
    <View style={{ flex: 1 }}>
      <Screen title="DUCK-DEX">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={`COLLECTION ${entries.size}/${SPECIES.length}`} on={tab === 'dex'} onPress={() => setTab('dex')} />
          <Chip label={`BANDS ${bands.length}`} on={tab === 'bands'} onPress={() => setTab('bands')} />
        </View>

        {tab === 'dex' ? (
          <>
            <Bar value={entries.size} max={SPECIES.length} color={C.orange} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SPECIES.map((s, i) => {
                const found = entries.has(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setOpen(s)}
                    style={[styles.card, { width: cardW, borderColor: found ? RARITY_BORDER[s.rarity] : C.locked, backgroundColor: found ? C.white : '#EFEBE1' }, found && s.rarity === 'rare' && styles.shiny]}
                  >
                    <Text style={styles.num}>{`#${String(i + 1).padStart(2, '0')}`}</Text>
                    <PixelBird species={s} size={cardW - 24} locked={!found} />
                    <Text numberOfLines={2} style={[styles.name, !found && { color: C.muted }]}>{found ? s.name : '???'}</Text>
                    {found && s.rarity !== 'common' ? <Text style={styles.rarity}>{s.rarity === 'rare' ? '★ RARE' : '☆ UNCOMMON'}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ gap: 10 }}>
            {bands.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 20, gap: 8 }}>
                <Text style={{ fontSize: 48 }}>💍</Text>
                <Pixel size={10} style={{ textAlign: 'center' }}>THE TROPHY CASE IS EMPTY</Pixel>
                <Body muted style={{ textAlign: 'center' }}>Shoot a banded bird and it lands here. Tap 💍 when you log it.</Body>
              </View>
            ) : null}
            {bands.map((b) => {
              const h = names.get(b.harvest.hunterId);
              return (
                <View key={b.key} style={styles.band}>
                  <View style={styles.ring}>
                    <Pixel size={8} color={C.navyDark}>USGS</Pixel>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Pixel size={10}>{(SPECIES_BY_ID[b.harvest.speciesId]?.name ?? '').toUpperCase()}</Pixel>
                    <Body style={{ fontSize: 13 }}>{`${h?.name ?? '?'} · ${b.date ? prettyDate(b.date) : ''}`}</Body>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Screen>
      <AdBanner />

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          {open ? <Detail s={open} entry={entries.get(open.id)} hunters={names} onClose={() => setOpen(null)} /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function Detail({ s, entry, hunters, onClose }: { s: Species; entry?: DexEntry; hunters: Map<string, { name: string }>; onClose: () => void }) {
  const { data } = useStore();
  const found = !!entry;
  const season = currentSeason();
  const leaderLine = (label: string, l: ReturnType<typeof speciesLeader>) =>
    l ? `${label}: ${l.hunterIds.map((id) => hunters.get(id)?.name ?? '?').join(' & ')}${l.hunterIds.length > 1 ? ' (tied)' : ''} · ${l.count}` : null;
  const seasonLead = leaderLine(seasonLabel(season), speciesLeader(data, s.id, { season }));
  const allTimeLead = leaderLine('All time', speciesLeader(data, s.id));
  return (
    <View style={[styles.detail, { borderColor: found ? RARITY_BORDER[s.rarity] : C.navy }]}>
      <PixelBird species={s} size={160} locked={!found} />
      <Pixel size={13} style={{ textAlign: 'center' }}>{found ? s.name.toUpperCase() : '??? NOT FOUND YET'}</Pixel>
      <Pixel size={8} color={C.muted}>{GROUP_LABEL[s.group].toUpperCase()}</Pixel>
      {found ? (
        <>
          <Body style={{ textAlign: 'center' }}>
            {`${entry!.count} logged · first on ${prettyDate(entry!.first)}`}
          </Body>
          <Body muted style={{ textAlign: 'center' }}>
            {`By ${Array.from(entry!.hunters).map((id) => hunters.get(id)?.name ?? '?').join(', ')}`}
          </Body>
          <View style={{ alignSelf: 'stretch', borderWidth: 2, borderColor: C.gold, padding: 8, gap: 2, alignItems: 'center' }}>
            <Pixel size={8} color={C.orange}>🏆 LEADER</Pixel>
            {[seasonLead, allTimeLead].filter(Boolean).map((line) => (
              <Body key={line} style={{ textAlign: 'center', fontSize: 14 }}>{line}</Body>
            ))}
            {!seasonLead ? <Body muted style={{ textAlign: 'center', fontSize: 12 }}>{`None bagged in ${seasonLabel(season)} yet.`}</Body> : null}
          </View>
          {s.aliases.length ? (
            <Body muted style={{ textAlign: 'center', fontSize: 13 }}>{`aka ${s.aliases.slice(0, 4).join(', ')}`}</Body>
          ) : null}
        </>
      ) : (
        <Body muted style={{ textAlign: 'center' }}>Log one to reveal this card.</Body>
      )}
      <Btn label="CLOSE" kind="secondary" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2.5, padding: 6, alignItems: 'center', gap: 4, minHeight: 130 },
  shiny: { borderBottomWidth: 5, borderRightWidth: 5, backgroundColor: '#FFF8DC' },
  num: { alignSelf: 'flex-start', fontSize: 10, color: C.muted, fontWeight: '700' },
  name: { fontSize: 12, fontWeight: '800', color: C.navy, textAlign: 'center' },
  rarity: { fontSize: 9, fontWeight: '800', color: '#A8841A' },
  band: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 2.5, borderColor: C.navy, borderBottomWidth: 5, borderRightWidth: 5, padding: 12 },
  ring: { width: 64, height: 28, backgroundColor: '#D9DEE5', borderWidth: 2, borderColor: '#8A929C', alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,61,0.8)', justifyContent: 'center', padding: 24 },
  detail: { backgroundColor: C.white, borderWidth: 3, borderBottomWidth: 7, borderRightWidth: 7, padding: 20, alignItems: 'center', gap: 8 },
});
