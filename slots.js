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
    auto: $('auto'), sound: $('sound'), ambience: $('ambience'), reset: $('reset'),
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
    audio.spin();
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
        setTimeout(function () { audio.stop(c); resolve(); }, dur);
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
      audio.jackpot();
    } else if (res.total > 0) {
      var big = res.total >= totalBet() * 10;
      say(parts.join(' · ') + ' — +' + res.total.toLocaleString(), 'win' + (big ? ' big' : ''));
      audio.win(big);
    } else if (!res.freeSpins) {
      say(pickMiss());
      audio.miss();
    }
    if (res.freeSpins) {
      say((res.total ? els.message.textContent + ' · ' : '') + res.freeSpins + ' free spins from Ophiuchus!', 'win big');
      audio.portal();
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

  // ---------- audio: a small cosmic WebAudio synth, no sound files ----------
  var audio = (function () {
    var ctx = null, master, dry, reverbIn, echoIn, noiseBuf;
    var drone = null, twinkleTimer = null;
    // A minor pentatonic across several octaves: nothing ever clashes.
    var SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

    function soundOn() { return els.sound.checked; }
    function ambienceOn() { return soundOn() && els.ambience.checked; }

    function unlock() {
      if (!soundOn()) return;
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        build();
      }
      if (ctx.state === 'suspended') ctx.resume();
      syncAmbience();
    }

    function build() {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(ctx.destination);
      dry = ctx.createGain(); dry.connect(master);

      // Long, dark "space hall" reverb from a decaying stereo noise impulse.
      var len = ctx.sampleRate * 4.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      var conv = ctx.createConvolver(); conv.buffer = ir;
      reverbIn = ctx.createGain(); reverbIn.gain.value = 0.7;
      reverbIn.connect(conv); conv.connect(master);

      // Ping-pong-ish echo with a darkening feedback loop.
      var delay = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      delay.delayTime.value = 0.38; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 2600;
      echoIn = ctx.createGain(); echoIn.gain.value = 0.5;
      echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
      lp.connect(reverbIn); lp.connect(master);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    }

    // Route a node to dry, reverb and echo buses.
    function out(node, rev, echo) {
      node.connect(dry);
      if (rev) { var r = ctx.createGain(); r.gain.value = rev; node.connect(r); r.connect(reverbIn); }
      if (echo) { var e = ctx.createGain(); e.gain.value = echo; node.connect(e); e.connect(echoIn); }
    }

    function voice(freq, at, len, o) {
      o = o || {};
      var osc = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + len);
      if (o.detune) osc.detune.value = o.detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g); out(g, o.rev == null ? 0.6 : o.rev, o.echo || 0);
      osc.start(t); osc.stop(t + len + 0.05);
    }

    // Glass/crystal bell: inharmonic partials with fast decay on the upper ones.
    function bell(freq, at, vol, echo) {
      vol = vol || 0.08;
      voice(freq, at, 2.8, { vol: vol, rev: 0.8, echo: echo || 0 });
      voice(freq * 2.76, at, 1.2, { vol: vol * 0.35, rev: 0.8, echo: echo || 0 });
      voice(freq * 5.4, at, 0.5, { vol: vol * 0.15, rev: 0.9 });
      voice(freq * 1.003, at, 2.8, { vol: vol * 0.5, rev: 0.8, type: 'triangle' }); // slow beating shimmer
    }

    function noise(at, len, from, to, vol, q) {
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + at;
      src.buffer = noiseBuf; src.loop = true;
      bp.type = 'bandpass'; bp.Q.value = q || 3;
      bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + len * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(bp); bp.connect(g); out(g, 0.9, 0.2);
      src.start(t); src.stop(t + len + 0.05);
    }

    function pick(lo, hi) { return SCALE[lo + Math.floor(Math.random() * (hi - lo))]; }

    // ---- ambience: a slow drone plus distant twinkling stars ----
    function syncAmbience() {
      if (!ctx) return;
      if (ambienceOn() && !drone) startDrone();
      if (!ambienceOn() && drone) stopDrone();
    }
    function startDrone() {
      var g = ctx.createGain(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 6;
      lfo.frequency.value = 0.05; lfoAmt.gain.value = 350; lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
      var oscs = [[55, 'sawtooth', -6], [55, 'sawtooth', 7], [82.41, 'triangle', 0], [110, 'sine', 3]].map(function (v) {
        var o = ctx.createOscillator(); o.frequency.value = v[0]; o.type = v[1]; o.detune.value = v[2]; o.connect(lp); o.start(); return o;
      });
      lp.connect(g); out(g, 1, 0);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 4);
      lfo.start();
      drone = { g: g, nodes: oscs.concat([lfo]) };
      (function twinkle() {
        if (!drone) return;
        bell(pick(9, SCALE.length), 0, 0.012 + Math.random() * 0.012, 0.6);
        twinkleTimer = setTimeout(twinkle, 900 + Math.random() * 2600);
      })();
    }
    function stopDrone() {
      var d = drone; drone = null; clearTimeout(twinkleTimer);
      d.g.gain.cancelScheduledValues(ctx.currentTime);
      d.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      setTimeout(function () { d.nodes.forEach(function (n) { n.stop(); }); }, 2500);
    }

    function ready() { return ctx && soundOn(); }

    return {
      unlock: unlock,
      sync: function () {
        if (!ctx) { unlock(); return; }
        master.gain.setTargetAtTime(soundOn() ? 0.9 : 0, ctx.currentTime, 0.1);
        syncAmbience();
      },
      // Spin start: a rising nebula whoosh with a sweeping tone underneath.
      spin: function () {
        if (!ready()) return;
        noise(0, 1.1, 250, 5000, 0.18, 2.5);
        voice(110, 0, 1.2, { vol: 0.05, glide: 440, type: 'triangle', rev: 0.8 });
      },
      // Each reel lands with a soft low pulse and a crystal chime, rising per reel.
      stop: function (c) {
        if (!ready()) return;
        voice(90, 0, 0.35, { vol: 0.14, glide: 45, rev: 0.3 });
        bell([659.25, 783.99, 987.77][c] || 880, 0, 0.07, 0.25);
      },
      miss: function () {
        if (!ready()) return;
        voice(329.63, 0, 1.6, { vol: 0.03, glide: 293.66, rev: 1 });
      },
      // Wins: an ascending pentatonic star-cascade; big wins add a sparkle shower.
      win: function (big) {
        if (!ready()) return;
        var n = big ? 10 : 5;
        for (var i = 0; i < n; i++) bell(SCALE[6 + i], i * 0.09, 0.07, 0.35);
        if (big) {
          for (var k = 0; k < 24; k++) bell(pick(10, SCALE.length) * 2, 0.8 + k * 0.06 + Math.random() * 0.05, 0.025, 0.4);
          noise(0.6, 2.5, 2000, 9000, 0.06, 6);
        }
      },
      // Jackpot: a deep cosmic gong, a choir-like pad chord and a meteor shower.
      jackpot: function () {
        if (!ready()) return;
        [55, 55 * 2.4, 55 * 3.9, 55 * 5.3].forEach(function (f, i) { voice(f, 0, 6 - i, { vol: 0.12 / (i + 1), rev: 1 }); });
        [220, 277.18, 329.63, 440, 554.37].forEach(function (f, i) {
          voice(f, 0.3, 5, { vol: 0.03, attack: 1.2, type: 'sawtooth', detune: (i % 2 ? 8 : -8), rev: 1 });
        });
        this.win(true);
        for (var k = 0; k < 16; k++) voice(3000 + Math.random() * 3000, 1 + k * 0.18, 0.6, { vol: 0.02, glide: 400, rev: 1, echo: 0.3 });
      },
      // Free spins: a swirling portal opening.
      portal: function () {
        if (!ready()) return;
        voice(1400, 0, 2.2, { vol: 0.05, glide: 180, type: 'triangle', rev: 1, echo: 0.4 });
        voice(1410, 0.05, 2.2, { vol: 0.05, glide: 175, rev: 1, echo: 0.4 });
        noise(0, 2, 6000, 300, 0.1, 8);
        for (var i = 0; i < 6; i++) bell(SCALE[15 - i], 1 + i * 0.12, 0.05, 0.4);
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
  els.sound.addEventListener('change', function () { state.sound = els.sound.checked; save(); audio.sync(); });
  els.ambience.checked = state.ambience !== false;
  els.ambience.addEventListener('change', function () { state.ambience = els.ambience.checked; save(); audio.sync(); });
  // Browsers only allow audio after a user gesture; start the ambience on the first one.
  document.addEventListener('pointerdown', function first() { audio.unlock(); document.removeEventListener('pointerdown', first); });
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
