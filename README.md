# Pip Chess Openings

An iPhone-first app for learning chess openings. Pip, a small pawn, walks you through each opening one move at a time and explains why every move is good.

- **24 courses**: 12 to play as White, 12 to play as Black.
- **Grouped by Elo**, from Beginner (under 1000) to Grandmaster (2400+), so you can see what is commonly played at each level.
- **Every opening shows** a board preview, a short history, a 1–5 star strength rating and a study difficulty (Easy, Medium, Hard, Very hard).
- **Learn mode** shows the move with an arrow and explains it. **Practice mode** asks you to play the line from memory, with hints if you get stuck.
- Works offline once installed. Progress is saved on the device.

## Run it

No install and no build step. Serve the folder and open it:

```bash
npx serve .
```

## Put it on an iPhone

It is a web app that installs to the home screen and then runs full screen like a native app.

1. Host the folder on any HTTPS static host (GitHub Pages works: Settings → Pages → deploy from the branch root).
2. Open the address in Safari on the iPhone.
3. Tap Share → **Add to Home Screen**.

## Adding or editing openings

All content lives in `js/data/openings.js`. Each opening has a `side` (`w` or `b`), `tier` (Elo group), `stars`, `difficulty`, `tagline`, `history`, `ideas`, and `moves`: a list of `[move, explanation]` pairs in standard notation, starting from move one.

After editing, check that every line is legal:

```bash
node tools/validate.mjs
```

If you change any file, bump `VERSION` in `sw.js` so installed copies pick up the update.

## Credits

- Move legality: [chess.js](https://github.com/jhlywa/chess.js) by Jeff Hlywa (BSD-2-Clause), bundled in `js/vendor/`.
- Chess pieces: Colin M.L. Burnett (Cburnett), via Wikimedia Commons (BSD / GFDL / GPL / CC BY-SA 3.0).

Star ratings, difficulty labels and Elo groupings are editorial judgements meant as a guide, not statistics.
