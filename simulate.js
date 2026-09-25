// Monte Carlo check of the demo's return to player. Usage: node simulate.js [spins] [lines]
// Plays max lines at 1 credit per line, including free spins, the Zodiac Wheel
// bonus and the progressive Mega Jackpot.
var E = require('./slots-engine.js');
var N = +process.argv[2] || 1000000;
var lines = +process.argv[3] || E.PAYLINES.length, bet = 1, total = lines * bet;
var wagered = 0, won = 0, hits = 0, freeLeft = 0, pool = E.JACKPOT_SEED;
var parts = {}, eclipses = 0, jackpots = 0;
function add(k, v) { parts[k] = (parts[k] || 0) + v; won += v; }
for (var i = 0; i < N; i++) {
  if (freeLeft > 0) freeLeft--;
  else { wagered += total; pool += total * E.JACKPOT_CONTRIBUTION; }
  var r = E.evaluate(E.spinGrid(), lines, bet);
  r.wins.forEach(function (w) { add(w.kind, w.amount); });
  if (r.total > 0 || r.eclipse) hits++;
  freeLeft += r.freeSpins;
  if (r.eclipse) {
    eclipses++;
    var slice = E.WHEEL[E.spinWheel()];
    if (slice.jackpot) { jackpots++; add('megaJackpot', pool); pool = E.JACKPOT_SEED; }
    else add('wheel', slice.mult * bet);
  }
}
console.log('spins', N, 'RTP', (won / wagered * 100).toFixed(2) + '%', 'hit rate', (hits / N * 100).toFixed(2) + '%');
console.log('eclipse bonus 1 in', Math.round(N / eclipses), 'spins; Mega Jackpot 1 in', jackpots ? Math.round(N / jackpots) : '∞');
Object.keys(parts).forEach(function (k) { console.log('  ' + k, (parts[k] / wagered * 100).toFixed(2) + '%'); });
