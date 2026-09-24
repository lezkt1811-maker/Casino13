# Serpent Bearer Slots ⛎

A free-play slot machine demo themed on 13-sign, true-sky astrology, with **Ophiuchus, the Serpent Bearer** as the wild symbol.

It is plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or host it anywhere static (GitHub Pages works).

> Demo only. "Stardust" credits have no cash value and cannot be bought or redeemed.

## How to play

- 3 reels × 3 rows, with 1–5 paylines (middle, top, bottom and both diagonals).
- Pick a bet per line (1, 2, 5, 10 or 25) and the number of lines, then press **Spin** (or Space).
- You start with 1,000 stardust. **Refill stardust** resets you to 1,000.

## Sound

Every sound is made live in the browser with the Web Audio API, with no audio files. The effects are all sparkles, fireworks and coins.

- **Cosmos (ambience):** a soft, starlit chord with glitter drifting in and out. Switch it off with the Cosmos toggle.
- **Spin:** a magic swoosh that leaves a trail of glitter.
- **Reel stops:** a solid thud and a puff of sparkles, with more sparkles on each reel.
- **Wins:** an arcade *ka-ching* and a spill of coins that gets bigger with the size of the win.
- **Big wins:** fireworks (a whistle up, a bang and a crackle), 90s anime brass hits, and more coins and sparkles.
- **Jackpot:** a huge blast, a barrage of six fireworks, a brass fanfare and an avalanche of more than a hundred coins.
- **Free spins:** a whirling tone that flies out and back, then a sparkling pop.

## Paytable (per line × bet per line)

| Combination | Pays |
|---|---|
| ⛎ ⛎ ⛎ Serpent Bearer Jackpot | ×1000 |
| ☉ ☉ ☉ Solar Alignment | ×150 |
| ☽ ☽ ☽ Lunar Alignment | ×80 |
| Three of the same sign | ×35 |
| Elemental Trine: three signs of one element (e.g. ♈ ♌ ♐) | ×5 |

- **⛎ Ophiuchus is wild.** It substitutes for any sign, the Sun or the Moon.
- **3+ Ophiuchus anywhere** on the reels award **5 free spins** at the current bet.

The simulated return to player is about **95%**, with a win on about 27% of spins:

```sh
node simulate.js 5000000
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page markup |
| `slots.css` | Black-and-gold celestial theme  |
| `slots-engine.js` | Pure game logic: symbols, weights, paylines, payouts. Works in the browser and in Node |
| `slots.js` | Reel animation, controls, Web Audio sound effects, starfield background |
| `simulate.js` | Monte Carlo return-to-player check |

## Run locally

```sh
npx serve .        # or: python3 -m http.server
# open http://localhost:3000/
```

## License

MIT
