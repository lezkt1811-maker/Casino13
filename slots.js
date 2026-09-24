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
    betUp: $('betUp'), betDown: $('betDown'), linesUp: $('linesUp'), linesDown: $('linesDown'),
    jackpot: $('jackpot'), jackpotMeter: document.querySelector('.jackpot-meter'),
    forceEclipse: $('forceEclipse'), forceMega: $('forceMega')
  };
  var strips = Array.prototype.map.call(document.querySelectorAll('.reel .strip'), function (s) { return s; });

  var state = load() || { credits: START_CREDITS, betIdx: 0, lines: E.PAYLINES.length, sound: true };
  if (typeof state.jackpot !== 'number') state.jackpot = E.JACKPOT_SEED;
  var freeSpins = 0;
  var spinning = false;
  var bonusActive = false;
  var forced = null; // demo: 'eclipse' or 'mega' forces the next spin
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

  // The pool grows by fractions of a credit, so show cents like a real progressive.
  function fmtJackpot(v) { return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

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
    els.spin.disabled = spinning || bonusActive;
    els.jackpot.textContent = fmtJackpot(state.jackpot);
    els.spin.textContent = freeSpins > 0 ? 'Free Spin' : 'Spin';
    drawLines(null);
  }

  // Count the Win meter up from 0 while the coins pour out.
  var rollTimer = null;
  function rollUp(amount, dur) {
    cancelAnimationFrame(rollTimer);
    var start = performance.now(), ms = reduceMotion ? 1 : dur * 1000;
    (function tick(now) {
      var t = Math.min(1, (now - start) / ms);
      els.lastWin.textContent = Math.round(amount * t).toLocaleString();
      if (t < 1) rollTimer = requestAnimationFrame(tick);
    })(start);
  }

  function say(text, cls) {
    els.message.textContent = text;
    els.message.className = 'message' + (cls ? ' ' + cls : '');
  }

  var CENTER = [50, 150, 250];
  var LINE_DEFS = '<defs><linearGradient id="rainbowLine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">' +
    ['#ff2bd6', '#ff7a1a', '#ffe600', '#7dff3a', '#00f0ff', '#9d4dff'].map(function (c, i) {
      return '<stop offset="' + (i / 5) + '" stop-color="' + c + '"/>';
    }).join('') + '</linearGradient></defs>';
  function drawLines(wins) {
    var svg = els.lines;
    if (wins) {
      svg.innerHTML = LINE_DEFS + wins.map(function (w) {
        return '<polyline points="' + w.rows.map(function (r, c) { return CENTER[c] + ',' + CENTER[r]; }).join(' ') + '"/>';
      }).join('');
    } else if (!spinning) {
      // preview active paylines faintly
      svg.innerHTML = E.PAYLINES.slice(0, state.lines).map(function (pl) {
        return '<polyline class="preview" points="' + pl.rows.map(function (r, c) { return CENTER[c] + ',' + CENTER[r]; }).join(' ') + '"/>';
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
    if (spinning || bonusActive) return;
    var isFree = freeSpins > 0;
    if (!isFree && state.credits < totalBet()) {
      say('Not enough stardust. Lower your bet or refill.');
      els.auto.checked = false;
      return;
    }
    audio.unlock();
    audio.spin();
    spinning = true;
    if (isFree) freeSpins--;
    else {
      state.credits -= totalBet();
      state.jackpot += totalBet() * E.JACKPOT_CONTRIBUTION;
      els.jackpotMeter.classList.remove('bump'); void els.jackpotMeter.offsetWidth; els.jackpotMeter.classList.add('bump');
    }
    say(isFree ? 'The Serpent Bearer spins for you…' : 'The heavens turn…');
    updateMeters(0);
    highlight([]);

    var mode = forced; forced = null; armDemo();
    var next = mode ? eclipseGrid() : E.spinGrid();
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
      settle(isFree, mode);
    });
  }

  // Demo helper: a random grid with Sun, Moon and Ophiuchus shuffled onto the middle line.
  function eclipseGrid() {
    var g = E.spinGrid(), ids = E.ECLIPSE.slice().sort(function () { return Math.random() - 0.5; });
    ids.forEach(function (id, reel) { g[reel][1] = E.BY_ID[id]; });
    return g;
  }

  function continueAuto(delay) {
    if (freeSpins > 0 || els.auto.checked) {
      setTimeout(function () {
        if (!spinning && !bonusActive && (freeSpins > 0 || els.auto.checked)) spin();
      }, delay);
    }
  }

  function settle(wasFree, mode) {
    var res = E.evaluate(grid, state.lines, bet());
    state.credits += res.total;
    spinning = false;

    if (res.freeSpins) freeSpins += res.freeSpins;
    updateMeters(res.total);
    if (res.wins.length) { drawLines(res.wins); highlight(res.wins); }

    var parts = res.wins.map(function (w) { return w.label + ' ×' + w.mult; });
    var serpent = res.wins.some(function (w) { return w.kind === 'serpent'; });
    if (serpent) {
      say('⛎ SERPENT BEARER TRIPLE! +' + res.total.toLocaleString(), 'win big');
      audio.jackpot();
    } else if (res.total > 0) {
      var big = res.total >= totalBet() * 10;
      say(parts.join(' · ') + ' — +' + res.total.toLocaleString(), 'win' + (big ? ' big' : ''));
      var rollDur = Math.min(4, 1 + (res.total / totalBet()) * 0.1);
      rollUp(res.total, rollDur);
      audio.win(big, res.total / totalBet(), rollDur);
    } else if (!res.freeSpins && !res.eclipse) {
      say(pickMiss());
      audio.miss();
    }
    if (res.freeSpins) {
      say((res.total ? els.message.textContent + ' · ' : '') + res.freeSpins + ' free spins from Ophiuchus!', 'win big');
      audio.portal();
    }
    save();

    if (res.eclipse) {
      bonusActive = true;
      updateMeters(res.total);
      drawLines(res.wins.concat([res.eclipse]));
      highlight(res.wins.concat([res.eclipse]));
      say('☉ ☽ ⛎ COSMIC ECLIPSE! The Zodiac Wheel awakens…', 'win big');
      audio.eclipse();
      setTimeout(function () { openWheel(mode === 'mega'); }, 1600);
      return;
    }
    continueAuto(res.total ? 1400 : 600);
  }

  // ---------- Cosmic Eclipse: the Zodiac Wheel ----------
  var wheelRot = 0, wheelBuilt = false;
  var SLICE = 360 / E.WHEEL.length;

  function polar(r, deg) { var a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }

  function buildWheel() {
    var svg = $('wheel'), parts = [];
    parts.push('<defs><radialGradient id="megaSlice"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ffe600"/>' +
      '<stop offset="1" stop-color="#ff2bd6"/></radialGradient></defs>');
    parts.push('<circle r="106" fill="#05010f" stroke="url(#megaSlice)" stroke-width="3"/>');
    parts.push('<g class="rotor" id="rotor">');
    E.WHEEL.forEach(function (sl, i) {
      var a0 = i * SLICE - SLICE / 2, a1 = a0 + SLICE;
      var p0 = polar(100, a0), p1 = polar(100, a1);
      var fill = sl.jackpot ? 'url(#megaSlice)' : 'hsl(' + Math.round(i * 360 / E.WHEEL.length) + ',100%,' + (i % 2 ? 42 : 52) + '%)';
      var gp = polar(80, i * SLICE), tp = polar(56, i * SLICE);
      var label = sl.jackpot ? 'MEGA' : '×' + sl.mult;
      parts.push('<g id="slice' + i + '"><path d="M0 0L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
        'A100 100 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + 'Z" fill="' + fill + '" stroke="#05010f" stroke-width="1.5"/>' +
        '<text class="glyph-t" x="' + gp[0].toFixed(2) + '" y="' + gp[1].toFixed(2) + '" transform="rotate(' + (i * SLICE) + ' ' + gp[0].toFixed(2) + ' ' + gp[1].toFixed(2) + ')">' +
        E.BY_ID[sl.id].glyph + '</text>' +
        '<text class="prize" x="' + tp[0].toFixed(2) + '" y="' + tp[1].toFixed(2) + '" transform="rotate(' + (i * SLICE) + ' ' + tp[0].toFixed(2) + ' ' + tp[1].toFixed(2) + ')">' +
        label + '</text></g>');
    });
    parts.push('</g>');
    svg.innerHTML = parts.join('');
    wheelBuilt = true;
  }

  var wheelMega = false, wheelDone = null;
  function openWheel(mega) {
    if (!wheelBuilt) buildWheel();
    wheelMega = mega;
    wheelDone = null;
    document.querySelectorAll('#wheel .win-slice').forEach(function (n) { n.classList.remove('win-slice'); });
    $('bonusJackpot').textContent = fmtJackpot(state.jackpot);
    $('bonusResult').textContent = '';
    $('wheelSpin').textContent = 'Spin the wheel';
    $('wheelSpin').disabled = false;
    $('bonus').hidden = false;
    $('wheelSpin').focus();
    if (els.auto.checked || freeSpins > 0) setTimeout(spinWheel, 1200);
  }

  function spinWheel() {
    if (wheelDone) { closeWheel(); return; }
    if ($('wheelSpin').disabled) return;
    $('wheelSpin').disabled = true;
    var k = wheelMega ? E.WHEEL.findIndex(function (s) { return s.jackpot; }) : E.spinWheel();
    var target = -k * SLICE + (Math.random() - 0.5) * SLICE * 0.7;
    var delta = ((target - wheelRot) % 360 + 360) % 360 + 360 * 6;
    wheelRot += delta;
    var dur = reduceMotion ? 10 : 5500;
    $('rotor').style.transform = 'rotate(' + wheelRot + 'deg)';
    audio.wheel(dur / 1000, Math.round(delta / SLICE));
    setTimeout(function () { wheelLanded(k); }, dur + 200);
  }

  function wheelLanded(k) {
    var slice = E.WHEEL[k];
    $('slice' + k).classList.add('win-slice');
    var btn = $('wheelSpin');
    if (slice.jackpot) {
      var amount = Math.floor(state.jackpot);
      state.credits += amount;
      state.jackpot = E.JACKPOT_SEED;
      save();
      $('bonusResult').textContent = '⛎ MEGA JACKPOT!';
      wheelDone = 'mega';
      setTimeout(function () { $('bonus').hidden = true; openMega(amount); }, 1100);
      return;
    }
    var win = slice.mult * totalBet();
    state.credits += win;
    save();
    $('bonusResult').textContent = E.BY_ID[slice.id].name + ' ×' + slice.mult + ' — +' + win.toLocaleString();
    rollUp(win, 2.5);
    audio.win(true, slice.mult, 2.5);
    wheelDone = 'win';
    btn.textContent = 'Collect';
    btn.disabled = false;
    btn.focus();
    say('Zodiac Wheel: ' + E.BY_ID[slice.id].name + ' ×' + slice.mult + ' — +' + win.toLocaleString(), 'win big');
    if (els.auto.checked || freeSpins > 0) setTimeout(function () { if (!$('bonus').hidden) closeWheel(); }, 3000);
  }

  function closeWheel() {
    $('bonus').hidden = true;
    finishBonus();
  }

  function finishBonus() {
    bonusActive = false;
    wheelDone = null;
    updateMeters();
    els.spin.focus();
    continueAuto(900);
  }

  // ---------- Mega Jackpot celebration ----------
  var confettiStop = null;
  function openMega(amount) {
    var box = $('mega');
    box.hidden = false;
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
    say('⛎ MEGA JACKPOT! +' + amount.toLocaleString(), 'win big');
    els.lastWin.textContent = amount.toLocaleString();
    audio.mega();
    confettiStop = confetti($('confetti'));
    var start = performance.now(), dur = reduceMotion ? 1 : 3500, el = $('megaAmount');
    (function count(now) {
      var t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = '+' + Math.floor(amount * eased).toLocaleString();
      if (t < 1 && !box.hidden) requestAnimationFrame(count);
    })(start);
    $('megaCollect').focus();
    if (els.auto.checked || freeSpins > 0) setTimeout(function () { if (!box.hidden) closeMega(); }, 9000);
  }
  function closeMega() {
    $('mega').hidden = true;
    if (confettiStop) { confettiStop(); confettiStop = null; }
    finishBonus();
  }

  // Coins, rainbow sparks and neon firework bursts on a full-screen canvas.
  function confetti(cv) {
    var cx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w, h, parts = [], running = true, last = performance.now();
    function size() { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size();
    function coin() {
      parts.push({ k: 'coin', x: Math.random() * w, y: -20, vx: (Math.random() - .5) * 60, vy: 80 + Math.random() * 160,
        r: 7 + Math.random() * 6, spin: Math.random() * 6, vs: 4 + Math.random() * 6, life: 99 });
    }
    function burst(x, y) {
      var hue = Math.random() * 360, n = 46;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2, sp = 120 + Math.random() * 180;
        parts.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hue: (hue + i * 8) % 360, life: 1.2 + Math.random() * .6, age: 0 });
      }
    }
    var nextBurst = 0, t0 = last;
    function frame(now) {
      if (!running) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      var elapsed = (now - t0) / 1000;
      if (elapsed < 7) { for (var c = 0; c < 3; c++) if (Math.random() < .6) coin(); }
      if (elapsed > nextBurst && elapsed < 8) { burst(w * (.15 + Math.random() * .7), h * (.12 + Math.random() * .4)); nextBurst = elapsed + .35 + Math.random() * .5; }
      cx.clearRect(0, 0, w, h);
      cx.globalCompositeOperation = 'lighter';
      parts = parts.filter(function (p) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'coin') {
          p.vy += 260 * dt; p.spin += p.vs * dt;
          var sx = Math.abs(Math.cos(p.spin));
          cx.save(); cx.translate(p.x, p.y); cx.scale(Math.max(.15, sx), 1);
          var g = cx.createRadialGradient(-p.r * .3, -p.r * .3, 1, 0, 0, p.r);
          g.addColorStop(0, '#fffbe0'); g.addColorStop(.5, '#ffd700'); g.addColorStop(1, '#b8860b');
          cx.fillStyle = g; cx.shadowColor = '#ffe600'; cx.shadowBlur = 12;
          cx.beginPath(); cx.arc(0, 0, p.r, 0, 6.283); cx.fill();
          cx.restore();
          return p.y < h + 30;
        }
        p.age += dt; p.vx *= .985; p.vy = p.vy * .985 + 120 * dt;
        var a = Math.max(0, 1 - p.age / p.life);
        cx.fillStyle = 'hsla(' + p.hue + ',100%,65%,' + a + ')';
        cx.shadowColor = 'hsl(' + p.hue + ',100%,60%)'; cx.shadowBlur = 10;
        cx.beginPath(); cx.arc(p.x, p.y, 2.4, 0, 6.283); cx.fill();
        return p.age < p.life;
      });
      cx.globalCompositeOperation = 'source-over'; cx.shadowBlur = 0;
      requestAnimationFrame(frame);
    }
    if (!reduceMotion) requestAnimationFrame(frame);
    window.addEventListener('resize', size);
    return function () { running = false; window.removeEventListener('resize', size); cx.clearRect(0, 0, w, h); };
  }

  // ---------- demo controls ----------
  function armDemo() {
    els.forceEclipse.classList.toggle('armed', forced === 'eclipse');
    els.forceMega.classList.toggle('armed', forced === 'mega');
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

  // ---------- audio: sparkles, fireworks and coins — a WebAudio synth, no sound files ----------
  var audio = (function () {
    var ctx = null, master, dry, reverbIn, echoIn, noiseBuf;
    var pad = null, twinkleTimer = null;
    var LYDIAN = [0, 2, 4, 6, 7, 9, 11];

    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function step(from, n) { return from + 12 * Math.floor(n / 7) + LYDIAN[n % 7]; }
    function rand(a, b) { return a + Math.random() * (b - a); }

    function soundOn() { return els.sound.checked; }
    function ambienceOn() { return soundOn() && els.ambience.checked; }

    function unlock() {
      if (!soundOn()) return;
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        build();
        renderCoinBank();
      }
      if (ctx.state === 'suspended') ctx.resume();
      syncAmbience();
    }

    function build() {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 5;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(ctx.destination);
      dry = ctx.createGain(); dry.connect(master);

      var len = ctx.sampleRate * 3, ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
      }
      var conv = ctx.createConvolver(); conv.buffer = ir;
      reverbIn = ctx.createGain(); reverbIn.gain.value = 0.55;
      reverbIn.connect(conv); conv.connect(master);

      var delay = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
      delay.delayTime.value = 0.25; fb.gain.value = 0.35; lp.type = 'lowpass'; lp.frequency.value = 5000;
      echoIn = ctx.createGain(); echoIn.gain.value = 0.4;
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
      if (o.vib) {
        var lfo = ctx.createOscillator(), amt = ctx.createGain();
        lfo.frequency.value = o.vib[0]; amt.gain.value = o.vib[1];
        lfo.connect(amt); amt.connect(osc.detune); lfo.start(t); lfo.stop(t + len + 0.05);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.attack || 0.005));
      if (o.hold) g.gain.setValueAtTime(o.vol || 0.1, t + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g); out(g, o.rev == null ? 0.4 : o.rev, o.echo || 0);
      osc.start(t); osc.stop(t + len + 0.05);
    }

    // Filtered noise burst. type: 'bandpass' | 'lowpass' | 'highpass'.
    function noise(at, len, from, to, vol, o) {
      o = o || {};
      var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + at;
      src.buffer = noiseBuf; src.loop = true;
      src.playbackRate.value = o.rate || 1;
      f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + len);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f); f.connect(g); out(g, o.rev == null ? 0.5 : o.rev, o.echo || 0);
      src.start(t, Math.random() * 1.5); src.stop(t + len + 0.05);
    }

    // ---- sparkles ----
    // A glittery "kira": tiny high pings flicking upward, plus a hiss of fairy dust.
    function sparkle(at, count, spread, vol) {
      vol = vol || 0.03;
      for (var i = 0; i < count; i++) {
        var f = hz(step(88, Math.floor(Math.random() * 10))), t = at + Math.random() * spread;
        voice(f, t, 0.12, { vol: vol, glide: f * 1.6, glideTime: 0.05, rev: 0.4, echo: 0.15 });
      }
    }

    // ---- coins ----
    // ---- coins ----
    // Realistic coin sounds are pre-rendered once into a small bank of clips
    // (OfflineAudioContext), then played back cheaply with random pitch.
    //  - 'land':   a coin clanking into a metal payout tray
    //  - 'bounce': a coin dropped on a hard surface — bounces that come faster
    //              and faster, then the spinning rattle as it settles flat
    // Each coin rings with the inharmonic modes of a thin metal disc, with
    // slightly split mode pairs that give the shimmering "ching" of real coins.
    var coinBank = { land: [], bounce: [] };

    function renderCoinBank() {
      if (!window.OfflineAudioContext) return;
      var sr = ctx.sampleRate;
      function one(kind) {
        var len = kind === 'bounce' ? 1.6 : 0.8;
        var oc = new OfflineAudioContext(1, Math.ceil(sr * len), sr);
        var nb = oc.createBuffer(1, Math.ceil(sr * 0.03), sr), nd = nb.getChannelData(0);
        for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        function partial(t, f, amp, decay) {
          var o = oc.createOscillator(), g = oc.createGain();
          o.frequency.value = f;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(amp, t + 0.0015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          o.connect(g); g.connect(oc.destination);
          o.start(t); o.stop(t + decay + 0.01);
        }
        function click(t, amp, hp) {
          var src = oc.createBufferSource(), f = oc.createBiquadFilter(), g = oc.createGain();
          src.buffer = nb; f.type = 'highpass'; f.frequency.value = hp || 2500;
          g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
          src.connect(f); f.connect(g); g.connect(oc.destination); src.start(t);
        }
        // A struck coin: thin-disc mode ratios, the first two split into pairs.
        function coin(t, f, amp, ring) {
          [[1, 1, 0.5], [1.72, 0.7, 0.34], [2.31, 0.5, 0.22], [3.07, 0.32, 0.14], [3.92, 0.2, 0.09]].forEach(function (m, k) {
            partial(t, f * m[0], amp * m[1], m[2] * ring);
            if (k < 2) partial(t, f * m[0] * 1.0035, amp * m[1] * 0.6, m[2] * ring);
          });
          click(t, amp * 0.9);
        }
        // A pressed-steel payout tray: low, short metallic clank.
        function tray(t, amp) {
          [[310, 1, 0.26], [742, 0.75, 0.2], [1190, 0.55, 0.15], [1960, 0.35, 0.1], [2870, 0.22, 0.07]].forEach(function (m) {
            partial(t, m[0] * rand(0.97, 1.03), amp * m[1], m[2]);
          });
          click(t, amp * 0.8, 800);
        }
        var f = rand(3900, 6100);
        if (kind === 'land') {
          tray(0, 0.22);
          coin(0, f, 0.28, 0.8);
          coin(rand(0.035, 0.06), f, 0.12, 0.5);            // small rebound
          if (Math.random() < 0.6) coin(rand(0.008, 0.02), rand(3900, 6100), 0.1, 0.4); // clacks another coin
        } else {
          var t = 0, gap = rand(0.11, 0.16), v = 0.34;
          for (var b = 0; b < 5; b++) { coin(t, f, v, 1); t += gap; gap *= 0.62; v *= 0.64; }
          var r = 0.042;
          while (r > 0.007) { coin(t, f, v * 0.55, 0.22); t += r; r *= 0.84; }
        }
        return oc.startRendering();
      }
      ['land', 'land', 'land', 'land', 'land', 'land', 'land', 'land', 'bounce', 'bounce', 'bounce', 'bounce'].forEach(function (k) {
        var pr = one(k);
        if (pr && pr.then) pr.then(function (buf) { coinBank[k].push(buf); }).catch(function () {});
      });
    }

    function playCoin(kind, at, vol) {
      var bank = coinBank[kind];
      if (!bank.length) return false;
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = bank[Math.floor(Math.random() * bank.length)];
      src.playbackRate.value = rand(0.9, 1.1);
      g.gain.value = vol;
      src.connect(g); out(g, 0.12, 0);
      src.start(ctx.currentTime + at);
      return true;
    }

    // One coin landing in the tray (falls back to a live-synth clink while the bank renders).
    function clink(at, vol) {
      vol = vol || 0.07;
      if (playCoin('land', at, vol * 9)) return;
      var f = rand(3900, 6100);
      noise(at, 0.012, 8000, 6000, vol * 1.5, { type: 'highpass', rev: 0.05 });
      [[1, 1, 0.3], [1.72, 0.7, 0.2], [2.31, 0.5, 0.13], [3.07, 0.32, 0.08]].forEach(function (pt) {
        voice(f * pt[0], at, pt[2], { vol: vol * pt[1], rev: 0.1 });
      });
    }
    function coinBounce(at, vol) { if (!playCoin('bounce', at, (vol || 0.07) * 9)) clink(at, vol); }

    // Cash-register "ka-ching": a bright blip into a ringing cha-ching, with coins.
    function kaching(at, vol) {
      vol = vol || 0.07;
      voice(1568, at, 0.06, { type: 'square', vol: vol * 0.6, rev: 0.1 });
      voice(2093, at + 0.06, 0.4, { type: 'square', vol: vol * 0.75, hold: 0.07, rev: 0.2 });
      clink(at + 0.06, vol * 1.2);
      clink(at + 0.11, vol);
    }
    // Slot-machine hopper payout: coins clanking into the tray in a steady,
    // slightly irregular stream (about 12 a second), with a coin now and then
    // bouncing and spinning out on its own.
    function coinDrop(at, dur, vol) {
      var t = at;
      vol = vol || 0.07;
      while (t < at + dur) {
        clink(t, vol * rand(0.65, 1));
        if (Math.random() < 0.3) clink(t + rand(0.02, 0.045), vol * rand(0.4, 0.7));
        if (Math.random() < 0.08) coinBounce(t + rand(0, 0.05), vol * 0.8);
        t += rand(0.06, 0.1);
      }
      coinBounce(at + dur + 0.05, vol);
    }
    // A loose spill of coins; density thins out toward the end.
    function coinShower(at, count, dur, vol) {
      for (var i = 0; i < count; i++) clink(at + dur * Math.pow(Math.random(), 1.6), (vol || 0.06) * rand(0.4, 0.9));
    }

    // ---- slot machine credit tally ----
    // One electronic "ding": a bright sine with a touch of square for that
    // cabinet-speaker edge, decaying fast so rapid dings stay crisp.
    function ding(m, at, vol) {
      vol = vol || 0.2;
      var f = hz(m);
      voice(f, at, 0.14, { vol: vol, rev: 0.12 });
      voice(f * 2, at, 0.07, { vol: vol * 0.3, type: 'triangle', rev: 0.1 });
      voice(f, at, 0.05, { vol: vol * 0.18, type: 'square', rev: 0.05 });
    }
    // The credit meter tally: "ding-ding-ding-ding" about 16 times a second
    // for as long as the Win meter counts up, cycling a major arpeggio that
    // climbs a semitone every eight dings to build excitement.
    function tally(at, dur, vol) {
      var pattern = [0, 4, 7, 12], n = Math.max(4, Math.round(dur * 16));
      for (var i = 0; i < n; i++) ding(79 + pattern[i % 4] + Math.floor(i / 8), at + i / 16, vol || 0.2);
    }
    // The payout-complete jingle: a quick rising arpeggio into a held chord.
    function winJingle(at, big, lift) {
      var k = lift || 0;
      [79, 84, 88, 91].forEach(function (m, i) { ding(m + k, at + i * 0.07, 0.22); });
      [84, 88, 91].forEach(function (m) {
        voice(hz(m + k), at + 0.3, big ? 0.9 : 0.55, { vol: 0.1, hold: big ? 0.45 : 0.2, rev: 0.25 });
        voice(hz(m + k), at + 0.3, big ? 0.9 : 0.55, { vol: 0.025, type: 'square', hold: big ? 0.45 : 0.2, rev: 0.2 });
      });
      if (big) [91, 96].forEach(function (m, i) { ding(m + k, at + 0.35 + i * 0.12, 0.2); });
    }

    // ---- explosions ----
    function boom(at, size) {
      size = size || 1;
      noise(at, 1.2 * size, 2500, 60, 0.35 * Math.min(size, 1.4), { type: 'lowpass', q: 0.7, rev: 0.7, rate: 0.6 });
      voice(90, at, 0.9 * size, { vol: 0.4 * Math.min(size, 1.3), glide: 28, rev: 0.4 });
      noise(at, 0.25, 6000, 1500, 0.12, { type: 'bandpass', q: 0.8, rev: 0.6 }); // initial crack
    }
    // Firework crackle: dozens of tiny pops scattered after the burst.
    function crackle(at, count, dur, vol) {
      for (var i = 0; i < count; i++) {
        var t = at + Math.random() * dur, f = rand(1500, 6000);
        noise(t, 0.035, f, f * 0.8, (vol || 0.08) * rand(0.4, 1), { type: 'bandpass', q: 2, rev: 0.7 });
      }
    }
    // A full firework: whistle up, bang, crackle and sparkle rain.
    function firework(at, size) {
      var up = rand(0.55, 0.8);
      voice(rand(500, 700), at, up, { vol: 0.03, glide: rand(2200, 3000), vib: [18, 30], rev: 0.6 });
      noise(at, up, 800, 3000, 0.04, { q: 4, rev: 0.5 });
      boom(at + up, size || 1);
      crackle(at + up + 0.15, 30, 1.6, 0.07);
      sparkle(at + up + 0.1, 12, 1.4, 0.025);
    }

    // 90s anime synth brass hits.
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

    // ---- ambience: just soft sparkles drifting in and out (no hum or drone) ----
    function syncAmbience() {
      if (!ctx) return;
      if (ambienceOn() && !pad) startPad();
      if (!ambienceOn() && pad) stopPad();
    }
    function startPad() {
      pad = true;
      (function twinkle() {
        if (!pad) return;
        sparkle(0, 1 + Math.floor(Math.random() * 3), 0.8, 0.01);
        twinkleTimer = setTimeout(twinkle, 1200 + Math.random() * 2500);
      })();
    }
    function stopPad() { pad = null; clearTimeout(twinkleTimer); }

    function ready() { return ctx && soundOn(); }

    return {
      unlock: unlock,
      sync: function () {
        if (!ctx) { unlock(); return; }
        master.gain.setTargetAtTime(soundOn() ? 0.9 : 0, ctx.currentTime, 0.1);
        syncAmbience();
      },
      // Spin: a magic swoosh trailing glitter.
      spin: function () {
        if (!ready()) return;
        noise(0, 0.7, 600, 9000, 0.12, { q: 1.5, attack: 0.25, rev: 0.6 });
        sparkle(0.1, 12, 0.8, 0.028);
      },
      // Reel stop: a solid thud with a puff of sparkles.
      stop: function (c) {
        if (!ready()) return;
        voice(160, 0, 0.12, { vol: 0.18, glide: 70, rev: 0 });
        noise(0, 0.05, 3000, 900, 0.07, { type: 'lowpass', rev: 0 });
        sparkle(0.02, 2 + c, 0.15, 0.02);
      },
      miss: function () {
        if (!ready()) return;
        noise(0, 0.5, 2500, 400, 0.04, { q: 1, attack: 0.1, rev: 0.6 });
      },
      // Wins: ka-ching plus a coin spill sized to the win; big wins get fireworks.
      // Wins: ka-ching, then a hopper of coins pouring out while the Win meter
      // rolls up. Big wins add fireworks and brass over the coins.
      win: function (big, times, dur) {
        if (!ready()) return;
        dur = dur || 1;
        tally(0.05, dur);
        winJingle(dur + 0.1, big, Math.floor(dur * 2));
        if (big) {
          firework(dur + 0.4, 0.8);
          firework(dur + 0.9, 0.7);
        }
      },
      // Jackpot: a barrage of fireworks, a giant blast and an avalanche of coins.
      jackpot: function () {
        if (!ready()) return;
        boom(0, 1.6);
        sparkle(0, 40, 1.5, 0.03);
        brass([60, 67, 72, 76], 0.3, 0.16, 0.05);
        brass([60, 67, 72, 76], 0.52, 0.16, 0.05);
        brass([62, 69, 74, 78], 0.74, 0.16, 0.05);
        brass([67, 72, 76, 79, 84], 0.96, 1.4, 0.055);
        for (var i = 0; i < 6; i++) firework(0.6 + i * 0.55 + Math.random() * 0.2, rand(0.8, 1.3));
        tally(0.9, 4);
        winJingle(5, true, 8);
        sparkle(1, 80, 5, 0.025);
      },
      // Cosmic Eclipse: the light drains away with a deep rumble, then a
      // shimmering swell and a burst of sparkles as the wheel appears.
      eclipse: function () {
        if (!ready()) return;
        voice(220, 0, 1.4, { vol: 0.08, glide: 55, type: 'sawtooth', rev: 0.8 });
        noise(0, 1.4, 4000, 150, 0.12, { type: 'lowpass', attack: 0.3, rev: 0.8 });
        boom(0.9, 1.1);
        [60, 67, 71, 74, 78].forEach(function (m, i) {
          voice(hz(m), 1.0 + i * 0.06, 1.6, { vol: 0.03, attack: 0.3, type: 'triangle', vib: [6, 10], rev: 1 });
        });
        sparkle(1.0, 30, 1.2, 0.03);
      },
      // Wheel: a ratchet click for every slice passed, slowing with the wheel.
      wheel: function (dur, slices) {
        if (!ready()) return;
        var n = Math.min(slices, 90);
        for (var i = 1; i <= n; i++) {
          var t = dur * (1 - Math.pow(1 - i / n, 1 / 3)) * 0.98;
          noise(t, 0.03, 3500, 2500, 0.07, { q: 3, rev: 0.2 });
          voice(1800, t, 0.03, { vol: 0.03, type: 'square', rev: 0.1 });
        }
        noise(0, 0.6, 500, 4000, 0.06, { q: 1.2, rev: 0.5 });
      },
      // Mega Jackpot: everything at once, and then more of it.
      mega: function () {
        if (!ready()) return;
        this.jackpot();
        boom(0, 2);
        for (var i = 0; i < 6; i++) firework(4 + i * 0.5 + Math.random() * 0.3, rand(0.9, 1.4));
        tally(5.8, 3);
        winJingle(8.9, true, 14);
        brass([67, 72, 76, 79, 84], 9.3, 2, 0.05);
        sparkle(4, 60, 4, 0.025);
      },
      // Free spins: a whirling tone that flies out and back, then a sparkle pop.
      portal: function () {
        if (!ready()) return;
        voice(700, 0, 1.6, { vol: 0.04, glide: 1800, glideTime: 0.8, glide2: 700, vib: [14, 40], rev: 0.8, echo: 0.3 });
        noise(0, 0.8, 1500, 7000, 0.05, { q: 6 });
        noise(0.8, 0.8, 7000, 1500, 0.05, { q: 6 });
        boom(1.6, 0.6);
        crackle(1.7, 25, 1, 0.06);
        sparkle(0, 30, 2.4, 0.025);
      }
    };
  })();

  // ---------- paytable & sign list ----------
  function buildInfo() {
    var S = E.BY_ID, P = E.PAYS;
    var g = function (id) { return S[id].glyph; };
    var rows = [
      [g('sun') + g('moon') + g('ophiuchus'), 'Cosmic Eclipse → Zodiac Wheel', 'BONUS'],
      [g('ophiuchus') + g('ophiuchus') + g('ophiuchus'), 'Serpent Bearer Triple', P.serpent],
      [g('sun') + g('sun') + g('sun'), 'Solar Alignment', P.sun],
      [g('moon') + g('moon') + g('moon'), 'Lunar Alignment', P.moon],
      [g('scorpio') + g('scorpio') + g('scorpio'), 'Any sign, three times', P.sign],
      [g('aries') + g('leo') + g('sagittarius'), 'Elemental Trine', P.trine]
    ];
    $('paytable').innerHTML = rows.map(function (r) {
      return '<tr><td class="gl">' + r[0] + '</td><td>' + r[1] + '</td><td class="x">' + (typeof r[2] === 'number' ? '×' + r[2] : r[2]) + '</td></tr>';
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
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + .2, p: Math.random() * 6.28, s: .5 + Math.random() * 1.5, h: [300, 185, 270, 50, 0][Math.floor(Math.random() * 5)] });
    }
    function frame(t) {
      cx.clearRect(0, 0, w, h);
      cx.shadowBlur = 0;
      stars.forEach(function (s) {
        var a = reduceMotion ? .6 : .35 + .45 * Math.sin(s.p + t / 1000 * s.s);
        cx.fillStyle = 'hsla(' + s.h + ',100%,80%,' + a.toFixed(3) + ')';
        cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.283); cx.fill();
      });
      var size = Math.min(w, h) * .35, ox = w - size - 10, oy = 30;
      cx.strokeStyle = 'rgba(0,240,255,.22)'; cx.lineWidth = 1; cx.shadowColor = '#ff2bd6'; cx.shadowBlur = 8;
      ophEdges.forEach(function (e) {
        cx.beginPath();
        cx.moveTo(ox + oph[e[0]][0] * size, oy + oph[e[0]][1] * size);
        cx.lineTo(ox + oph[e[1]][0] * size, oy + oph[e[1]][1] * size);
        cx.stroke();
      });
      cx.fillStyle = 'rgba(255,120,240,.8)';
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
  $('wheelSpin').addEventListener('click', spinWheel);
  $('megaCollect').addEventListener('click', closeMega);
  els.forceEclipse.addEventListener('click', function () { forced = forced === 'eclipse' ? null : 'eclipse'; armDemo(); });
  els.forceMega.addEventListener('click', function () { forced = forced === 'mega' ? null : 'mega'; armDemo(); });
  els.auto.addEventListener('change', function () { if (els.auto.checked && !spinning) spin(); });
  els.sound.checked = state.sound !== false;
  els.sound.addEventListener('change', function () { state.sound = els.sound.checked; save(); audio.sync(); });
  els.ambience.checked = state.ambience2 === true;
  els.ambience.addEventListener('change', function () { state.ambience2 = els.ambience.checked; save(); audio.sync(); });
  // Browsers only allow audio after a user gesture; start the ambience on the first one.
  document.addEventListener('pointerdown', function first() { audio.unlock(); document.removeEventListener('pointerdown', first); });
  els.reset.addEventListener('click', function () {
    if (spinning || bonusActive) return;
    state.credits = START_CREDITS; freeSpins = 0; save(); updateMeters(0);
    say('Your stardust has been replenished.');
  });

  buildInfo();
  renderStatic();
  updateMeters(0);
  starfield();
})();
