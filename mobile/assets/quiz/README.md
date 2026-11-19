# Duck ID quiz media

Everything the quiz shows or plays lives here:

- `img/` — one photo per species, named by species code (`mall.jpg`)
- `audio/` — call recordings, same naming (`mall.mp3`)
- `credits.json` — author, license and source link for every file
- `review.html` — open in a browser to see and hear every question, mark each
  OK / Replace / Drop, and copy your review back to Claude

A question is one photo or one call. Each round picks 10 at random and builds the
7 answer choices automatically (look-alikes from the same group first), so adding
a file adds a question — nothing else to write.

## Adding or replacing media

1. Find a **public-domain or CC0** photo or recording. Good sources:
   - Photos: Wikimedia Commons (filter by "Public domain" / "CC0"), USFWS
     National Digital Library (digitalmedia.fws.gov)
   - Calls: Xeno-canto (only recordings marked CC0 — most are CC BY-NC, which is
     not OK for an ad-supported app), USFWS / USGS, Macaulay Library is NOT free to reuse
2. Easiest: send Claude the link (the page, not just the image), or drop the file
   anywhere and say which species it is. Claude checks the license, resizes it,
   names it, records the credit and regenerates the quiz.
3. By hand: save as `img/<code>.jpg` (landscape, ~1024 px wide) or
   `audio/<code>.mp3` (a few seconds, mono is fine), add a `credits.json` entry,
   then run `node scripts/gen-quiz-media.mjs` from `mobile/`.

Your own photos and recordings are welcome too — credit them to yourself.

## Species codes

| Species | Code |
|---|---|
| Mallard | mall |
| American Black Duck | abdu |
| Mottled Duck | modu |
| Mexican Duck | medu |
| Gadwall | gadw |
| American Wigeon | amwi |
| Eurasian Wigeon | euwi |
| Northern Pintail | nopi |
| Northern Shoveler | nsho |
| Blue-winged Teal | bwte |
| Green-winged Teal | gwte |
| Cinnamon Teal | cite |
| Wood Duck | wodu |
| Fulvous Whistling-Duck | fuwd |
| Black-bellied Whistling-Duck | bbwd |
| Canvasback | canv |
| Redhead | redh |
| Ring-necked Duck | rndu |
| Greater Scaup | grsc |
| Lesser Scaup | lesc |
| Bufflehead | buff |
| Common Goldeneye | cogo |
| Barrow's Goldeneye | bago |
| Ruddy Duck | rudu |
| Hooded Merganser | home |
| Common Merganser | come |
| Red-breasted Merganser | rbme |
| Long-tailed Duck | ltdu |
| Surf Scoter | susc |
| White-winged Scoter | wwsc |
| Black Scoter | blsc |
| Harlequin Duck | hadu |
| Common Eider | coei |
| King Eider | kiei |
| Canada Goose | cago |
| Cackling Goose | cacg |
| Snow Goose | sngo |
| Ross's Goose | rogo |
| Greater White-fronted Goose | gwfg |
| Brant | bran |
| Emperor Goose | emgo |
| American Coot | amco |
