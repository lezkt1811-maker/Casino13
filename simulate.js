// Monte Carlo check of the demo's return-to-player. Usage: node simulate.js [spins]
var E = require('./slots-engine.js');
var N = +process.argv[2] || 1000000;
var lines = E.PAYLINES.length, bet = 1, wagered = 0, won = 0, hits = 0, freeLeft = 0;
var kinds = {};
for (var i = 0; i < N; i++) {
  var free = freeLeft > 0;
  if (free) freeLeft--; else wagered += lines * bet;
  var r = E.evaluate(E.spinGrid(), lines, bet);
  won += r.total;
  if (r.total > 0) hits++;
  freeLeft += r.freeSpins;
  r.wins.forEach(function (w) { kinds[w.kind] = (kinds[w.kind] || 0) + w.amount; });
}
console.log('spins', N, 'RTP', (won / wagered * 100).toFixed(2) + '%', 'hit rate', (hits / N * 100).toFixed(2) + '%');
Object.keys(kinds).forEach(function (k) { console.log('  ' + k, (kinds[k] / wagered * 100).toFixed(2) + '%'); });
