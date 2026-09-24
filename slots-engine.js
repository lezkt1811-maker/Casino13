/*
 * Serpent Bearer Slots — game engine.
 * Pure logic (no DOM) so it runs in the browser and in Node for tests/simulation.
 * Demo only: play credits, no real money.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SlotsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VS = '︎'; // text presentation selector: keeps glyphs gold instead of emoji

  // The 13 signs of the true-sky ecliptic, in order, plus the two luminaries.
  var SYMBOLS = [
    { id: 'aries',       glyph: '♈' + VS, name: 'Aries',       element: 'fire',  weight: 4 },
    { id: 'taurus',      glyph: '♉' + VS, name: 'Taurus',      element: 'earth', weight: 4 },
    { id: 'gemini',      glyph: '♊' + VS, name: 'Gemini',      element: 'air',   weight: 4 },
    { id: 'cancer',      glyph: '♋' + VS, name: 'Cancer',      element: 'water', weight: 4 },
    { id: 'leo',         glyph: '♌' + VS, name: 'Leo',         element: 'fire',  weight: 4 },
    { id: 'virgo',       glyph: '♍' + VS, name: 'Virgo',       element: 'earth', weight: 4 },
    { id: 'libra',       glyph: '♎' + VS, name: 'Libra',       element: 'air',   weight: 4 },
    { id: 'scorpio',     glyph: '♏' + VS, name: 'Scorpio',     element: 'water', weight: 4 },
    { id: 'ophiuchus',   glyph: '⛎' + VS, name: 'Ophiuchus',   element: null,    weight: 2, wild: true },
    { id: 'sagittarius', glyph: '♐' + VS, name: 'Sagittarius', element: 'fire',  weight: 4 },
    { id: 'capricorn',   glyph: '♑' + VS, name: 'Capricorn',   element: 'earth', weight: 4 },
    { id: 'aquarius',    glyph: '♒' + VS, name: 'Aquarius',    element: 'air',   weight: 4 },
    { id: 'pisces',      glyph: '♓' + VS, name: 'Pisces',      element: 'water', weight: 4 },
    { id: 'sun',         glyph: '☉',      name: 'Sun',         element: null,    weight: 3 },
    { id: 'moon',        glyph: '☽' + VS, name: 'Moon',        element: null,    weight: 3 }
  ];

  var BY_ID = {};
  SYMBOLS.forEach(function (s) { BY_ID[s.id] = s; });

  // Multipliers are per line, applied to the bet per line.
  var PAYS = {
    serpent: 1000,  // three Ophiuchus on a line
    sun: 130,       // three Suns (Ophiuchus substitutes)
    moon: 70,       // three Moons
    sign: 28,       // three of the same sign
    trine: 4        // three different signs of one element — an "Elemental Trine"
  };

  var FREE_SPINS_SCATTER = 3; // Ophiuchus anywhere on the grid
  var FREE_SPINS_AWARD = 5;

  // ---- Cosmic Eclipse bonus ----
  // Sun, Moon and Ophiuchus together on an active payline (any order) opens the
  // Zodiac Wheel. Its 13 slices follow the true-sky ecliptic; landing on the
  // Ophiuchus slice wins the progressive Mega Jackpot. Other slices pay a
  // multiple of the total bet.
  var ECLIPSE = ['sun', 'moon', 'ophiuchus'];
  var WHEEL = [
    { id: 'aries', mult: 10 }, { id: 'taurus', mult: 25 }, { id: 'gemini', mult: 15 },
    { id: 'cancer', mult: 50 }, { id: 'leo', mult: 20 }, { id: 'virgo', mult: 30 },
    { id: 'libra', mult: 15 }, { id: 'scorpio', mult: 100 }, { id: 'ophiuchus', jackpot: true },
    { id: 'sagittarius', mult: 75 }, { id: 'capricorn', mult: 20 }, { id: 'aquarius', mult: 40 },
    { id: 'pisces', mult: 10 }
  ];
  var JACKPOT_SEED = 1000;        // credits the Mega Jackpot resets to
  var JACKPOT_CONTRIBUTION = 0.02; // share of every paid bet added to the pool

  function spinWheel(rng) { return Math.floor((rng || Math.random)() * WHEEL.length); }

  var ROWS = 3, REELS = 3;

  // Paylines as row index per reel.
  var PAYLINES = [
    { name: 'Middle',   rows: [1, 1, 1] },
    { name: 'Top',      rows: [0, 0, 0] },
    { name: 'Bottom',   rows: [2, 2, 2] },
    { name: 'Descending', rows: [0, 1, 2] },
    { name: 'Ascending',  rows: [2, 1, 0] }
  ];

  var TOTAL_WEIGHT = SYMBOLS.reduce(function (a, s) { return a + s.weight; }, 0);

  function randomSymbol(rng) {
    var r = (rng || Math.random)() * TOTAL_WEIGHT;
    for (var i = 0; i < SYMBOLS.length; i++) {
      r -= SYMBOLS[i].weight;
      if (r < 0) return SYMBOLS[i];
    }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  // grid[reel][row]
  function spinGrid(rng) {
    var grid = [];
    for (var c = 0; c < REELS; c++) {
      grid.push([]);
      for (var r = 0; r < ROWS; r++) grid[c].push(randomSymbol(rng));
    }
    return grid;
  }

  function evaluateLine(syms) {
    var natural = syms.filter(function (s) { return !s.wild; });
    if (natural.length === 0) return { kind: 'serpent', mult: PAYS.serpent, label: 'Serpent Bearer Triple' };

    var first = natural[0];
    var allSame = natural.every(function (s) { return s.id === first.id; });
    if (allSame) {
      if (first.id === 'sun') return { kind: 'sun', mult: PAYS.sun, label: 'Solar Alignment' };
      if (first.id === 'moon') return { kind: 'moon', mult: PAYS.moon, label: 'Lunar Alignment' };
      return { kind: 'sign', mult: PAYS.sign, label: 'Triple ' + first.name };
    }

    var el = first.element;
    if (el && natural.every(function (s) { return s.element === el; })) {
      return { kind: 'trine', mult: PAYS.trine, label: cap(el) + ' Trine' };
    }
    return null;
  }

  function evaluate(grid, lines, betPerLine) {
    var wins = [];
    var total = 0;
    for (var i = 0; i < lines; i++) {
      var pl = PAYLINES[i];
      var syms = pl.rows.map(function (row, reel) { return grid[reel][row]; });
      var res = evaluateLine(syms);
      if (res) {
        var amount = res.mult * betPerLine;
        total += amount;
        wins.push({ line: i, name: pl.name, rows: pl.rows, kind: res.kind, label: res.label, mult: res.mult, amount: amount });
      }
    }
    var scatter = 0;
    grid.forEach(function (col) { col.forEach(function (s) { if (s.wild) scatter++; }); });
    var freeSpins = scatter >= FREE_SPINS_SCATTER ? FREE_SPINS_AWARD : 0;

    var eclipse = null;
    for (var j = 0; j < lines && !eclipse; j++) {
      var ids = PAYLINES[j].rows.map(function (row, reel) { return grid[reel][row].id; });
      if (ECLIPSE.every(function (id) { return ids.indexOf(id) !== -1; })) {
        eclipse = { line: j, name: PAYLINES[j].name, rows: PAYLINES[j].rows };
      }
    }
    return { wins: wins, total: total, scatter: scatter, freeSpins: freeSpins, eclipse: eclipse };
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  return {
    SYMBOLS: SYMBOLS, BY_ID: BY_ID, PAYS: PAYS, PAYLINES: PAYLINES,
    ROWS: ROWS, REELS: REELS,
    FREE_SPINS_SCATTER: FREE_SPINS_SCATTER, FREE_SPINS_AWARD: FREE_SPINS_AWARD,
    WHEEL: WHEEL, ECLIPSE: ECLIPSE, JACKPOT_SEED: JACKPOT_SEED, JACKPOT_CONTRIBUTION: JACKPOT_CONTRIBUTION,
    spinWheel: spinWheel,
    randomSymbol: randomSymbol, spinGrid: spinGrid,
    evaluateLine: evaluateLine, evaluate: evaluate
  };
});
