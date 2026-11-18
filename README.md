# Duck Buster

Gamify duck season for family and friends: log hunts per hunter, climb the Bragging Board, collect the Duck-dex, earn secret badges, roast each other at Season Awards Night — and warm up with a pixel duck-shoot mini-game every time the app opens.

Offline and single-phone (moving phones goes screen-to-camera over looping QR codes). Ad-supported. Android first.

## Develop

```bash
cd mobile
npm install
npm test              # Vitest: rules, search, game engine, QR transfer
npm run typecheck
npx eslint src test
npx expo run:android  # debug build on a connected phone
```

Builds are local only (Gradle / Xcode). No EAS.

## Layout

- `mobile/src/domain` — pure rules: species, search, badges, titles, awards, wrapped, rivalry, quiz
- `mobile/src/game` — the mini-game (UI-thread Skia + Reanimated)
- `mobile/src/transfer` — phone-to-phone QR protocol
- `mobile/src/app` — screens (Expo Router)
