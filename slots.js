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

  // ---------- audio: a magical-girl style WebAudio synth, no sound files ----------
  // Everything here is original: music-box melodies, harp sweeps, sparkles and
  // anime-style synth brass, all in the bright C Lydian mode.
  var audio = (function () {
    var ctx = null, master, dry, reverbIn, echoIn, noiseBuf;
    var pad = null, twinkleTimer = null, lullabyTimer = null;
    var LYDIAN = [0, 2, 4, 6, 7, 9, 11];

    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    // The nth note of C Lydian counting up from `from` (a MIDI note on C).
    function step(from, n) { return from + 12 * Math.floor(n / 7) + LYDIAN[n % 7]; }

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

      // Big, bright hall reverb from a decaying stereo noise impulse.
      var len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      var conv = ctx.createConvolver(); conv.buffer = ir;
      reverbIn = ctx.createGain(); reverbIn.gain.value = 0.6;
      reverbIn.connect(conv); conv.connect(master);

      var delay = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      delay.delayTime.value = 0.28; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 4500;
      echoIn = ctx.createGain(); echoIn.gain.value = 0.45;
      echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay);
      lp.connect(reverbIn); lp.connect(master);

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;
    }

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
      if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + (o.glideTime || len));
      if (o.glide2) osc.frequency.exponentialRampToValueAtTime(o.glide2, t + len);
      if (o.detune) osc.detune.value = o.detune;
      if (o.vib) {
        var lfo = ctx.createOscillator(), amt = ctx.createGain();
        lfo.frequency.value = o.vib[0]; amt.gain.value = o.vib[1];
        lfo.connect(amt); amt.connect(osc.detune); lfo.start(t); lfo.stop(t + len + 0.05);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.attack || 0.005));
      if (o.hold) g.gain.setValueAtTime(o.vol || 0.1, t + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g); out(g, o.rev == null ? 0.5 : o.rev, o.echo || 0);
      osc.start(t); osc.stop(t + len + 0.05);
    }

    // Music box: a pure tine with a bright metallic overtone and quick decay.
    function musicBox(m, at, vol, echo) {
      vol = vol || 0.08;
      var f = hz(m);
      voice(f, at, 1.6, { vol: vol, rev: 0.55, echo: echo || 0.2 });
      voice(f * 4.02, at, 0.35, { vol: vol * 0.25, rev: 0.6 });
      voice(f * 2, at, 0.8, { vol: vol * 0.2, rev: 0.6, type: 'triangle' });
    }

    // Harp: plucked triangle with a soft octave, used for glissandos.
    function harp(m, at, vol) {
      var f = hz(m);
      voice(f, at, 1.4, { vol: vol || 0.05, type: 'triangle', rev: 0.7, echo: 0.15 });
      voice(f * 2, at, 0.6, { vol: (vol || 0.05) * 0.3, rev: 0.7 });
    }
    function gliss(fromStep, toStep, at, dur, vol) {
      var n = Math.abs(toStep - fromStep), dir = toStep > fromStep ? 1 : -1;
      for (var i = 0; i <= n; i++) harp(step(48, fromStep + i * dir), at + dur * i / n, vol);
    }

    // "Kira" sparkle: tiny very high pings that flick upward.
    function sparkle(at, count, spread, vol) {
      for (var i = 0; i < count; i++) {
        var f = hz(step(84, Math.floor(Math.random() * 10)));
        voice(f, at + Math.random() * spread, 0.35, { vol: vol || 0.03, glide: f * 1.5, glideTime: 0.08, rev: 0.9, echo: 0.3 });
      }
    }

    // Chime tree: a fast descending cascade of bright bells.
    function chimeTree(at, vol) {
      for (var i = 0; i < 16; i++) {
        var f = hz(step(84, 15 - i));
        voice(f, at + i * 0.045, 1.2, { vol: vol || 0.03, rev: 0.9, echo: 0.2 });
        voice(f * 2.76, at + i * 0.045, 0.3, { vol: (vol || 0.03) * 0.3, rev: 0.9 });
      }
    }

    // 90s anime synth brass: detuned saws through a filter that blooms open.
    function brass(notes, at, len, vol) {
      var t = ctx.currentTime + at, lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.exponentialRampToValueAtTime(3800, t + 0.08);
      lp.frequency.exponentialRampToValueAtTime(1400, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.03);
      g.gain.setValueAtTime(vol || 0.05, t + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      lp.connect(g); out(g, 0.5, 0.1);
      notes.forEach(function (m) {
        [-9, 9].forEach(function (d) {
          var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = d;
          o.connect(lp); o.start(t); o.stop(t + len + 0.05);
        });
      });
    }

    function noise(at, len, from, to, vol, q) {
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + at;
      src.buffer = noiseBuf; src.loop = true;
      bp.type = 'bandpass'; bp.Q.value = q || 3;
      bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + len * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(bp); bp.connect(g); out(g, 0.8, 0.2);
      src.start(t); src.stop(t + len + 0.05);
    }

    // A short original melody: [midi, beat] pairs played on the music box.
    function melody(notes, at, beat, vol) {
      var t = at;
      notes.forEach(function (n) { if (n[0]) musicBox(n[0], t, vol); t += n[1] * beat; });
      return t;
    }
    var WIN_TUNE = [[76, 1], [79, 1], [83, 1], [88, 2], [86, 1], [83, 1], [91, 3]];
    var BIG_TUNE = [[72, 1], [76, 1], [79, 1], [84, 2], [83, 1], [79, 1], [83, 2], [86, 1], [88, 1], [90, 1], [91, 4]];
    var LULLABY = [[72, 2], [79, 2], [76, 2], [83, 3], [81, 1], [79, 2], [78, 2], [79, 4]];

    // ---- ambience: a dreamy moonlit pad, twinkles, and a music-box lullaby ----
    function syncAmbience() {
      if (!ctx) return;
      if (ambienceOn() && !pad) startPad();
      if (!ambienceOn() && pad) stopPad();
    }
    function startPad() {
      var g = ctx.createGain(), lp = ctx.createBiquadFilter(), trem = ctx.createOscillator(), tremAmt = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1400;
      trem.frequency.value = 0.18; tremAmt.gain.value = 0.008; trem.connect(tremAmt); tremAmt.connect(g.gain);
      // Cmaj7(#11): the dreamy, floating "magic" chord.
      var oscs = [48, 55, 64, 71, 78].map(function (m, i) {
        var o = ctx.createOscillator(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = hz(m); o.detune.value = (i % 2 ? 5 : -5);
        o.connect(lp); o.start(); return o;
      });
      lp.connect(g); out(g, 1, 0);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 4);
      trem.start();
      pad = { g: g, nodes: oscs.concat([trem]) };
      (function twinkle() {
        if (!pad) return;
        if (Math.random() < 0.5) sparkle(0, 1 + Math.floor(Math.random() * 3), 0.4, 0.012);
        else musicBox(step(84, Math.floor(Math.random() * 8)), 0, 0.015, 0.5);
        twinkleTimer = setTimeout(twinkle, 1000 + Math.random() * 2500);
      })();
      (function lullaby() {
        if (!pad) return;
        if (!spinning) melody(LULLABY, 0, 0.32, 0.02);
        lullabyTimer = setTimeout(lullaby, 18000 + Math.random() * 12000);
      })();
    }
    function stopPad() {
      var p = pad; pad = null; clearTimeout(twinkleTimer); clearTimeout(lullabyTimer);
      p.g.gain.cancelScheduledValues(ctx.currentTime);
      p.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      setTimeout(function () { p.nodes.forEach(function (n) { n.stop(); }); }, 2500);
    }

    function ready() { return ctx && soundOn(); }

    return {
      unlock: unlock,
      sync: function () {
        if (!ctx) { unlock(); return; }
        master.gain.setTargetAtTime(soundOn() ? 0.9 : 0, ctx.currentTime, 0.1);
        syncAmbience();
      },
      // Spin: a magic-wand swish — quick harp sweep up with a sparkle trail.
      spin: function () {
        if (!ready()) return;
        gliss(14, 24, 0, 0.3, 0.04);
        noise(0, 0.6, 3000, 9000, 0.06, 4);
        sparkle(0.2, 6, 0.6, 0.025);
      },
      // Reel stop: a music-box note, rising per reel, with a twinkle.
      stop: function (c) {
        if (!ready()) return;
        musicBox([84, 88, 91][c] || 91, 0, 0.08);
        sparkle(0.02, 2, 0.1, 0.02);
      },
      miss: function () {
        if (!ready()) return;
        musicBox(79, 0.05, 0.035); musicBox(76, 0.3, 0.03);
      },
      // Wins: a music-box tune and a chime tree; big wins add a brass fanfare.
      win: function (big) {
        if (!ready()) return;
        if (big) {
          brass([60, 67, 72, 76], 0, 0.18, 0.045);
          brass([62, 69, 74, 78], 0.22, 0.18, 0.045);
          brass([64, 71, 76, 79], 0.44, 0.9, 0.05);
          melody(BIG_TUNE, 0.5, 0.13, 0.08);
          chimeTree(2.3, 0.03);
          sparkle(0.5, 20, 2.5, 0.022);
        } else {
          melody(WIN_TUNE, 0, 0.11, 0.08);
          chimeTree(0.9, 0.02);
        }
      },
      // Jackpot: a full transformation sequence — harp sweep, glowing chord,
      // brass hits, then the big tune under a storm of sparkles.
      jackpot: function () {
        if (!ready()) return;
        gliss(0, 21, 0, 1.2, 0.05);
        noise(0, 1.4, 400, 8000, 0.08, 2);
        [60, 64, 67, 71, 78, 84].forEach(function (m, i) {
          voice(hz(m), 0.4, 5, { vol: 0.025, attack: 1, hold: 3, type: i < 3 ? 'triangle' : 'sine', vib: [5, 6], rev: 1 });
        });
        brass([60, 67, 72, 76], 1.4, 0.16, 0.05);
        brass([60, 67, 72, 76], 1.62, 0.16, 0.05);
        brass([62, 69, 74, 78], 1.84, 0.16, 0.05);
        brass([67, 72, 76, 79, 84], 2.06, 1.4, 0.055);
        melody(BIG_TUNE, 2.3, 0.13, 0.09);
        chimeTree(1.3, 0.03);
        chimeTree(4.1, 0.03);
        sparkle(0.2, 40, 5, 0.022);
      },
      // Free spins: a spinning tiara — a whirling tone that flies out and back.
      portal: function () {
        if (!ready()) return;
        voice(700, 0, 1.6, { vol: 0.04, glide: 1800, glideTime: 0.8, glide2: 700, vib: [14, 40], rev: 0.8, echo: 0.3 });
        voice(704, 0, 1.6, { vol: 0.03, glide: 1810, glideTime: 0.8, glide2: 705, type: 'triangle', vib: [11, 30], rev: 0.8 });
        noise(0, 0.8, 1500, 7000, 0.05, 6);
        noise(0.8, 0.8, 7000, 1500, 0.05, 6);
        gliss(24, 10, 1.4, 0.5, 0.04);
        sparkle(0, 14, 2, 0.022);
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
