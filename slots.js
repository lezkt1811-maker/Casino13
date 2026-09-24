/* Serpent Bearer Slots — UI. Depends on slots-engine.js (window.SlotsEngine). */
(function () {
  'use strict';
  var E = window.SlotsEngine;

  var START_CREDITS = 1000;
  var BETS = [1, 2, 5, 10, 25];
  var STORE_KEY = 'serpentBearerSlots.v1';
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    credits: $('credits'), totalBet: $('totalBet'), lastWin: $('lastWin'),
    bet: $('bet'), lineCount: $('lineCount'), spin: $('spin'), message: $('message'),
    lines: $('lines'), freeBanner: $('freeBanner'), freeCount: $('freeCount'),
    auto: $('auto'), sound: $('sound'), reset: $('reset'),
    betUp: $('betUp'), betDown: $('betDown'), linesUp: $('linesUp'), linesDown: $('linesDown')
  };
  var strips = Array.prototype.map.call(document.querySelectorAll('.reel .strip'), function (s) { return s; });

  var state = load() || { credits: START_CREDITS, betIdx: 0, lines: E.PAYLINES.length, sound: true };
  var freeSpins = 0;
  var spinning = false;
  var grid = E.spinGrid();

  // ---------- persistence (per-browser convenience only) ----------
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE_KEY)); return s && typeof s.credits === 'number' ? s : null; }
    catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- rendering ----------
  function cellHTML(sym) {
    var cls = 'cell sym-' + sym.id + (sym.element ? ' el-' + sym.element : '');
    return '<div class="' + cls + '"><span class="glyph">' + sym.glyph + '</span><span class="nm">' + sym.name + '</span></div>';
  }

  function renderStatic() {
    strips.forEach(function (strip, c) {
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.innerHTML = grid[c].map(cellHTML).join('');
    });
  }

  function bet() { return BETS[state.betIdx]; }
  function totalBet() { return bet() * state.lines; }

  function updateMeters(win) {
    els.credits.textContent = state.credits.toLocaleString();
    els.bet.textContent = bet();
    els.lineCount.textContent = state.lines;
    els.totalBet.textContent = freeSpins > 0 ? 'FREE' : totalBet().toLocaleString();
    if (win !== undefined) els.lastWin.textContent = win.toLocaleString();
    els.freeBanner.hidden = freeSpins <= 0;
    els.freeCount.textContent = freeSpins;
    var locked = spinning || freeSpins > 0;
    els.betUp.disabled = locked || state.betIdx >= BETS.length - 1;
    els.betDown.disabled = locked || state.betIdx <= 0;
    els.linesUp.disabled = locked || state.lines >= E.PAYLINES.length;
    els.linesDown.disabled = locked || state.lines <= 1;
    els.spin.disabled = spinning;
    els.spin.textContent = freeSpins > 0 ? 'Free Spin' : 'Spin';
    drawLines(null);
  }

  function say(text, cls) {
    els.message.textContent = text;
    els.message.className = 'message' + (cls ? ' ' + cls : '');
  }

  var CENTER = [50, 150, 250];
  function drawLines(wins) {
    var svg = els.lines;
    if (wins) {
      svg.innerHTML = wins.map(function (w) {
        return '<polyline points="' + w.rows.map(function (r, c) { return CENTER[c] + ',' + CENTER[r]; }).join(' ') + '"/>';
      }).join('');
    } else if (!spinning) {
      // preview active paylines faintly
      svg.innerHTML = E.PAYLINES.slice(0, state.lines).map(function (pl) {
        return '<polyline style="opacity:.14" points="' + pl.rows.map(function (r, c) { return CENTER[c] + ',' + CENTER[r]; }).join(' ') + '"/>';
      }).join('');
    } else {
      svg.innerHTML = '';
    }
  }

  function highlight(wins) {
    document.querySelectorAll('.cell.hit').forEach(function (c) { c.classList.remove('hit'); });
    wins.forEach(function (w) {
      w.rows.forEach(function (r, c) { strips[c].children[r].classList.add('hit'); });
    });
  }

  // ---------- spin ----------
  function spin() {
    if (spinning) return;
    var isFree = freeSpins > 0;
    if (!isFree && state.credits < totalBet()) {
      say('Not enough stardust. Lower your bet or refill.');
      els.auto.checked = false;
      return;
    }
    audio.unlock();
    spinning = true;
    if (isFree) freeSpins--; else state.credits -= totalBet();
    say(isFree ? 'The Serpent Bearer spins for you…' : 'The heavens turn…');
    updateMeters(0);
    highlight([]);

    var next = E.spinGrid();
    var cellH = strips[0].parentNode.clientHeight / E.ROWS;
    var stops = strips.map(function (strip, c) {
      return new Promise(function (resolve) {
        var filler = 14 + c * 6;
        var html = next[c].map(cellHTML);
        for (var i = 0; i < filler; i++) html.push(cellHTML(E.randomSymbol()));
        html = html.concat(grid[c].map(cellHTML));
        strip.innerHTML = html.join('');
        var dist = (html.length - E.ROWS) * cellH;
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(' + (-dist) + 'px)';
        strip.offsetHeight; // commit start position before transitioning
        var dur = reduceMotion ? 0 : 900 + c * 380;
        strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(.15,.7,.25,1.04)';
        strip.style.transform = 'translateY(0)';
        setTimeout(function () { audio.tick(c); resolve(); }, dur);
      });
    });

    Promise.all(stops).then(function () {
      grid = next;
      renderStatic();
      settle(isFree);
    });
  }

  function settle(wasFree) {
    var res = E.evaluate(grid, state.lines, bet());
    state.credits += res.total;
    spinning = false;

    if (res.freeSpins) freeSpins += res.freeSpins;
    updateMeters(res.total);
    if (res.wins.length) { drawLines(res.wins); highlight(res.wins); }

    var parts = res.wins.map(function (w) { return w.label + ' ×' + w.mult; });
    var jackpot = res.wins.some(function (w) { return w.kind === 'jackpot'; });
    if (jackpot) {
      say('⛎ SERPENT BEARER JACKPOT! +' + res.total.toLocaleString(), 'win big');
      audio.fanfare(true);
    } else if (res.total > 0) {
      var big = res.total >= totalBet() * 10;
      say(parts.join(' · ') + ' — +' + res.total.toLocaleString(), 'win' + (big ? ' big' : ''));
      audio.fanfare(big);
    } else if (!res.freeSpins) {
      say(pickMiss());
    }
    if (res.freeSpins) {
      say((res.total ? els.message.textContent + ' · ' : '') + res.freeSpins + ' free spins from Ophiuchus!', 'win big');
      if (!res.total) audio.fanfare(true);
    }
    save();

    if (freeSpins > 0 || els.auto.checked) {
      setTimeout(function () {
        if (!spinning && (freeSpins > 0 || els.auto.checked)) spin();
      }, res.total ? 1400 : 600);
    }
  }

  var MISSES = [
    'The stars are not yet aligned.',
    'Mercury is in retrograde. Try again.',
    'The Moon hides her face. Spin again.',
    'The serpent stirs but does not strike.',
    'Thirteen signs, and not one agreed.',
    'The heavens are pondering.'
  ];
  function pickMiss() { return MISSES[Math.floor(Math.random() * MISSES.length)]; }

  // ---------- audio (tiny WebAudio synth, no files) ----------
  var audio = (function () {
    var ctx = null;
    function on() { return els.sound.checked; }
    function unlock() {
      if (!on() || ctx) return;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    function tone(freq, start, len, type, vol) {
      if (!ctx || !on()) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + start;
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + len + 0.02);
    }
    return {
      unlock: unlock,
      tick: function (c) { tone(220 + c * 70, 0, 0.12, 'triangle', 0.18); },
      fanfare: function (big) {
        var notes = big ? [523, 659, 784, 1047, 1319, 1568] : [659, 784, 1047];
        notes.forEach(function (f, i) { tone(f, i * 0.09, 0.35, 'sine', 0.12); tone(f * 2, i * 0.09, 0.2, 'triangle', 0.03); });
      }
    };
  })();

  // ---------- paytable & sign list ----------
  function buildInfo() {
    var S = E.BY_ID, P = E.PAYS;
    var g = function (id) { return S[id].glyph; };
    var rows = [
      [g('ophiuchus') + g('ophiuchus') + g('ophiuchus'), 'Serpent Bearer Jackpot', P.jackpot],
      [g('sun') + g('sun') + g('sun'), 'Solar Alignment', P.sun],
      [g('moon') + g('moon') + g('moon'), 'Lunar Alignment', P.moon],
      [g('scorpio') + g('scorpio') + g('scorpio'), 'Any sign, three times', P.sign],
      [g('aries') + g('leo') + g('sagittarius'), 'Elemental Trine', P.trine]
    ];
    $('paytable').innerHTML = rows.map(function (r) {
      return '<tr><td class="gl">' + r[0] + '</td><td>' + r[1] + '</td><td class="x">×' + r[2] + '</td></tr>';
    }).join('');
    $('fsAward').textContent = E.FREE_SPINS_AWARD;

    $('signs').innerHTML = E.SYMBOLS.filter(function (s) { return s.element || s.wild; }).map(function (s) {
      return '<div class="sign' + (s.wild ? ' oph sym-ophiuchus' : ' el-' + s.element) + '"><span class="glyph">' + s.glyph +
        '</span><small>' + s.name + (s.element ? ' · ' + s.element : ' · wild') + '</small></div>';
    }).join('');
  }

  // ---------- starfield with Ophiuchus ----------
  function starfield() {
    var cv = $('sky'), cx = cv.getContext('2d'), stars = [], w, h, dpr;
    // Rough stick figure of Ophiuchus (normalised coordinates), drawn faintly top-right.
    var oph = [[.50,.05],[.40,.22],[.62,.20],[.33,.48],[.70,.46],[.36,.80],[.66,.78],[.50,.05]];
    var ophEdges = [[0,1],[0,2],[1,3],[2,4],[3,5],[4,6],[1,2],[5,6]];
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      var n = Math.round(w * h / 3500);
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + .2, p: Math.random() * 6.28, s: .5 + Math.random() * 1.5 });
    }
    function frame(t) {
      cx.clearRect(0, 0, w, h);
      stars.forEach(function (s) {
        var a = reduceMotion ? .6 : .35 + .45 * Math.sin(s.p + t / 1000 * s.s);
        cx.fillStyle = 'rgba(255,240,200,' + a.toFixed(3) + ')';
        cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.283); cx.fill();
      });
      var size = Math.min(w, h) * .35, ox = w - size - 10, oy = 30;
      cx.strokeStyle = 'rgba(255,215,0,.12)'; cx.lineWidth = 1;
      ophEdges.forEach(function (e) {
        cx.beginPath();
        cx.moveTo(ox + oph[e[0]][0] * size, oy + oph[e[0]][1] * size);
        cx.lineTo(ox + oph[e[1]][0] * size, oy + oph[e[1]][1] * size);
        cx.stroke();
      });
      cx.fillStyle = 'rgba(255,230,150,.55)';
      oph.forEach(function (p) { cx.beginPath(); cx.arc(ox + p[0] * size, oy + p[1] * size, 2, 0, 6.283); cx.fill(); });
      if (!reduceMotion) requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
  }

  // ---------- wiring ----------
  els.spin.addEventListener('click', spin);
  document.addEventListener('keydown', function (e) {
    if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) { e.preventDefault(); spin(); }
  });
  els.betUp.addEventListener('click', function () { state.betIdx = Math.min(BETS.length - 1, state.betIdx + 1); save(); updateMeters(); });
  els.betDown.addEventListener('click', function () { state.betIdx = Math.max(0, state.betIdx - 1); save(); updateMeters(); });
  els.linesUp.addEventListener('click', function () { state.lines = Math.min(E.PAYLINES.length, state.lines + 1); save(); updateMeters(); });
  els.linesDown.addEventListener('click', function () { state.lines = Math.max(1, state.lines - 1); save(); updateMeters(); });
  els.auto.addEventListener('change', function () { if (els.auto.checked && !spinning) spin(); });
  els.sound.checked = state.sound !== false;
  els.sound.addEventListener('change', function () { state.sound = els.sound.checked; save(); });
  els.reset.addEventListener('click', function () {
    if (spinning) return;
    state.credits = START_CREDITS; freeSpins = 0; save(); updateMeters(0);
    say('Your stardust has been replenished.');
  });

  buildInfo();
  renderStatic();
  updateMeters(0);
  starfield();
})();
