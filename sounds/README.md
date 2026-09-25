# Real sound recordings (optional)

The game ships with its own generated casino sounds. If you'd rather use recordings, put MP3 or WAV files in this folder with the names below. Each file replaces just that one sound; anything without a file keeps the built-in version.

| File name | When it plays |
|---|---|
| `coin` | A coin/credit "ching" (bet buttons, refill) |
| `reelstop` | Each reel stops |
| `spin` | The reels start spinning |
| `anticipation` | Two matching symbols are in and the last reel is still spinning |
| `smallwin` | Wins under 2× the total bet (falls back to `win`) |
| `mediumwin` | Wins from 2× to 10× the total bet (falls back to `win`) |
| `bigwin` | Wins of 10× the total bet or more (falls back to `win`) |
| `win` | Any win tier that has no file of its own |
| `jackpot` | Serpent Bearer Triple (three Ophiuchus on a line) |
| `megajackpot` | The Mega Jackpot on the Zodiac Wheel (falls back to `jackpot`) |
| `bonus` | A Cosmic Eclipse or a bought feature opens the Zodiac Wheel |
| `wheel` | The Zodiac Wheel spins |
| `freespins` | Free spins are awarded |
| `lose` | A spin with no win (silent by default) |

For example: `win.mp3`, `jackpot.wav`, `coin.mp3`.

## Where to find free casino sounds

Check each sound's licence before you use it.

- Pixabay: https://pixabay.com/sound-effects/search/slot%20machine/
- Mixkit: https://mixkit.co/free-sound-effects/casino/
- Freesound (filter by the CC0 licence): https://freesound.org/search/?q=slot+machine+win

## How to add them on GitHub

1. Open this `sounds` folder on github.com.
2. Click **Add file → Upload files** and drag your files in.
3. Name them to match the table, then click **Commit changes**.
