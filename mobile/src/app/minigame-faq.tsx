import { Text, View } from 'react-native';

import { CLIP, GAME_SECONDS, KO_FRACTION, RELOAD_SECONDS, SPECIAL } from '@/game/engine';
import { FLOCK_SPECIES } from '@/game/sprites';
import { Body, Card, Pixel } from '@/ui/kit';
import { SubScreen } from '@/ui/SubScreen';
import { C } from '@/ui/theme';

/** Everything about the duck shoot, in one place. Numbers come straight from the engine. */

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 8 }}>
      <Pixel size={10}>{q.toUpperCase()}</Pixel>
      {children}
    </Card>
  );
}

function Row({ left, right, strong }: { left: string; right: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Body style={{ flex: 1, fontWeight: strong ? '800' : '400' }}>{left}</Body>
      <Body style={{ fontWeight: '800', color: C.navy }}>{right}</Body>
    </View>
  );
}

const pct = (f: number) => `${Math.round(f * 100)}%`;
const goose = SPECIAL.goose;
const swan = SPECIAL.swan;
const gooseKo = goose.koPts * goose.koNeeded + goose.koKillBonus;
const gooseBody = goose.bodyPts * goose.bodyNeeded;
const swanKo = swan.koPts * swan.koNeeded + swan.koKillBonus;
const swanBody = swan.bodyPts * swan.bodyNeeded;
const flockNames = FLOCK_SPECIES.filter((f) => !f.solo).map((f) => f.name.toLowerCase());

export default function MinigameFaq() {
  return (
    <SubScreen title="MINIGAME FAQ">
      <Q q="What is it?">
        <Body>
          {`A ${GAME_SECONDS}-second duck shoot that opens the app. Flocks cross the marsh from left to right; drop as many as you can before the clock runs out.`}
        </Body>
      </Q>

      <Q q="How do I shoot?">
        <Body>Put your finger on the gun at the bottom, drag to aim (a dotted line shows where), and let go to fire.</Body>
        <Body>{`You get ${CLIP} shells, then a ${RELOAD_SECONDS}-second reload — listen for the pump. Firing during a reload just clicks. The shells beside the gun show what's left.`}</Body>
      </Q>

      <Q q="How does scoring work?">
        <Body style={{ fontWeight: '800' }}>Nothing counts until the bird is down.</Body>
        <Body>
          {`Hits are banked on the bird and pay out when it falls. Wing one and let it get away? Zero. The KO zone is the front ${pct(KO_FRACTION.duck)} of a duck: head, neck and breast.`}
        </Body>
        <Row left="KO hit, drake" right="3" />
        <Row left="KO hit, hen" right="2" />
        <Row left="Body hit (banked)" right="1" />
        <Row left="Two body hits knock a duck down" right="2 total" />
        <Row left="Merganser knocked down" right="+2 bonus" />
        <Row left="Coot" right="−1" />
        <Body muted style={{ fontSize: 13 }}>Each bird you drop pops its name and points.</Body>
      </Q>

      <Q q="Which ducks fly?">
        <Body>{`South Dakota regulars: ${flockNames.join(', ')}.`}</Body>
        <Body>Teal and woodies dart up and down without warning. Gadwall and spoonies fly slow — and sometimes land on the open water in the middle.</Body>
        <Body>Mergansers come through alone, fast and low. Worth the bonus.</Body>
      </Q>

      <Q q="Sitting ducks?">
        <Body>Shoot a duck sitting on the water and you still get every point. You'll also get mocked. Sky-busting is the honorable way.</Body>
      </Q>

      <Q q="Coots?">
        <Body>They tag along with flocks now and then. Shooting one costs a point, and the game will let you hear about it.</Body>
      </Q>

      <Q q="Geese and swans">
        <Body>Big birds soak up hits; damage adds up across shots. At most one shows up per game. Drop one and the retriever comes up out of the reeds to fetch it (two dogs for a swan).</Body>
        <Row left="Goose (rare)" right="" strong />
        <Row left={`KO zone ${pct(KO_FRACTION.goose)} · ${goose.koNeeded} KO hits`} right={`${gooseKo}`} />
        <Row left={`or ${goose.bodyNeeded} body hits`} right={`${gooseBody}`} />
        <Row left="Swan (very rare)" right="" strong />
        <Row left={`KO zone ${pct(KO_FRACTION.swan)} · ${swan.koNeeded} KO hits`} right={`${swanKo}`} />
        <Row left={`or ${swan.bodyNeeded} body hits`} right={`${swanBody}`} />
        <Row left="Banded goose (extremely rare)" right="" strong />
        <Row left="Like a goose, every point doubled" right={`${gooseKo * 2}`} />
      </Q>

      <Q q="High scores">
        <Body>Beat a top-three score and you enter your initials for gold, silver or bronze. The summary screen waits a second before it takes any taps, so a last-second shot doesn't land on a button.</Body>
      </Q>

      <Q q="How do I skip it?">
        <Body>Tap the little duck at the top of the screen seven times. Want to play again later? More › Play the duck shoot.</Body>
      </Q>

      <Q q="Ads?">
        <Body>Never during the game. You might see one after you leave a game you replayed from the More tab.</Body>
      </Q>

      <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12 }}>Good shooting. Leave the coots alone.</Text>
    </SubScreen>
  );
}
