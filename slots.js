/* Serpent Bearer Slots — UI. Depends on slots-engine.js (window.SlotsEngine). */
(function () {
  'use strict';
  var E = window.SlotsEngine;

  var START_CREDITS = 10000;
  var COINS = [1, 2, 5, 10, 20, 50, 100];
  var MAX_LEVEL = 10;
  var SPEEDS = { slow: 1.6, medium: 1, fast: 0.4 };
  var FEATURE_PRICE = 175; // × line bet
  var STORE_KEY = 'serpentBearerSlots.v1';
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    credits: $('credits'), totalBet: $('totalBet'), lastWin: $('lastWin'),
    lineCount: $('lineCount'), spin: $('spin'), message: $('message'),
    lines: $('lines'), freeBanner: $('freeBanner'), freeCount: $('freeCount'),
    autoCount: $('autoCount'), autoLeft: $('autoLeft'), sound: $('sound'), ambience: $('ambience'), reset: $('reset'),
    coin: $('coin'), coinUp: $('coinUp'), coinDown: $('coinDown'),
    level: $('level'), levelUp: $('levelUp'), levelDown: $('levelDown'),
    linesUp: $('linesUp'), linesDown: $('linesDown'),
    lineBet: $('lineBet'), lineBetLines: $('lineBetLines'), betSum: $('betSum'),
    maxBet: $('maxBet'), buyFeature: $('buyFeature'), featurePrice: $('featurePrice'),
    jackpot: $('jackpot'), jackpotMeter: document.querySelector('.jackpot-meter'),
    forceEclipse: $('forceEclipse'), forceMega: $('forceMega')
  };
  var strips = Array.prototype.map.call(document.querySelectorAll('.reel .strip'), function (s) { return s; });

  var state = load() || { credits: START_CREDITS, coinIdx: 0, level: 1, lines: E.PAYLINES.length, sound: true };
  // Upgrade saves from the older single "bet per line" control.
  if (typeof state.coinIdx !== 'number') {
    state.coinIdx = 0;
    state.level = Math.min(MAX_LEVEL, [1, 2, 5, 10, 25][state.betIdx] || 1);
    delete state.betIdx;
  }
  if (!SPEEDS[state.speed]) state.speed = 'medium';
  var autoLeft = 0;
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

  // Line bet = coin value × bet level.
  function bet() { return COINS[state.coinIdx] * state.level; }
  function speed() { return SPEEDS[state.speed]; }
  function totalBet() { return bet() * state.lines; }

  function updateMeters(win) {
    els.credits.textContent = state.credits.toLocaleString();
    els.coin.textContent = COINS[state.coinIdx];
    els.level.textContent = state.level;
    els.lineBet.textContent = bet().toLocaleString();
    els.lineBetLines.textContent = state.lines;
    els.betSum.textContent = totalBet().toLocaleString();
    els.featurePrice.textContent = (FEATURE_PRICE * bet()).toLocaleString();
    els.lineCount.textContent = state.lines;
    els.totalBet.textContent = freeSpins > 0 ? 'FREE' : totalBet().toLocaleString();
    if (win !== undefined) els.lastWin.textContent = win.toLocaleString();
    els.freeBanner.hidden = freeSpins <= 0;
    els.freeCount.textContent = freeSpins;
    var locked = spinning || freeSpins > 0;
    els.coinUp.disabled = locked || state.coinIdx >= COINS.length - 1;
    els.coinDown.disabled = locked || state.coinIdx <= 0;
    els.levelUp.disabled = locked || state.level >= MAX_LEVEL;
    els.levelDown.disabled = locked || state.level <= 1;
    els.maxBet.disabled = locked;
    els.buyFeature.disabled = locked || bonusActive || state.credits < FEATURE_PRICE * bet();
    document.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.speed === state.speed); });
    els.autoLeft.textContent = autoLeft > 0 && autoLeft !== Infinity ? autoLeft : '';
    els.linesUp.disabled = locked || state.lines >= E.PAYLINES.length;
    els.linesDown.disabled = locked || state.lines <= 1;
    els.spin.disabled = bonusActive;
    els.spin.classList.toggle('stop', spinning);
    els.jackpot.textContent = fmtJackpot(state.jackpot);
    els.spin.textContent = spinning ? 'Stop' : freeSpins > 0 ? 'Free Spin' : 'Spin';
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
  // Tap Spin while the reels turn to slam them to a stop.
  var reelStops = [];
  var quickStopping = false;
  function quickStop() {
    quickStopping = true;
    audio.cancelReels();
    audio.stopAnticipation();
    reelStops.forEach(function (r) { if (!r.done) r.finish(); });
    quickStopping = false;
  }

  // Two matching symbols on an active line across the first two reels (a
  // wild counts, as do two eclipse pieces), or two Ophiuchus anywhere on them.
  function nearMiss(g) {
    for (var i = 0; i < state.lines; i++) {
      var rows = E.PAYLINES[i].rows, a = g[0][rows[0]], b = g[1][rows[1]];
      if (a.id === b.id || a.wild || b.wild) return true;
      if (E.ECLIPSE.indexOf(a.id) !== -1 && E.ECLIPSE.indexOf(b.id) !== -1) return true;
    }
    var w = 0;
    [0, 1].forEach(function (c) { g[c].forEach(function (sym) { if (sym.wild) w++; }); });
    return w >= 2;
  }

  function spin() {
    if (bonusActive) return;
    if (spinning) { quickStop(); return; }
    var isFree = freeSpins > 0;
    if (!isFree && state.credits < totalBet()) {
      say('Not enough stardust. Lower your bet or refill.');
      setAuto(0);
      return;
    }
    audio.unlock();
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
    var durs = strips.map(function (_, c) { return reduceMotion ? 0 : (900 + c * 380) * speed(); });
    audio.spin(durs.map(function (d) { return d / 1000; }));
    var spinStart = performance.now();
    reelStops = [];
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
        var dur = durs[c];
        strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(.15,.7,.25,1.04)';
        strip.style.transform = 'translateY(0)';
        var r = { done: false };
        r.finish = function () {
          if (r.done) return;
          r.done = true;
          clearTimeout(r.timer);
          strip.style.transition = 'none';
          strip.style.transform = 'translateY(0)';
          audio.playReelStop(c);
          if (c === 1 && !quickStopping && reelStops[2] && !reelStops[2].done && nearMiss(next)) {
            audio.playAnticipation((durs[2] - (performance.now() - spinStart)) / 1000);
          }
          if (c === 2) audio.stopAnticipation();
          resolve();
        };
        r.timer = setTimeout(r.finish, dur);
        reelStops.push(r);
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

  // Auto play: a number of paid spins (or Infinity); free spins don't use it up.
  function setAuto(n) {
    autoLeft = n;
    if (n <= 0) els.autoCount.value = '0';
    updateMetersKeepWin();
  }
  function updateMetersKeepWin() { var w = els.lastWin.textContent; updateMeters(); els.lastWin.textContent = w; }
  function autoOn() { return autoLeft > 0; }

  // Win size relative to the total bet picks the sound tier.
  function winTier(amount) {
    var r = amount / totalBet();
    return r >= 10 ? 'big' : r >= 2 ? 'medium' : 'small';
  }

  function continueAuto(delay) {
    if (freeSpins > 0 || autoOn()) {
      setTimeout(function () {
        if (spinning || bonusActive) return;
        if (freeSpins > 0) { spin(); return; }
        if (!autoOn()) return;
        autoLeft--;
        if (autoLeft <= 0) { autoLeft = 0; els.autoCount.value = '0'; }
        spin();
        updateMetersKeepWin();
      }, delay * speed());
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
      audio.playJackpot(false);
    } else if (res.total > 0) {
      var big = res.total >= totalBet() * 10;
      say(parts.join(' · ') + ' — +' + res.total.toLocaleString(), 'win' + (big ? ' big' : ''));
      var tier = winTier(res.total);
      rollUp(res.total, audio.TIER_DUR[tier]);
      audio.playWin(tier);
    } else if (!res.freeSpins && !res.eclipse) {
      say(pickMiss());
      audio.miss();
    }
    if (res.freeSpins) {
      say((res.total ? els.message.textContent + ' · ' : '') + res.freeSpins + ' free spins from Ophiuchus!', 'win big');
      audio.playFreeSpins();
    }
    save();

    if (res.eclipse) {
      bonusActive = true;
      updateMeters(res.total);
      drawLines(res.wins.concat([res.eclipse]));
      highlight(res.wins.concat([res.eclipse]));
      say('☉ ☽ ⛎ COSMIC ECLIPSE! The Zodiac Wheel awakens…', 'win big');
      audio.playBonus();
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
    if (autoOn() || freeSpins > 0) setTimeout(spinWheel, 1200);
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
    var win = slice.mult * bet();
    state.credits += win;
    save();
    $('bonusResult').textContent = E.BY_ID[slice.id].name + ' ×' + slice.mult + ' line bet — +' + win.toLocaleString();
    var tier = winTier(win);
    rollUp(win, audio.TIER_DUR[tier]);
    audio.playWin(tier);
    wheelDone = 'win';
    btn.textContent = 'Collect';
    btn.disabled = false;
    btn.focus();
    say('Zodiac Wheel: ' + E.BY_ID[slice.id].name + ' ×' + slice.mult + ' — +' + win.toLocaleString(), 'win big');
    if (autoOn() || freeSpins > 0) setTimeout(function () { if (!$('bonus').hidden) closeWheel(); }, 3000);
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
    audio.playJackpot(true);
    confettiStop = confetti($('confetti'));
    var start = performance.now(), dur = reduceMotion ? 1 : 3500, el = $('megaAmount');
    (function count(now) {
      var t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = '+' + Math.floor(amount * eased).toLocaleString();
      if (t < 1 && !box.hidden) requestAnimationFrame(count);
    })(start);
    $('megaCollect').focus();
    if (autoOn() || freeSpins > 0) setTimeout(function () { if (!box.hidden) closeMega(); }, 9000);
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

  // ---------- audio: casino slot machine sound engine ----------
  // Every sound is generated with the Web Audio API (no downloads), but never
  // as a lone oscillator. Bells and coins are physical-style struck-metal
  // models: several inharmonic partials, a detuned pair for shimmer and a
  // noise "strike" transient, each layer decaying at its own rate. They are
  // rendered once into a bank of AudioBuffers (one OfflineAudioContext pass),
  // so a jackpot with hundreds of overlapping hits costs one buffer source
  // per hit and stays smooth on phones. Real recordings in sounds/ (see
  // sounds/README.md) override the matching generated sound.
  var audio = (function () {
    var AC = window.AudioContext || window.webkitAudioContext;
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var ctx = null, master, reverbIn, noiseBuf, buses = {};
    var bank = { bell: {}, coin: [], ready: false };

    // ---- real instrument recordings ----
    // sounds/casino-sounds.mp3 holds 26 real recordings rendered from the
    // GeneralUser GS SoundFont by S. Christian Collins: glockenspiel at every
    // win pitch, tubular bells, and from the drum kit a triangle, ride bell,
    // crash and splash cymbals, jingle bell, chimes (mark tree), tambourine
    // and wood block. It is fetched while the page loads, decoded once audio
    // starts, and sliced into one AudioBuffer per clip. Offsets are seconds.
    var SPRITE = {"glock72":[0,1.2954],"glock76":[1.3554,1.2965],"glock79":[2.712,1.2971],"glock84":[4.069,1.2979],"glock86":[5.4269,1.2982],"glock88":[6.7851,1.2984],"glock91":[8.1435,1.2987],"glock93":[9.5022,1.2989],"glock96":[10.8611,1.2991],"glock98":[12.2202,1.2993],"glock100":[13.5794,1.2997],"glock103":[14.9391,1.2998],"glock105":[16.2988,1.2998],"glock108":[17.6587,1.2999],"tube72":[19.0185,2.1873],"tube76":[21.2659,2.3184],"tube79":[23.6443,2.1744],"tube84":[25.8787,2.2071],"triangle":[28.1458,1.4],"ridebell":[29.6058,2],"crash":[31.6658,2.6],"splash":[34.3258,1.4152],"jingle":[35.801,0.4399],"chimes":[36.3008,3.4],"tambourine":[39.7608,0.7963],"woodblock":[40.6172,0.1115]};
    var real = {}, realLoaded = false;
    var spriteData = window.fetch ? fetch('sounds/casino-sounds.mp3').then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () { return null; }) : null;
    var reelBus = null, antic = null, ambTimer = null;

    // Relative loudness of each sound family.
    var LEVELS = { reel: 0.25, coin: 0.35, small: 0.45, medium: 0.6, big: 0.75, jackpot: 1, antic: 0.2, amb: 0.12 };
    // How long each win tier's sound runs; the Win meter counts up in step.
    var TIER_DUR = { small: 1.0, medium: 1.8, big: 3.0, jackpot: 4.2 };
    var BELL_LO = 72, BELL_HI = 108, BELL_LEN = 1.1, COIN_LEN = 0.26, COIN_VARIANTS = 8;
    // Bright major-pentatonic bell pitches (C6 up to C8).
    var PENT = [84, 86, 88, 91, 93, 96, 98, 100, 103, 105, 108];

    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function rand(a, b) { return a + Math.random() * (b - a); }
    function soundOn() { return els.sound.checked; }
    function ambienceOn() { return soundOn() && els.ambience.checked; }
    function ready() { return !!ctx && soundOn(); }

    // Create or resume the AudioContext. Browsers (Android Chrome included)
    // only allow this during a user gesture, so it is called from every tap,
    // key press and Spin; it is cheap to call repeatedly.
    function unlock() {
      if (!soundOn() || !AC) return;
      if (!ctx) {
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
        build();
        renderBank();
        loadSprite();
        loadSamples();
      }
      if (ctx.state !== 'running' && ctx.resume) { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
      syncAmbience();
    }

    function makeNoise(c, secs) {
      var b = c.createBuffer(1, Math.ceil(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }

    function build() {
      // Brick-wall-ish limiter so dense jackpots never clip.
      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12;
      limiter.attack.value = 0.003; limiter.release.value = 0.25;
      master = ctx.createGain(); master.gain.value = 0.8;
      master.connect(limiter); limiter.connect(ctx.destination);

      // A short, bright room: bells ring out without washing into a hum.
      var sr = ctx.sampleRate, len = Math.floor(sr * 1.3), ir = ctx.createBuffer(2, len, sr);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      }
      var conv = ctx.createConvolver(), hp = ctx.createBiquadFilter();
      conv.buffer = ir; hp.type = 'highpass'; hp.frequency.value = 400;
      reverbIn = ctx.createGain();
      reverbIn.connect(hp); hp.connect(conv); conv.connect(master);

      noiseBuf = makeNoise(ctx, 2);

      Object.keys(LEVELS).forEach(function (k) {
        var g = ctx.createGain(), send = ctx.createGain();
        g.gain.value = LEVELS[k];
        send.gain.value = (k === 'reel' || k === 'antic') ? 0.04 : 0.16;
        g.connect(master); g.connect(send); send.connect(reverbIn);
        buses[k] = g;
      });
    }

    // ---- struck-metal models (work in live and offline contexts) ----
    function partial(c, dst, t, f, amp, decay, type) {
      if (f > c.sampleRate * 0.45) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g); g.connect(dst);
      o.onended = function () { g.disconnect(); };
      o.start(t); o.stop(t + decay + 0.02);
    }
    function strike(c, dst, nb, t, amp, hpf, len, bpf) {
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = nb;
      if (bpf) { f.type = 'bandpass'; f.frequency.value = bpf; f.Q.value = hpf; } else { f.type = 'highpass'; f.frequency.value = hpf; }
      g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.connect(f); f.connect(g); g.connect(dst);
      s.onended = function () { g.disconnect(); };
      s.start(t, Math.random() * 0.02); s.stop(t + len + 0.01);
    }
    // A casino bell: fundamental with a detuned twin (the shimmer), a slightly
    // stretched octave, and bell-like inharmonic overtones that die away
    // faster the higher they are, plus the clapper's metallic tick.
    var BELL_PARTIALS = [
      [1, 1, 1.0, 'sine'], [1.0028, 0.55, 0.85, 'sine'], [2.005, 0.5, 0.6, 'triangle'],
      [2.76, 0.32, 0.38, 'sine'], [4.07, 0.22, 0.24, 'sine'], [5.4, 0.15, 0.14, 'sine'], [8.93, 0.09, 0.06, 'sine']
    ];
    function bellModel(c, dst, nb, t, f, amp) {
      BELL_PARTIALS.forEach(function (p) { partial(c, dst, t, f * p[0], amp * p[1], p[2], p[3]); });
      strike(c, dst, nb, t, amp * 0.45, 4000, 0.006);
    }
    // A coin "CHING": a sharp high-passed strike, a cluster of bright
    // inharmonic disc modes that ring for well under a quarter second, a tiny
    // top-end sparkle, and the coin chattering once more as it settles.
    function coinModel(c, dst, nb, t, f, amp) {
      [[1, 1, 0.18], [1.004, 0.5, 0.15], [1.52, 0.62, 0.11], [2.03, 0.5, 0.085], [2.71, 0.36, 0.06], [3.6, 0.24, 0.045]].forEach(function (p) {
        partial(c, dst, t, f * p[0], amp * p[1], p[2]);
      });
      strike(c, dst, nb, t, amp * 0.7, 6000, 0.004);
      partial(c, dst, t, rand(10500, 12500), amp * 0.12, 0.03);
      var t2 = t + rand(0.018, 0.03);
      [[1, 0.3, 0.1], [1.52, 0.2, 0.07], [2.03, 0.16, 0.05]].forEach(function (p) {
        partial(c, dst, t2, f * p[0] * 1.001, amp * p[1], p[2]);
      });
    }

    // Render every bell pitch and eight coin variants in one offline pass,
    // then slice the result into individual normalized buffers.
    function renderBank() {
      if (!OAC) return;
      var sr = ctx.sampleRate, notes = [], m;
      for (m = BELL_LO; m <= BELL_HI; m++) notes.push(m);
      var total = Math.ceil(sr * (notes.length * BELL_LEN + COIN_VARIANTS * COIN_LEN)) + 16;
      var oc;
      try { oc = new OAC(1, total, sr); } catch (e) { return; }
      var nb = makeNoise(oc, 0.1), off = 0, marks = [], finished = false;
      notes.forEach(function (n) {
        bellModel(oc, oc.destination, nb, off + 0.002, hz(n), 0.3);
        marks.push(['bell', n, off, BELL_LEN]); off += BELL_LEN;
      });
      for (var i = 0; i < COIN_VARIANTS; i++) {
        coinModel(oc, oc.destination, nb, off + 0.002, rand(2900, 3700), 0.3);
        marks.push(['coin', i, off, COIN_LEN]); off += COIN_LEN;
      }
      function done(buf) {
        if (finished || !buf) return;
        finished = true;
        var data = buf.getChannelData(0);
        marks.forEach(function (mk) {
          var a = Math.floor(mk[2] * sr), n = Math.floor(mk[3] * sr);
          var b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), peak = 0, j;
          for (j = 0; j < n; j++) { d[j] = data[a + j] || 0; if (Math.abs(d[j]) > peak) peak = Math.abs(d[j]); }
          if (peak > 0) for (j = 0; j < n; j++) d[j] *= 0.9 / peak;
          if (mk[0] === 'bell') bank.bell[mk[1]] = b; else bank.coin.push(b);
        });
        bank.ready = true;
      }
      oc.oncomplete = function (e) { done(e.renderedBuffer); };
      var p = oc.startRendering();
      if (p && p.then) p.then(done).catch(function () {});
    }

    function loadSprite() {
      if (!spriteData) return;
      spriteData.then(function (data) {
        if (!data) return null;
        return new Promise(function (ok, fail) { ctx.decodeAudioData(data.slice(0), ok, fail); });
      }).then(function (buf) {
        if (!buf) return;
        var d = buf.getChannelData(0), sr = buf.sampleRate, i = 0, lim = Math.min(d.length, Math.floor(sr * 0.1));
        // MP3 decoders add a short delay; measure it from the first clip's onset.
        while (i < lim && Math.abs(d[i]) < 0.02) i++;
        var shift = i < lim ? i / sr - 0.0004 : 0.0255;
        Object.keys(SPRITE).forEach(function (k) {
          var a = Math.max(0, Math.floor((SPRITE[k][0] + shift - 0.004) * sr));
          var n = Math.min(Math.floor((SPRITE[k][1] + 0.004) * sr), d.length - a);
          var b = ctx.createBuffer(1, n, sr);
          b.getChannelData(0).set(d.subarray(a, a + n));
          real[k] = b;
        });
        realLoaded = true;
      }).catch(function () {});
    }

    // ---- playback ----
    // cut: optionally damp the clip after this many seconds (keeps coin and
    // glitter hits short even though the recordings ring longer).
    function playBuf(buf, at, gain, bus, rate, cut) {
      var s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime + Math.max(0, at || 0);
      s.buffer = buf; if (rate) s.playbackRate.value = rate;
      if (cut) { g.gain.setValueAtTime(gain, t); g.gain.setTargetAtTime(0, t + cut * 0.3, cut * 0.25); }
      else g.gain.value = gain;
      s.connect(g); g.connect(bus);
      s.onended = function () { s.disconnect(); g.disconnect(); };
      s.start(t);
      if (cut) s.stop(t + cut * 1.6);
      return s;
    }
    // Play a real recording by name; returns null if it isn't loaded.
    function clip(name, at, gain, bus, rate, cut) {
      return real[name] ? playBuf(real[name], at, gain, bus, rate, cut) : null;
    }
    var GLOCK = [72, 76, 79, 84, 86, 88, 91, 93, 96, 98, 100, 103, 105, 108];
    // One bell hit: the real glockenspiel at that pitch, with a quiet layer of
    // the struck-metal model underneath for extra ring. Before the recordings
    // load it falls back to the model alone.
    function bell(m, at, gain, bus, ring) {
      m = Math.round(m);
      ring = ring || 0.45;
      if (realLoaded) {
        var near = GLOCK.reduce(function (a, b) { return Math.abs(b - m) < Math.abs(a - m) ? b : a; });
        var s = playBuf(real['glock' + near], at, gain, bus, Math.pow(2, (m - near) / 12) * rand(0.998, 1.002), ring);
        var mm = Math.max(BELL_LO, Math.min(BELL_HI, m));
        if (bank.bell[mm]) playBuf(bank.bell[mm], at, gain * 0.2, bus, 0, ring);
        return s;
      }
      m = Math.max(BELL_LO, Math.min(BELL_HI, m));
      if (bank.bell[m]) return playBuf(bank.bell[m], at, gain, bus, rand(0.997, 1.003));
      var g = ctx.createGain(); g.gain.value = gain * 2.2; g.connect(bus);
      bellModel(ctx, g, noiseBuf, ctx.currentTime + Math.max(0, at || 0), hz(m), 0.3);
      setTimeout(function () { g.disconnect(); }, ((at || 0) + 1.3) * 1000);
      return null;
    }
    // A coin: a real triangle strike damped short (the bright CHING), the
    // struck-disc coin model for the metallic body, and now and then a
    // jingle-bell rattle.
    function coin(at, gain, bus, rate) {
      if (realLoaded) {
        var s = playBuf(real.triangle, at, gain * 0.6, bus, (rate || 1) * rand(1.05, 1.35), 0.16);
        if (bank.coin.length) playBuf(bank.coin[Math.floor(Math.random() * bank.coin.length)], at, gain * 0.7, bus, rate || rand(0.92, 1.1));
        if (Math.random() < 0.25) playBuf(real.jingle, at + 0.005, gain * 0.25, bus, rand(1.2, 1.5), 0.12);
        return s;
      }
      if (bank.coin.length) return playBuf(bank.coin[Math.floor(Math.random() * bank.coin.length)], at, gain, bus, rate || rand(0.92, 1.1));
      var g = ctx.createGain(); g.gain.value = gain * 2.5; g.connect(bus);
      coinModel(ctx, g, noiseBuf, ctx.currentTime + Math.max(0, at || 0), rand(2900, 3700) * (rate || 1), 0.3);
      setTimeout(function () { g.disconnect(); }, ((at || 0) + 0.5) * 1000);
      return null;
    }
    // Sparkle: coins pitched way up become tiny glittering metallic pings.
    function glitter(at, gain, bus) {
      if (realLoaded) return playBuf(real['glock' + (Math.random() < 0.5 ? 105 : 108)], at, gain * 0.6, bus, rand(1, 1.12), 0.2);
      return coin(at, gain, bus, rand(1.8, 2.4));
    }
    // A bell hit doubled an octave up for a fuller, layered chime.
    function chime(m, at, gain, bus, octave, ring) {
      bell(m, at, gain, bus, ring);
      if (octave) bell(m + 12, at + 0.004, gain * octave, bus, ring);
    }

    // A dry mechanical tick (ratchet pawl, wheel flapper). Noise only, no pitch sweep.
    function tick(t, amp, bus, freq) {
      strike(ctx, bus, noiseBuf, t, amp, 3, 0.014, freq || rand(2300, 2900));
      strike(ctx, bus, noiseBuf, t, amp * 0.5, 5000, 0.004);
    }

    // ---- optional real recordings (sounds/ folder) ----
    var SAMPLE_NAMES = ['spin', 'reelstop', 'coin', 'smallwin', 'mediumwin', 'win', 'bigwin', 'jackpot', 'megajackpot',
      'anticipation', 'bonus', 'wheel', 'freespins', 'lose'];
    var SAMPLE_EXTS = ['mp3', 'wav'];
    var samples = {};
    function loadSamples() {
      if (!window.fetch) return;
      SAMPLE_NAMES.forEach(function (name) {
        (function tryExt(i) {
          if (i >= SAMPLE_EXTS.length) return;
          fetch('sounds/' + name + '.' + SAMPLE_EXTS[i]).then(function (r) {
            if (!r.ok) throw new Error('missing');
            return r.arrayBuffer();
          }).then(function (data) {
            return new Promise(function (ok, fail) { ctx.decodeAudioData(data, ok, fail); });
          }).then(function (buf) { samples[name] = buf; }).catch(function () { tryExt(i + 1); });
        })(0);
      });
    }
    function sample(names, bus) {
      for (var i = 0; i < names.length; i++) {
        if (samples[names[i]]) return playBuf(samples[names[i]], 0, 1, bus || master);
      }
      return null;
    }

    // ---- the sounds ----

    // COIN / CREDIT: one crisp metallic CHING.
    function playCoin(at, gain) {
      if (!ready()) return;
      if (!at && sample(['coin'], buses.coin)) return;
      coin(at || 0, gain == null ? 1 : gain, buses.coin);
    }

    // REEL STOP: a short, punchy mechanical CLACK with a metal latch; each
    // reel lands a little higher and harder than the one before.
    function playReelStop(i) {
      if (!ready()) return;
      if (sample(['reelstop'], buses.reel)) return;
      var k = 1 + i * 0.07, amp = 0.9 + i * 0.12, t = ctx.currentTime, bus = buses.reel;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(210 * k, t); o.frequency.exponentialRampToValueAtTime(95 * k, t + 0.05);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 0.9, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(bus); o.onended = function () { g.disconnect(); };
      o.start(t); o.stop(t + 0.08);
      strike(ctx, bus, noiseBuf, t, amp * 0.9, 1.4, 0.035, 1900 * k);
      strike(ctx, bus, noiseBuf, t, amp * 0.5, 5000, 0.006);
      partial(ctx, bus, t, 2650 * k, amp * 0.28, 0.05);
      partial(ctx, bus, t, 4100 * k, amp * 0.16, 0.035);
      partial(ctx, bus, t, 6300 * k, amp * 0.08, 0.02);
      clip('woodblock', 0, amp * 0.55, bus, 1.15 + i * 0.08);
    }

    // SMALL WIN: DING! DING! DING! DING! (four rising bells, about a second).
    function playSmallWin() {
      if (!ready()) return;
      if (sample(['smallwin', 'win'], buses.small)) return;
      var bus = buses.small;
      [84, 88, 91, 96].forEach(function (m, i) {
        chime(m, i * 0.18, 0.8 + i * 0.07, bus, 0.25, i === 3 ? 0.55 : 0.4);
        coin(i * 0.18 + 0.01, 0.35, buses.coin);
      });
    }

    // MEDIUM WIN: DING-DING-DING-DING-DING-DING rising fast over coin ticks,
    // then a sparkle and a two-bell finish (about 2 seconds).
    function playMediumWin() {
      if (!ready()) return;
      if (sample(['mediumwin', 'win'], buses.medium)) return;
      var bus = buses.medium, t;
      [84, 86, 88, 91, 93, 96, 98, 100, 103].forEach(function (m, i) { chime(m, i * 0.12, 0.75, bus, 0.3); });
      for (t = 0.05; t < 1.35; t += rand(0.08, 0.11)) coin(t, rand(0.3, 0.5), buses.coin);
      for (var s = 0; s < 6; s++) glitter(1.0 + Math.random() * 0.45, 0.3, bus);
      chime(96, 1.2, 0.85, bus, 0.35, 0.6);
      chime(103, 1.2, 0.7, bus, 0, 0.6);
      chime(108, 1.32, 0.6, bus, 0, 0.6);
      clip('chimes', 1.0, 0.45, bus, 1, 0.9);
    }

    // BIG WIN: a rapid two-bell ring, a rising two-octave cascade in thirds,
    // coins pouring underneath, sparkles, and a strummed bell-chord flourish.
    function playBigWin() {
      if (!ready()) return;
      if (sample(['bigwin', 'win'], buses.big)) return;
      var bus = buses.big, i, t;
      for (i = 0; i < 14; i++) chime(i % 2 ? 96 : 91, i * 0.0625, 0.72, bus, i % 2 ? 0 : 0.3);
      PENT.forEach(function (m, j) {
        chime(m, 0.9 + j * 0.09, 0.75, bus, 0.25);
        bell(m + 4, 0.92 + j * 0.09, 0.4, bus);
      });
      for (i = 0; i < 6; i++) bell(i % 2 ? 108 : 103, 1.95 + i * 0.07, 0.6, bus);
      [84, 88, 91, 96, 100].forEach(function (m, j) { bell(m, 2.45 + j * 0.015, 0.7, bus, 0.8); });
      bell(108, 2.55, 0.7, bus, 0.8);
      clip('chimes', 0.9, 0.45, bus, 1, 1.4);
      clip('tube84', 2.45, 0.45, bus, 1, 0.9);
      clip('splash', 2.47, 0.45, bus, 1, 0.9);
      for (t = 0.2; t < 2.9; t += rand(0.055, 0.085)) coin(t, rand(0.35, 0.6), buses.coin);
      for (i = 0; i < 25; i++) glitter(0.9 + Math.random() * 2.1, 0.25, bus);
    }

    // JACKPOT: the machine goes crazy. An alarm-style bell roll, a coin
    // shower, a three-layer rising cascade, a second higher ring, glitter
    // throughout, and a triumphant strummed flourish with a final big hit.
    // The Mega Jackpot adds another bell layer and a heavier coin shower.
    function playJackpot(mega) {
      if (!ready()) return;
      if (sample(mega ? ['megajackpot', 'jackpot'] : ['jackpot'], buses.jackpot)) return;
      var bus = buses.jackpot, i, t;
      clip('splash', 0, 0.45, bus, 1, 0.9);
      // A: jackpot bell roll, 20 hits a second, with low and high layers and a ride-bell alarm
      for (i = 0; i < 22; i++) {
        t = i * 0.05;
        bell(i % 2 ? 100 : 96, t, 0.7, bus);
        if (i % 4 === 0) bell(84, t, 0.55, bus);
        if (i % 2 === 0) bell(108, t + 0.01, 0.3, bus);
        if (mega && i % 2) bell(91, t + 0.02, 0.35, bus);
        if (i % 4 === 2) clip('ridebell', t, 0.4, bus, 1.5, 0.25);
      }
      for (i = 0; i < 6; i++) clip('tambourine', 0.6 + Math.random() * 3.2, 0.3, bus, rand(0.95, 1.1));
      // B: coin shower, densest in the middle
      var n = mega ? 120 : 80;
      for (i = 0; i < n; i++) coin(0.4 + 2.0 * (Math.random() + Math.random()), rand(0.3, 0.55), bus);
      // C: ascending cascade in three layers, over a chimes sweep
      clip('chimes', 1.1, 0.6, bus, 1, 1.4);
      [72, 76, 79, 84, 88, 91, 96, 100, 103, 108].forEach(function (m, j) {
        t = 1.1 + j * 0.12;
        chime(m, t, 0.75, bus, 0.3);
        bell(m + 7, t + 0.03, 0.4, bus);
        glitter(t + 0.05, 0.3, bus);
      });
      // D: a second, higher ring
      for (i = 0; i < 14; i++) bell(i % 2 ? 108 : 103, 2.5 + i * 0.055, 0.6, bus);
      // E: glitter throughout
      for (i = 0; i < 40; i++) glitter(0.2 + Math.random() * 4.4, 0.28, bus);
      // F: triumphant flourish and the climax
      [72, 79, 84, 88, 91, 96, 100, 103, 108].forEach(function (m, j) { bell(m, 3.4 + j * 0.02, 0.65, bus, 0.6); });
      [100, 103, 108].forEach(function (m, j) { bell(m, 3.75 + j * 0.08, 0.7, bus, 0.5); });
      [72, 84, 96, 108].forEach(function (m) { bell(m, 4.05, mega ? 0.8 : 0.75, bus, 0.8); });
      ['tube72', 'tube79', 'tube84'].forEach(function (k, j) { clip(k, 3.4 + j * 0.03, 0.45, bus, 1, 0.6); clip(k, 4.05, 0.55, bus, 1, 0.8); });
      clip('crash', 4.05, mega ? 0.6 : 0.55, bus, 1, 0.9);
      if (mega) clip('chimes', 4.1, 0.5, bus, 1, 0.8);
      for (i = 0; i < 15; i++) coin(3.4 + Math.random() * 0.4, rand(0.4, 0.6), bus);
    }

    // ANTICIPATION: while the last reel spins after a near-match, soft
    // ticking that speeds up with small bells stepping upward. It fades in
    // gently and is cut off the instant the last reel lands.
    function stopAnticipation() {
      if (!antic) return;
      var a = antic; antic = null;
      var now = ctx.currentTime;
      a.gain.gain.cancelScheduledValues(now);
      a.gain.gain.setTargetAtTime(0, now, 0.012);
      setTimeout(function () {
        a.sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
        a.gain.disconnect();
      }, 80);
    }
    function playAnticipation(dur) {
      if (!ready() || dur < 0.2) return;
      stopAnticipation();
      var g = ctx.createGain(), now = ctx.currentTime, sources = [];
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(1, now + 0.25);
      g.connect(buses.antic);
      antic = { gain: g, sources: sources };
      var s = sample(['anticipation'], g);
      if (s) { sources.push(s); return; }
      var t = 0.05, gap = 0.17, stepN = 0, note = 0;
      while (t < dur) {
        var p = t / dur;
        var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), tg = ctx.createGain(), at = now + t;
        src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 3200 + p * 800; f.Q.value = 4;
        tg.gain.setValueAtTime(0.5 + p * 0.5, at); tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.012);
        src.connect(f); f.connect(tg); tg.connect(g);
        src.onended = (function (n) { return function () { n.disconnect(); }; })(tg);
        src.start(at, Math.random()); src.stop(at + 0.02);
        sources.push(src);
        if (stepN % 3 === 0) {
          var b = bell(PENT[Math.min(PENT.length - 1, note++)], t, 0.28 + p * 0.25, g);
          if (b) sources.push(b);
        }
        gap = Math.max(0.055, gap * 0.93); t += gap; stepN++;
      }
    }

    // BONUS TRIGGER (Cosmic Eclipse / Buy feature): a fast bell trill, then a
    // rising cascade with a sprinkle of coins.
    function playBonus() {
      if (!ready()) return;
      if (sample(['bonus'], buses.medium)) return;
      var bus = buses.medium, i;
      for (i = 0; i < 13; i++) bell(i % 2 ? 100 : 96, i * 0.055, 0.65, bus);
      PENT.forEach(function (m, j) { chime(m, 0.75 + j * 0.07, 0.7, bus, 0.25); });
      clip('chimes', 0.7, 0.5, bus, 1, 1.0);
      for (i = 0; i < 10; i++) coin(0.8 + Math.random() * 0.8, 0.4, buses.coin);
      for (i = 0; i < 8; i++) glitter(0.9 + Math.random() * 0.8, 0.25, bus);
    }

    // FREE SPINS: three quick rising bell triplets and a top chime.
    function playFreeSpins() {
      if (!ready()) return;
      if (sample(['freespins'], buses.medium)) return;
      var bus = buses.medium;
      [[88, 91, 96], [91, 96, 100], [96, 100, 103]].forEach(function (tri, k) {
        tri.forEach(function (m, j) { chime(m, k * 0.3 + j * 0.06, 0.7, bus, 0.2); });
      });
      chime(108, 0.95, 0.75, bus, 0, 0.6);
      clip('chimes', 0, 0.45, bus, 1, 0.9);
      for (var i = 0; i < 6; i++) coin(0.2 + Math.random() * 1.0, 0.4, buses.coin);
    }

    // Pick and play the right win tier.
    function playWin(tier) {
      if (tier === 'big') playBigWin();
      else if (tier === 'medium') playMediumWin();
      else playSmallWin();
    }

    // ---- ambience: a distant casino floor (off by default) ----
    function syncAmbience() {
      if (!ctx) return;
      if (ambienceOn() && !ambTimer) {
        (function floor() {
          if (!ambienceOn()) { ambTimer = null; return; }
          if (Math.random() < 0.6) bell(PENT[Math.floor(Math.random() * PENT.length)], 0, rand(0.15, 0.3), buses.amb);
          else for (var i = 0; i < 3; i++) coin(i * rand(0.05, 0.09), 0.3, buses.amb);
          ambTimer = setTimeout(floor, 1500 + Math.random() * 3500);
        })();
      }
      if (!ambienceOn() && ambTimer) { clearTimeout(ambTimer); ambTimer = null; }
    }

    return {
      unlock: unlock,
      TIER_DUR: TIER_DUR,
      isReady: function () { return bank.ready && realLoaded; },
      sync: function () {
        if (!ctx) { unlock(); return; }
        master.gain.setTargetAtTime(soundOn() ? 0.8 : 0, ctx.currentTime, 0.05);
        syncAmbience();
      },
      // Reels spinning: the start ka-chunk, a ratchet clicking past the pawl
      // about 22 times a second (slowing as each reel coasts in) and a soft
      // noise whir, all on one bus so a quick stop can cut it off.
      spin: function (durs) {
        if (!ready()) return;
        durs = durs || [0.9, 1.28, 1.66];
        reelBus = ctx.createGain(); reelBus.connect(buses.reel);
        var bus = reelBus, now = ctx.currentTime;
        if (sample(['spin'], bus)) return;
        playReelStop(0);
        strike(ctx, bus, noiseBuf, now, 0.6, 0.8, 0.06, 900);
        var longest = Math.max.apply(null, durs);
        durs.forEach(function (d, c) {
          var t = 0.06 + c * 0.012;
          while (t < d) {
            var p = t / d, gap = p < 0.65 ? 0.045 : 0.045 + (p - 0.65) * 0.25;
            tick(now + t, 0.55 * (p < 0.65 ? 1 : 1 - (p - 0.65)), bus);
            t += gap;
          }
        });
        var src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = noiseBuf; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.2, now + 0.1);
        g.gain.setValueAtTime(0.2, now + longest * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, now + longest);
        src.connect(lp); lp.connect(g); g.connect(bus);
        src.onended = function () { g.disconnect(); };
        src.start(now); src.stop(now + longest + 0.05);
      },
      cancelReels: function () {
        if (!ctx || !reelBus) return;
        var b = reelBus; reelBus = null;
        b.gain.cancelScheduledValues(ctx.currentTime);
        b.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        setTimeout(function () { b.disconnect(); }, 2500);
      },
      playCoin: playCoin,
      playReelStop: playReelStop,
      playSmallWin: playSmallWin,
      playMediumWin: playMediumWin,
      playBigWin: playBigWin,
      playWin: playWin,
      playJackpot: playJackpot,
      playAnticipation: playAnticipation,
      stopAnticipation: stopAnticipation,
      playBonus: playBonus,
      playFreeSpins: playFreeSpins,
      // Zodiac Wheel: the flapper ticking past each peg, slowing with the wheel.
      wheel: function (dur, slices) {
        if (!ready()) return;
        if (sample(['wheel'], buses.reel)) return;
        var n = Math.min(slices, 90), now = ctx.currentTime;
        for (var i = 1; i <= n; i++) {
          var t = dur * (1 - Math.pow(1 - i / n, 1 / 3)) * 0.98;
          tick(now + t, 0.8, buses.reel, 2200);
        }
      },
      // A losing spin is silent, like a real machine (unless sounds/lose.* exists).
      miss: function () { if (ready()) sample(['lose'], buses.small); }
    };
  })();
  window.slotsAudio = audio; // handy for testing sounds from the console

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
  els.coinUp.addEventListener('click', function () { audio.unlock(); audio.playCoin(); state.coinIdx = Math.min(COINS.length - 1, state.coinIdx + 1); save(); updateMeters(); });
  els.coinDown.addEventListener('click', function () { audio.unlock(); audio.playCoin(); state.coinIdx = Math.max(0, state.coinIdx - 1); save(); updateMeters(); });
  els.levelUp.addEventListener('click', function () { audio.unlock(); audio.playCoin(); state.level = Math.min(MAX_LEVEL, state.level + 1); save(); updateMeters(); });
  els.levelDown.addEventListener('click', function () { audio.unlock(); audio.playCoin(); state.level = Math.max(1, state.level - 1); save(); updateMeters(); });
  els.maxBet.addEventListener('click', function () {
    audio.unlock(); for (var k = 0; k < 5; k++) audio.playCoin(k * 0.06, 1 - k * 0.1);
    state.coinIdx = COINS.length - 1; state.level = MAX_LEVEL; state.lines = E.PAYLINES.length; save(); updateMeters();
    say('Max bet: ' + totalBet().toLocaleString() + ' a spin.');
  });
  document.querySelectorAll('.seg button').forEach(function (b) {
    b.addEventListener('click', function () { state.speed = b.dataset.speed; save(); updateMetersKeepWin(); });
  });
  els.autoCount.addEventListener('change', function () {
    var v = els.autoCount.value === 'Infinity' ? Infinity : +els.autoCount.value;
    autoLeft = v;
    updateMetersKeepWin();
    if (v > 0 && !spinning && !bonusActive) { autoLeft--; spin(); if (autoLeft <= 0) { autoLeft = 0; els.autoCount.value = '0'; } updateMetersKeepWin(); }
  });
  els.buyFeature.addEventListener('click', function () {
    var cost = FEATURE_PRICE * bet();
    if (spinning || bonusActive || freeSpins > 0) return;
    if (state.credits < cost) { say('Not enough stardust to buy the feature.'); return; }
    audio.unlock();
    state.credits -= cost;
    state.jackpot += cost * E.JACKPOT_CONTRIBUTION;
    bonusActive = true;
    save();
    updateMeters(0);
    say('Feature bought for ' + cost.toLocaleString() + '! The Zodiac Wheel awakens…', 'win big');
    audio.playCoin(); audio.playCoin(0.08, 0.8); audio.playCoin(0.16, 0.7);
    audio.playBonus();
    setTimeout(function () { openWheel(false); }, 1200);
  });
  els.linesUp.addEventListener('click', function () { audio.unlock(); audio.playCoin(); state.lines = Math.min(E.PAYLINES.length, state.lines + 1); save(); updateMeters(); });
  els.linesDown.addEventListener('click', function () { audio.unlock(); audio.playCoin(); state.lines = Math.max(1, state.lines - 1); save(); updateMeters(); });
  $('wheelSpin').addEventListener('click', spinWheel);
  $('megaCollect').addEventListener('click', closeMega);
  els.forceEclipse.addEventListener('click', function () { forced = forced === 'eclipse' ? null : 'eclipse'; armDemo(); });
  els.forceMega.addEventListener('click', function () { forced = forced === 'mega' ? null : 'mega'; armDemo(); });

  els.sound.checked = state.sound !== false;
  els.sound.addEventListener('change', function () { state.sound = els.sound.checked; save(); audio.sync(); });
  els.ambience.checked = state.ambience2 === true;
  els.ambience.addEventListener('change', function () { state.ambience2 = els.ambience.checked; save(); audio.sync(); });
  // Browsers (Android Chrome included) only start or resume audio inside a
  // user gesture, and phones suspend it when the tab is hidden, so every tap
  // and key press re-unlocks it. unlock() is cheap once audio is running.
  ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function () { audio.unlock(); }, { passive: true });
  });
  els.reset.addEventListener('click', function () {
    if (spinning || bonusActive) return;
    state.credits = START_CREDITS; freeSpins = 0; save(); updateMeters(0);
    audio.unlock(); for (var k = 0; k < 8; k++) audio.playCoin(k * 0.07, 0.9 - k * 0.06);
    say('Your stardust has been replenished.');
  });

  buildInfo();
  renderStatic();
  updateMeters(0);
  starfield();
})();
