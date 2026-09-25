# Serpent Bearer Slots ⛎

A free-play slot machine demo themed on 13-sign, true-sky astrology, with **Ophiuchus, the Serpent Bearer** as the wild symbol.

It is plain HTML, CSS and JavaScript with no build step. Open `index.html` in a browser, or host it anywhere static (GitHub Pages works).

> Demo only. "Stardust" credits have no cash value and cannot be bought or redeemed.

## How to play

- 3 reels × 3 rows, with **1–9 paylines**: the three rows, both diagonals, V, Peak, Crown and Valley.
- **Coin** (1, 2, 5, 10, 20, 50 or 100) × **Level** (1–10) = your **line bet**. Line bet × lines = your **total bet**, from 1 up to 9,000 a spin.
- **Max bet** sets coin 100, level 10 and all 9 lines in one tap.
- **Speed:** Slow, Medium or Fast reels (Fast also shortens the pause between auto spins).
- **Spin**, or press Space. Tap **Stop** while the reels are turning to slam them to a stop.
- **Auto:** 10, 25, 50, 100 or ∞ spins. The counter shows how many are left; choose Off to stop.
- **Buy feature:** go straight to the Zodiac Wheel bonus for 175× your line bet.
- You start with 10,000 stardust. **Refill stardust** resets you to 10,000.

## Sound

Every sound is made live in the browser with the Web Audio API, with no audio files. Wins use a slot machine credit tally; celebrations add sparkles and fireworks.

- **Cosmos (ambience):** off by default, so the game is silent between spins. Tick Cosmos for occasional soft sparkles.
- **Reels spinning:** a mechanical slot-reel sound: a *ka-chunk* as the reels start, a ratchet clicking about 22 times a second that slows as each reel coasts in, and a soft whir.
- **Reel stops:** a heavy mechanical clunk as each reel locks in.
- **Wins:** a slot machine credit tally. A fast electronic *ding-ding-ding-ding* rings about 16 times a second while the Win meter counts up, climbing in pitch as it goes. A short win jingle plays when the count finishes. Bigger wins tally for longer.
- **Big wins:** a longer tally and a bigger jingle, followed by fireworks (a whistle up, a bang and a crackle).
- **Jackpot:** a huge blast, a barrage of six fireworks, a brass fanfare and a four-second credit tally.
- **Free spins:** a whirling tone that flies out and back, then a sparkling pop.

### Use real casino recordings

Put audio files in the [`sounds/`](sounds/) folder (for example `sounds/win.mp3`) and the game plays them instead of the built-in sounds. [`sounds/README.md`](sounds/README.md) lists the file names and where to find free casino sounds.

## Paytable (per line × bet per line)

| Combination | Pays |
|---|---|
| ☉ ☽ ⛎ Cosmic Eclipse (any order) | **Zodiac Wheel bonus** |
| ⛎ ⛎ ⛎ Serpent Bearer Triple | ×1000 |
| ☉ ☉ ☉ Solar Alignment | ×130 |
| ☽ ☽ ☽ Lunar Alignment | ×70 |
| Three of the same sign | ×28 |
| Elemental Trine: three signs of one element (e.g. ♈ ♌ ♐) | ×4 |

- **⛎ Ophiuchus is wild.** It substitutes for any sign, the Sun or the Moon.
- **3+ Ophiuchus anywhere** on the reels award **5 free spins** at the current bet.

## Special feature: Cosmic Eclipse and the Mega Jackpot

When the **Sun, Moon and Ophiuchus** land together on any active payline, in any order, the reels go dark and the **Zodiac Wheel** opens.

- The wheel has 13 slices, one for each sign in true-sky order, with Ophiuchus between Scorpio and Sagittarius.
- The 12 classic signs pay **50× to 500× your line bet**.
- The **⛎ Ophiuchus slice wins the progressive Mega Jackpot**. The jackpot starts at 1,000 and grows by 2% of every paid bet until someone wins it. It then resets to 1,000.
- A Mega Jackpot win sets off a full-screen celebration: a white flash, spinning light rays, a count-up, raining coins, neon fireworks and an extra-long sound finale.
- With all 9 lines, the bonus opens about once every 190 spins and the Mega Jackpot hits about once every 2,500 spins. You can also **Buy feature**, or open **Demo controls** under the machine and arm the next spin.

The simulated return to player is about **95%** whether you play 1 line or all 9. With all 9 lines, about 38% of spins win something. This includes free spins, the wheel and the Mega Jackpot:

```sh
node simulate.js 5000000      # all 9 lines
node simulate.js 5000000 1    # 1 line
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page markup |
| `slots.css` | Neon cyberpunk theme: plasma background, synthwave grid, rainbow glow |
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
