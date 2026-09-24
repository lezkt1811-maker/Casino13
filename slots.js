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
      audio.win(big, res.total / totalBet());
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
    audio.win(true, slice.mult);
    wheelDone = 'win';
    btn.textContent = 'Collect';
    btn.disabled = false;
    btn.focus();
    say('Zodiac Wheel: ' + E.BY_ID[slice.id].name + ' ×' + slice.mult + ' — +' + win.toLocaleString(), 'win big');
    els.lastWin.textContent = win.toLocaleString();
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
        voice(f, t, 0.12, { vol: vol, glide: f * 1.6, glideTime: 0.05, rev: 0.9, echo: 0.3 });
        noise(t, 0.08, 9000, 12000, vol * 0.5, { type: 'highpass', rev: 0.8 });
      }
    }

    // ---- coins ----
    // Arcade "ka-ching": two quick bright square-wave blips.
    function kaching(at, vol) {
      vol = vol || 0.05;
      voice(988, at, 0.07, { type: 'square', vol: vol, rev: 0.2 });
      voice(1319, at + 0.07, 0.4, { type: 'square', vol: vol, hold: 0.06, rev: 0.3, echo: 0.1 });
    }
    // A single metal coin hitting a pile: a sharp, very short click-and-ring.
    function clink(at, vol) {
      vol = vol || 0.04;
      var f = rand(3200, 5200);
      noise(at, 0.03, 7000, 5000, vol * 1.4, { type: 'highpass', rev: 0.2 });
      voice(f, at, 0.07, { vol: vol, type: 'triangle', rev: 0.2 });
      voice(f * 1.47, at, 0.05, { vol: vol * 0.6, rev: 0.2 });
    }
    // A pour of coins; density thins out toward the end like a real spill.
    function coinShower(at, count, dur, vol) {
      for (var i = 0; i < count; i++) clink(at + dur * Math.pow(Math.random(), 1.6), (vol || 0.035) * rand(0.5, 1));
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

    // ---- ambience: a soft starlit pad with drifting sparkles ----
    function syncAmbience() {
      if (!ctx) return;
      if (ambienceOn() && !pad) startPad();
      if (!ambienceOn() && pad) stopPad();
    }
    function startPad() {
      var g = ctx.createGain(), lp = ctx.createBiquadFilter(), trem = ctx.createOscillator(), tremAmt = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1200;
      trem.frequency.value = 0.18; tremAmt.gain.value = 0.007; trem.connect(tremAmt); tremAmt.connect(g.gain);
      var oscs = [48, 55, 64, 71, 78].map(function (m, i) {
        var o = ctx.createOscillator(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = hz(m); o.detune.value = (i % 2 ? 5 : -5);
        o.connect(lp); o.start(); return o;
      });
      lp.connect(g); out(g, 1, 0);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 4);
      trem.start();
      pad = { g: g, nodes: oscs.concat([trem]) };
      (function twinkle() {
        if (!pad) return;
        sparkle(0, 2 + Math.floor(Math.random() * 4), 0.8, 0.012);
        twinkleTimer = setTimeout(twinkle, 700 + Math.random() * 1800);
      })();
    }
    function stopPad() {
      var p = pad; pad = null; clearTimeout(twinkleTimer);
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
      // Spin: a magic swoosh trailing glitter.
      spin: function () {
        if (!ready()) return;
        noise(0, 0.7, 600, 9000, 0.12, { q: 1.5, attack: 0.25, rev: 0.6 });
        sparkle(0.1, 12, 0.8, 0.028);
      },
      // Reel stop: a solid thud with a puff of sparkles.
      stop: function (c) {
        if (!ready()) return;
        voice(120, 0, 0.25, { vol: 0.25, glide: 50, rev: 0.2 });
        noise(0, 0.08, 3000, 800, 0.08, { type: 'lowpass', rev: 0.3 });
        sparkle(0.02, 4 + c * 2, 0.2, 0.022);
      },
      miss: function () {
        if (!ready()) return;
        noise(0, 0.5, 2500, 400, 0.04, { q: 1, attack: 0.1, rev: 0.6 });
      },
      // Wins: ka-ching plus a coin spill sized to the win; big wins get fireworks.
      win: function (big, times) {
        if (!ready()) return;
        times = Math.max(1, times || 1);
        kaching(0, 0.05);
        coinShower(0.15, Math.min(60, 6 + Math.round(times * 4)), Math.min(2.5, 0.5 + times * 0.2), 0.035);
        sparkle(0.1, 16, 1.2, 0.028);
        if (big) {
          brass([64, 71, 76, 79], 0, 0.8, 0.045);
          firework(0.2, 1);
          firework(0.9, 0.8);
          kaching(0.5, 0.045); kaching(0.8, 0.045);
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
        for (var k = 0; k < 6; k++) kaching(0.9 + k * 0.4, 0.045);
        coinShower(1, 120, 4.5, 0.04);
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
        coinShower(4, 100, 4, 0.04);
        for (var k = 0; k < 8; k++) kaching(4.2 + k * 0.35, 0.045);
        brass([67, 72, 76, 79, 84], 7.2, 2, 0.055);
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
  els.ambience.checked = state.ambience !== false;
  els.ambience.addEventListener('change', function () { state.ambience = els.ambience.checked; save(); audio.sync(); });
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
