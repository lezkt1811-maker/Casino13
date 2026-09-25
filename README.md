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

The bells, chimes, cymbals and coin "ching" are **real instrument recordings** from the [GeneralUser GS](http://www.schristiancollins.com/generaluser.php) SoundFont by S. Christian Collins: glockenspiel at every win pitch, tubular bells, and from its drum kit a triangle, ride bell, crash and splash cymbals, jingle bell, chimes (mark tree), tambourine and wood block. All 26 clips are packed into one file, [`sounds/casino-sounds.mp3`](sounds/casino-sounds.mp3) (about 570 KB). It starts downloading as the page opens, is decoded once when audio starts, and is sliced into one clip per sound. The licence is in [`sounds/LICENSE-GeneralUser-GS.txt`](sounds/LICENSE-GeneralUser-GS.txt).

The Web Audio API layers extra detail over the recordings: a struck-metal model under each bell for ring, a coin model under the triangle for body, and a mechanical clack under the wood block. If the recordings can't load, the models play on their own.

| Sound | What you hear | Length |
|---|---|---|
| **Coin** (`playCoin`) | A crisp metallic *CHING*: a real triangle strike damped short, a bright coin model for the metal body, and now and then a jingle-bell rattle. Plays on bet buttons, Max bet, Refill and inside the win sequences. | about 0.2 s |
| **Reel stop** (`playReelStop`) | A punchy *CLACK*: a real wood-block click over a mechanical knock and metal latch. Each reel lands a little higher and harder. | about 0.06 s |
| **Reels spinning** | A *ka-chunk* start, then a ratchet clicking past the pawl that slows as each reel coasts in. | while spinning |
| **Anticipation** (`playAnticipation`) | Soft ticking that speeds up, with small bells stepping upward. Starts when the first two reels line up a possible win and cuts off the instant the last reel lands. | while the last reel spins |
| **Small win** (`playSmallWin`) | *DING! DING! DING! DING!*: four rising glockenspiel bells with coin chings. | about 1 s |
| **Medium win** (`playMediumWin`) | *DING-DING-DING-DING-DING-DING*: nine fast rising glockenspiel bells over coin ticks, a chimes sweep and a two-bell finish. | about 2 s |
| **Big win** (`playBigWin`) | A rapid two-bell ring, a rising two-octave cascade in thirds over a chimes sweep, coins pouring underneath, sparkles, and a strummed bell chord with a tubular bell and splash cymbal. | about 3.3 s |
| **Jackpot** (`playJackpot`) | The machine goes wild: a splash cymbal and a bell roll with a ride-bell alarm, an 80-coin shower with tambourine, a three-layer rising cascade over a chimes sweep, a second higher ring, glitter throughout, and a tubular-bell and glockenspiel flourish that ends on one big hit with a crash cymbal. The Mega Jackpot adds another bell layer, a 120-coin shower and a final chimes sweep. | about 5 s |
| **Bonus / free spins** | A fast bell trill into a rising cascade, or three rising bell triplets. | 1.5–2 s |

A spin with no win is silent, like a real machine. Volumes are balanced (reel stop 25%, coin 35%, small 45%, medium 60%, big 75%, jackpot 100%), and a limiter keeps dense celebrations from distorting. The Win meter counts up in time with each win sound.

**Win tiers:** small is under 2× the total bet, medium is 2–10×, big is 10× or more. The jackpot plays for Serpent Bearer Triple and the Mega Jackpot.

**Mobile:** audio starts or resumes on every tap and key press, which Android Chrome requires, so sound keeps working after the phone suspends it. Finished sounds are disconnected so nothing piles up.

**Cosmos (ambience):** off by default. When it's on, you hear a distant casino floor: occasional bells and coins.

### Use real casino recordings

Put MP3 or WAV files in the [`sounds/`](sounds/) folder (for example `sounds/win.mp3`) and the game plays them instead of the built-in sounds. [`sounds/README.md`](sounds/README.md) lists the file names and where to find free casino sounds.

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
| `slots.js` | Reel animation, controls, casino sound engine, starfield background |
| `simulate.js` | Monte Carlo return-to-player check |

## Run locally

```sh
npx serve .        # or: python3 -m http.server
# open http://localhost:3000/
```

## License

MIT
