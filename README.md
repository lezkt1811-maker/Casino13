# Serpent Bearer Slots ⛎

A free-play slot machine demo themed on 13-sign, true-sky astrology, with **Ophiuchus, the Serpent Bearer** as the wild symbol.

It is plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or host it anywhere static (GitHub Pages works).

> Demo only. "Stardust" credits have no cash value and cannot be bought or redeemed.

## How to play

- 3 reels × 3 rows, with 1–5 paylines (middle, top, bottom and both diagonals).
- Pick a bet per line (1, 2, 5, 10 or 25) and the number of lines, then press **Spin** (or Space).
- You start with 1,000 stardust. **Refill stardust** resets you to 1,000.

## Cosmic sound

Every sound is made live in the browser with the Web Audio API. There are no audio files.

- **Cosmos:** a slow, deep space drone with distant stars twinkling at random. Switch it off with the Cosmos toggle.
- **Spin:** a rising nebula whoosh.
- **Reel stops:** a low pulse and a crystal bell for each reel, rising in pitch.
- **Wins:** a cascade of star chimes. Big wins add a shower of sparkles.
- **Jackpot:** a deep cosmic gong, a choir-like chord and falling meteors.
- **Free spins:** a swirling portal opening.

Everything plays through a long space-hall reverb and a soft echo, and all notes come from one pentatonic scale so they always sound good together.

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
| `slots.js` | Reel animation, controls, cosmic Web Audio synth, starfield background |
| `simulate.js` | Monte Carlo return-to-player check |

## Run locally

```sh
npx serve .        # or: python3 -m http.server
# open http://localhost:3000/
```

## License

MIT
