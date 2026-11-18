/**
 * North American waterfowl a hunter can log. Bundled, never fetched.
 *
 * `id` is the bird-banding four-letter code in lower case: hunters already know
 * them (GWTE, BWTE, CAGO) and the search matches them. `aliases` are the names a
 * hunter actually says in the blind; search ranks them alongside the real name.
 *
 * `sexed` species get drake/hen counters when logged. Geese, coots and whistling
 * ducks look the same either way, so they get one plain count.
 *
 * `colors` drive the procedural pixel portrait on the Duck-dex card (drake
 * plumage): see ui/PixelBird.tsx.
 */

export type SpeciesGroup =
  | 'dabbler'
  | 'diver'
  | 'sea'
  | 'merganser'
  | 'whistling'
  | 'goose'
  | 'coot';

export type Rarity = 'common' | 'uncommon' | 'rare';

export type BirdShape = 'duck' | 'goose' | 'coot';

export type BirdColors = {
  head: string;
  bill: string;
  breast: string;
  body: string;
  wing: string;
  tail: string;
  /** Speculum / wing patch, cheek patch or other field mark. */
  accent: string;
};

export type Species = {
  id: string;
  name: string;
  group: SpeciesGroup;
  aliases: string[];
  sexed: boolean;
  rarity: Rarity;
  shape: BirdShape;
  colors: BirdColors;
};

const c = (
  head: string,
  bill: string,
  breast: string,
  body: string,
  wing: string,
  tail: string,
  accent: string,
): BirdColors => ({ head, bill, breast, body, wing, tail, accent });

export const SPECIES: Species[] = [
  // ── Dabblers ────────────────────────────────────────────────────────────
  { id: 'mall', name: 'Mallard', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['greenhead', 'suzie', 'susie', 'hen mallard', 'drake mallard', 'mallard'],
    colors: c('#1F6B3A', '#E8C547', '#6B3A2A', '#B9B4AA', '#8A8279', '#2B2B2B', '#3550C8') },
  { id: 'abdu', name: 'American Black Duck', group: 'dabbler', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['black duck', 'blackie', 'black mallard', 'redleg'],
    colors: c('#8C7A62', '#C9B84A', '#3B2E22', '#3B2E22', '#2F251B', '#2A2018', '#5B3FA0') },
  { id: 'modu', name: 'Mottled Duck', group: 'dabbler', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['mottled', 'summer mallard', 'florida duck'],
    colors: c('#A08A6C', '#D6B83E', '#6E5438', '#6E5438', '#5A4430', '#4A3826', '#2F6FA8') },
  { id: 'medu', name: 'Mexican Duck', group: 'dabbler', sexed: true, rarity: 'rare', shape: 'duck',
    aliases: ['mexican mallard', 'mexie'],
    colors: c('#8F7B5E', '#C8B24A', '#5E4A33', '#6A553C', '#544230', '#433424', '#3F5FB8') },
  { id: 'gadw', name: 'Gadwall', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['gaddy', 'gray duck', 'grey duck', 'gray ghost', 'gadwell'],
    colors: c('#8A7F72', '#3A3A3A', '#7C756C', '#8E8A84', '#6D665E', '#1E1E1E', '#F2F2F2') },
  { id: 'amwi', name: 'American Wigeon', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['wigeon', 'widgeon', 'baldpate', 'bald pate', 'whistler'],
    colors: c('#F2F0E8', '#9BB5C9', '#B27A5C', '#B27A5C', '#8C7A6A', '#2A2A2A', '#2E7A45') },
  { id: 'euwi', name: 'Eurasian Wigeon', group: 'dabbler', sexed: true, rarity: 'rare', shape: 'duck',
    aliases: ['european wigeon', 'eurasian widgeon', 'redhead wigeon'],
    colors: c('#A8452E', '#9BB5C9', '#C89A8A', '#A7A7A7', '#8C8C8C', '#2A2A2A', '#F0D98A') },
  { id: 'nopi', name: 'Northern Pintail', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['pintail', 'sprig', 'bull sprig', 'pinny', 'pinnie', 'spike'],
    colors: c('#6B4B32', '#5C6E80', '#F4F2EC', '#B9B9B5', '#8E8E8A', '#222222', '#3F7A4A') },
  { id: 'nsho', name: 'Northern Shoveler', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['shoveler', 'spoonie', 'spoonbill', 'smiling mallard', 'neighborhood mallard', 'spoony'],
    colors: c('#1E5A36', '#1C1C1C', '#F4F2EC', '#B25A2E', '#9BB7D4', '#222222', '#2E7A45') },
  { id: 'bwte', name: 'Blue-winged Teal', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['bluewing', 'blue wing teal', 'bwt', 'teal', 'bluewinged teal'],
    colors: c('#4A5A7A', '#2A2A2A', '#B08A62', '#9C7652', '#86A9D1', '#2A2A2A', '#F4F4F4') },
  { id: 'gwte', name: 'Green-winged Teal', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['greenwing', 'green wing teal', 'gwt', 'teal', 'greenwinged teal', 'rocket'],
    colors: c('#8E3A22', '#2A2A2A', '#E2CDB0', '#A3A6A8', '#7E8285', '#E8D27A', '#1F7A48') },
  { id: 'cite', name: 'Cinnamon Teal', group: 'dabbler', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['cinnamon', 'red teal', 'cit', 'teal'],
    colors: c('#9C3A1E', '#2A2A2A', '#9C3A1E', '#9C3A1E', '#86A9D1', '#3A2A20', '#2E7A45') },
  { id: 'wodu', name: 'Wood Duck', group: 'dabbler', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['woodie', 'woody', 'woodduck', 'squealer', 'summer duck', 'carolina duck'],
    colors: c('#1F5A44', '#D9452E', '#7A3A2A', '#C8B07A', '#2E3A5A', '#1A1A2A', '#F4F4F4') },
  { id: 'fuwd', name: 'Fulvous Whistling-Duck', group: 'whistling', sexed: false, rarity: 'rare', shape: 'duck',
    aliases: ['fulvous', 'whistling duck', 'mexican squealer', 'tree duck'],
    colors: c('#C2884E', '#2A2A2A', '#C2884E', '#B67A42', '#4A3A2A', '#2A2A2A', '#F2E6CC') },
  { id: 'bbwd', name: 'Black-bellied Whistling-Duck', group: 'whistling', sexed: false, rarity: 'uncommon', shape: 'duck',
    aliases: ['black bellied whistling duck', 'whistling duck', 'whistler', 'tree duck', 'bbwd'],
    colors: c('#9A9A92', '#E85A3A', '#A0663E', '#1E1E1E', '#F2F2F2', '#1E1E1E', '#E85A3A') },

  // ── Divers ──────────────────────────────────────────────────────────────
  { id: 'canv', name: 'Canvasback', group: 'diver', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['can', 'cans', 'bull can', 'canvasback', 'king of ducks'],
    colors: c('#8E3A22', '#1E1E1E', '#1E1E1E', '#ECECE6', '#D8D8D0', '#1E1E1E', '#8E3A22') },
  { id: 'redh', name: 'Redhead', group: 'diver', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['redhead', 'red head', 'pochard'],
    colors: c('#B5452A', '#8FA8C0', '#1E1E1E', '#9C9C98', '#8A8A86', '#1E1E1E', '#C9C9C2') },
  { id: 'rndu', name: 'Ring-necked Duck', group: 'diver', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['ringneck', 'ring neck', 'ringbill', 'ring bill', 'blackjack', 'black jack'],
    colors: c('#2A1E3A', '#9AAFC2', '#1E1E1E', '#A5A5A0', '#1E1E1E', '#1E1E1E', '#F4F4F4') },
  { id: 'grsc', name: 'Greater Scaup', group: 'diver', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['bluebill', 'big bluebill', 'broadbill', 'scaup', 'greater bluebill'],
    colors: c('#1E3A2A', '#8FB0D0', '#1E1E1E', '#E6E6E0', '#B8B8B2', '#1E1E1E', '#F4F4F4') },
  { id: 'lesc', name: 'Lesser Scaup', group: 'diver', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['bluebill', 'little bluebill', 'broadbill', 'scaup', 'lesser bluebill', 'raft duck'],
    colors: c('#2E1E3A', '#8FB0D0', '#1E1E1E', '#D8D8D2', '#A8A8A2', '#1E1E1E', '#F4F4F4') },
  { id: 'buff', name: 'Bufflehead', group: 'diver', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['butterball', 'buffie', 'buffy', 'dipper', 'bumblebee duck'],
    colors: c('#2A2A4A', '#7A7A82', '#F4F4F4', '#F4F4F4', '#1E1E1E', '#4A4A4A', '#F4F4F4') },
  { id: 'cogo', name: 'Common Goldeneye', group: 'diver', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['goldeneye', 'whistler', 'garrot', 'golden eye'],
    colors: c('#1E3A2A', '#1E1E1E', '#F4F4F4', '#F4F4F4', '#1E1E1E', '#4A4A4A', '#F4F4F4') },
  { id: 'bago', name: "Barrow's Goldeneye", group: 'diver', sexed: true, rarity: 'rare', shape: 'duck',
    aliases: ['barrows goldeneye', 'barrows', 'rocky mountain garrot'],
    colors: c('#2A1E3A', '#1E1E1E', '#F4F4F4', '#1E1E1E', '#1E1E1E', '#4A4A4A', '#F4F4F4') },
  { id: 'rudu', name: 'Ruddy Duck', group: 'diver', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['ruddy', 'butterball', 'stifftail', 'stiff tail', 'dumb bird', 'boobie'],
    colors: c('#1E1E1E', '#4A90D0', '#A0482A', '#A0482A', '#8A3E24', '#1E1E1E', '#F4F4F4') },

  // ── Mergansers ──────────────────────────────────────────────────────────
  { id: 'home', name: 'Hooded Merganser', group: 'merganser', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['hoodie', 'hooded', 'hoody', 'merganser', 'merg', 'sawbill', 'fish duck'],
    colors: c('#1E1E1E', '#1E1E1E', '#F4F4F4', '#A8642E', '#1E1E1E', '#2A2A2A', '#F4F4F4') },
  { id: 'come', name: 'Common Merganser', group: 'merganser', sexed: true, rarity: 'common', shape: 'duck',
    aliases: ['merganser', 'merg', 'sawbill', 'fish duck', 'goosander', 'shelldrake'],
    colors: c('#1E4A30', '#C8342A', '#F4F0E8', '#F4F0E8', '#1E1E1E', '#8A8A8A', '#F4F4F4') },
  { id: 'rbme', name: 'Red-breasted Merganser', group: 'merganser', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['merganser', 'merg', 'sawbill', 'fish duck', 'red breasted', 'hairy head'],
    colors: c('#1E4A30', '#C8342A', '#A87A5A', '#9A9A9A', '#1E1E1E', '#6A6A6A', '#F4F4F4') },

  // ── Sea ducks ───────────────────────────────────────────────────────────
  { id: 'ltdu', name: 'Long-tailed Duck', group: 'sea', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['oldsquaw', 'old squaw', 'long tail', 'longtail', 'hound'],
    colors: c('#F4F4F4', '#E89AA0', '#3A2A20', '#F4F4F4', '#3A2A20', '#1E1E1E', '#9A8A7A') },
  { id: 'susc', name: 'Surf Scoter', group: 'sea', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['scoter', 'skunkhead', 'skunk head', 'sea coot', 'surf duck', 'butterbill'],
    colors: c('#1E1E1E', '#F08A2A', '#1E1E1E', '#1E1E1E', '#1E1E1E', '#1E1E1E', '#F4F4F4') },
  { id: 'wwsc', name: 'White-winged Scoter', group: 'sea', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['scoter', 'whitewing', 'white wing', 'sea coot', 'bull coot'],
    colors: c('#1E1E1E', '#E86A3A', '#2A2420', '#2A2420', '#1E1E1E', '#1E1E1E', '#F4F4F4') },
  { id: 'blsc', name: 'Black Scoter', group: 'sea', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['scoter', 'black coot', 'sea coot', 'butterbill', 'american scoter'],
    colors: c('#141414', '#F2B830', '#141414', '#141414', '#141414', '#141414', '#2A2A2A') },
  { id: 'hadu', name: 'Harlequin Duck', group: 'sea', sexed: true, rarity: 'rare', shape: 'duck',
    aliases: ['harlequin', 'lords and ladies', 'painted duck', 'rock duck'],
    colors: c('#3A4A6A', '#3A3A3A', '#3A4A6A', '#A0482A', '#3A4A6A', '#1E1E2A', '#F4F4F4') },
  { id: 'coei', name: 'Common Eider', group: 'sea', sexed: true, rarity: 'uncommon', shape: 'duck',
    aliases: ['eider', 'shoal duck', 'sea duck'],
    colors: c('#F4F4F4', '#8A9A6A', '#F0E6D0', '#1E1E1E', '#F4F4F4', '#1E1E1E', '#9AC88A') },
  { id: 'kiei', name: 'King Eider', group: 'sea', sexed: true, rarity: 'rare', shape: 'duck',
    aliases: ['king', 'eider'],
    colors: c('#8AA8C8', '#F08A2A', '#F0D8B8', '#1E1E1E', '#1E1E1E', '#1E1E1E', '#F4F4F4') },

  // ── Geese ───────────────────────────────────────────────────────────────
  { id: 'cago', name: 'Canada Goose', group: 'goose', sexed: false, rarity: 'common', shape: 'goose',
    aliases: ['honker', 'canada', 'canadian goose', 'canadian', 'lesser canada', 'giant canada'],
    colors: c('#1A1A1A', '#1A1A1A', '#C8B8A0', '#8C7A64', '#6E5E4C', '#1A1A1A', '#F4F4F4') },
  { id: 'cacg', name: 'Cackling Goose', group: 'goose', sexed: false, rarity: 'uncommon', shape: 'goose',
    aliases: ['cackler', 'cacklers', 'minima', 'small canada'],
    colors: c('#1A1A1A', '#1A1A1A', '#9A8670', '#7A6852', '#5E5040', '#1A1A1A', '#F4F4F4') },
  { id: 'sngo', name: 'Snow Goose', group: 'goose', sexed: false, rarity: 'common', shape: 'goose',
    aliases: ['snow', 'snows', 'wavie', 'wavey', 'blue goose', 'blue', 'light goose'],
    colors: c('#F4F4F4', '#E88A9A', '#F4F4F4', '#F4F4F4', '#F4F4F4', '#F4F4F4', '#1E1E1E') },
  { id: 'rogo', name: "Ross's Goose", group: 'goose', sexed: false, rarity: 'uncommon', shape: 'goose',
    aliases: ['ross', 'rosses', 'ross goose', 'light goose', 'wavie'],
    colors: c('#F4F4F4', '#E87A8A', '#F4F4F4', '#F4F4F4', '#F4F4F4', '#F4F4F4', '#1E1E1E') },
  { id: 'gwfg', name: 'Greater White-fronted Goose', group: 'goose', sexed: false, rarity: 'common', shape: 'goose',
    aliases: ['specklebelly', 'speck', 'specks', 'speckle belly', 'white front', 'whitefront', 'laughing goose'],
    colors: c('#6E5A44', '#E89A8A', '#8C7A64', '#6E5A44', '#5A4A38', '#F4F4F4', '#1E1E1E') },
  { id: 'bran', name: 'Brant', group: 'goose', sexed: false, rarity: 'uncommon', shape: 'goose',
    aliases: ['brant goose', 'black brant', 'brent'],
    colors: c('#141414', '#141414', '#141414', '#5A5048', '#3E3832', '#141414', '#F4F4F4') },
  { id: 'emgo', name: 'Emperor Goose', group: 'goose', sexed: false, rarity: 'rare', shape: 'goose',
    aliases: ['emperor', 'beach goose'],
    colors: c('#F4F4F4', '#E88A9A', '#7A7E92', '#7A7E92', '#5E6274', '#F4F4F4', '#1E1E1E') },

  // ── Coot ────────────────────────────────────────────────────────────────
  { id: 'amco', name: 'American Coot', group: 'coot', sexed: false, rarity: 'common', shape: 'coot',
    aliases: ['coot', 'mud hen', 'mudhen', 'poule d eau', 'pool doo', 'marsh hen', 'blue peter'],
    colors: c('#1E1E1E', '#F4F4F4', '#3A3A40', '#3A3A40', '#2E2E34', '#1E1E1E', '#A83A2A') },
];

export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(
  SPECIES.map((s) => [s.id, s]),
);

export function speciesById(id: string): Species | undefined {
  return SPECIES_BY_ID[id];
}

export const TEAL = new Set(['bwte', 'gwte', 'cite']);
export const SCAUP = new Set(['grsc', 'lesc']);
export const LIGHT_GEESE = new Set(['sngo', 'rogo']);

export const isGoose = (id: string) => SPECIES_BY_ID[id]?.group === 'goose';
export const isCoot = (id: string) => id === 'amco';
export const isDuck = (id: string) => !isGoose(id) && !isCoot(id);

export const GROUP_LABEL: Record<SpeciesGroup, string> = {
  dabbler: 'Puddle ducks',
  diver: 'Divers',
  sea: 'Sea ducks',
  merganser: 'Mergansers',
  whistling: 'Whistling ducks',
  goose: 'Geese',
  coot: 'Coot',
};
