/* BroadcastEvents.js — CricCast v29 — pure JS transitions, works on all mobile */
(function (global) {
  'use strict';

  /* ── inject styles once ── */
  if (!document.getElementById('be-styles')) {
    var s = document.createElement('style');
    s.id = 'be-styles';
    s.textContent =
      '@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@1,700&display=swap");' +
      /* iOS Safari fix: body{overflow:hidden} breaks position:fixed — move it to html */
      'html{overflow:hidden!important;}body{overflow:visible!important;}' +
      '#be-overlay{' +
        'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'z-index:999999;' +
        'display:flex;align-items:center;justify-content:center;' +
        'pointer-events:none;' +
      '}' +
      '.be-card{' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'padding:20px 56px 28px;border-radius:20px;' +
      '}' +
      '.be-text{' +
        'font-family:"IBM Plex Mono",monospace;font-style:italic;font-weight:700;' +
        'line-height:1;letter-spacing:.04em;white-space:nowrap;text-align:center;' +
        '-webkit-user-select:none;user-select:none;' +
      '}' +
      '.be-sub{' +
        'font-family:"IBM Plex Mono",monospace;font-style:italic;font-weight:500;' +
        'font-size:clamp(13px,1.8vw,22px);letter-spacing:.14em;text-transform:uppercase;' +
        'text-align:center;margin-top:14px;' +
      '}';
    document.head.appendChild(s);
  }

  var CFG = {
    FOUR:      { label:'4',              color:'#00e5ff', size:'clamp(140px,28vw,320px)' },
    SIX:       { label:'6',              color:'#ffd700', size:'clamp(140px,28vw,320px)' },
    WICKET:    { label:'OUT',            color:'#ff1744', size:'clamp(110px,23vw,280px)' },
    FIFTY:     { label:'50',             color:'#e2e8f0', size:'clamp(100px,21vw,260px)' },
    HUNDRED:   { label:'100',            color:'#ffd700', size:'clamp(90px,19vw,240px)'  },
    NOBALL:    { lines:['NO','BALL'],    colors:['#ff9500','#ffcc00'], size:'clamp(80px,16vw,200px)' },
    FREEHIT:   { lines:['FREE','HIT'],   colors:['#ffffff','#ff1744'], size:'clamp(80px,16vw,200px)' },
    SUPERBALL: { lines:['SUPER','BALL'], colors:['#c084fc','#ffffff'], size:'clamp(70px,14vw,175px)' },
  };

  var _overlay   = null;
  var _hideTimer = null;

  function getOverlay() {
    /* Always append to document.body — safest across all mobile browsers */
    if (_overlay && document.body && document.body.contains(_overlay)) return _overlay;
    _overlay = document.createElement('div');
    _overlay.id = 'be-overlay';
    /* Ensure body exists — wait if not */
    if (document.body) {
      document.body.appendChild(_overlay);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(_overlay);
      });
    }
    return _overlay;
  }

  function clearCard() {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    var ol = getOverlay();
    ol.innerHTML = '';
  }

  function showCard(cfg, subText, subColor, holdMs) {
    clearCard();
    holdMs = holdMs || 2200;
    var ol   = getOverlay();
    var card = document.createElement('div');
    card.className = 'be-card';

    /* ── start invisible and small ── */
    card.style.opacity   = '0';
    card.style.transform = 'scale(0.05)';
    /* JS-driven CSS transition — no @keyframes, works everywhere */
    card.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.15s ease';
    card.style.willChange = 'transform, opacity';

    /* build text lines */
    if (cfg.lines) {
      cfg.lines.forEach(function (txt, i) {
        var el = document.createElement('div');
        el.className    = 'be-text';
        el.textContent  = txt;
        el.style.color  = cfg.colors[i];
        el.style.fontSize = cfg.size;
        el.style.textShadow = '0 0 40px ' + cfg.colors[i] + ',0 0 80px ' + cfg.colors[i];
        card.appendChild(el);
      });
    } else {
      var el = document.createElement('div');
      el.className    = 'be-text';
      el.textContent  = cfg.label;
      el.style.color  = cfg.color;
      el.style.fontSize = cfg.size;
      el.style.textShadow = '0 0 40px ' + cfg.color + ',0 0 80px ' + cfg.color;
      card.appendChild(el);
    }

    if (subText) {
      var sub = document.createElement('div');
      sub.className = 'be-sub';
      sub.textContent = subText;
      sub.style.color = subColor || '#fff';
      sub.style.textShadow = '0 0 22px ' + (subColor || '#fff');
      card.appendChild(sub);
    }

    ol.appendChild(card);

    /* force a reflow so the browser registers the start state before transitioning */
    void card.offsetWidth;

    /* ── animate IN ── */
    card.style.opacity   = '1';
    card.style.transform = 'scale(1)';

    /* ── after hold: animate OUT ── */
    _hideTimer = setTimeout(function () {
      card.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
      card.style.opacity    = '0';
      card.style.transform  = 'scale(0.05)';
      _hideTimer = setTimeout(clearCard, 280);
    }, holdMs);
  }

  /* ── trigger ── */
  function trigger(type, options) {
    options = options || {};
    var t = String(type || '').toUpperCase();
    var b = options.batterName || '';
    switch (t) {
      case 'FOUR':
        showCard(CFG.FOUR, b || null, CFG.FOUR.color);
        break;
      case 'SIX':
        showCard(CFG.SIX, b || null, CFG.SIX.color);
        break;
      case 'WICKET':
        showCard(CFG.WICKET, b ? 'DISMISSED \u00b7 ' + b : null, CFG.WICKET.color, 2400);
        break;
      case 'FIFTY':
        showCard(CFG.FIFTY, b || null, '#94a3b8');
        break;
      case 'HUNDRED':
        showCard(CFG.HUNDRED, b || null, CFG.HUNDRED.color, 2500);
        break;
      case 'NOBALL':
        showCard(CFG.NOBALL, null, null);
        break;
      case 'FREEHIT':
        showCard(CFG.FREEHIT, null, null, 2400);
        break;
      case 'SUPERBALL': {
        var sub = b || null;
        if (sub && options.runs !== undefined) sub = sub + '  \u2605  ' + options.runs + ' RUNS';
        showCard(CFG.SUPERBALL, sub, CFG.SUPERBALL.colors[0], 2400);
        break;
      }
      default:
        console.warn('[BE] Unknown type:', type);
    }
  }

  /* ── BroadcastChannel — same-device tab-to-tab (no server needed) ── */
  var _bc = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      var _matchId = (new URLSearchParams(location.search)).get('matchId') || 'default';
      _bc = new BroadcastChannel('criccast_be_' + _matchId);
      _bc.onmessage = function (e) {
        if (e.data && e.data.type) trigger(e.data.type, e.data.options || {});
      };
    }
  } catch (e) { _bc = null; }

  /* ── Poll fallback — catches broadcast events missed due to SSE drops ──
     Mobile SSE connections drop silently. The server now stores the last
     broadcast at /api/lastbroadcast. We poll it every 1 s and fire the
     animation whenever we see a new ts value.
  ─────────────────────────────────────────────────────────────────────── */
  var _origin = (location.protocol === 'http:' || location.protocol === 'https:') ? location.origin : null;
  var _lastSeenTs = 0;

  if (_origin) {
    setInterval(function () {
      fetch(_origin + '/api/lastbroadcast', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.ts && d.ts > _lastSeenTs) {
            _lastSeenTs = d.ts;
            /* Only fire if the event happened in the last 5 seconds —
               avoids replaying stale events on page load */
            if (Date.now() - d.ts < 5000) {
              trigger(d.type, d.options || {});
            }
          }
        })
        .catch(function () {});
    }, 1000);
  }

  /* ── broadcast helper ── */
  function sendBroadcast(type, opts) {
    /* 1. BroadcastChannel — instant, works even when scoreboard tab is backgrounded */
    if (_bc) {
      try { _bc.postMessage({ type: type, options: opts || {} }); } catch(e) {}
    }
    /* 2. HTTP POST → server SSE → other devices + updates /api/lastbroadcast */
    if (!_origin) return;
    fetch(_origin + '/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, options: opts || {}, matchId: _matchId })
    }).catch(function () {});
  }

  /* ── game hooks — patch addBall / handleWicket ── */
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.addBall !== 'function') return;

    var _fhTimer = null;
    function scheduleFH() {
      if (_fhTimer) clearTimeout(_fhTimer);
      _fhTimer = setTimeout(function () {
        _fhTimer = null;
        trigger('FREEHIT'); sendBroadcast('FREEHIT', {});
      }, 5000);
    }
    function cancelFH() { if (_fhTimer) { clearTimeout(_fhTimer); _fhTimer = null; } }

    if (typeof window.addNb === 'function') {
      var _aNb = window.addNb;
      window.addNb = function () {
        _aNb.apply(this, arguments);
        trigger('NOBALL', {}); sendBroadcast('NOBALL', {}); scheduleFH();
      };
    }

    var _ab = window.addBall;
    window.addBall = function (runs) {
      cancelFH();
      _ab.apply(this, arguments);
      /* B-SIX-LASTBALL fix: end-of-over may have swapped batsmen, so
         window.match.p1 is now the OTHER batter. Read from the just-pushed
         ball event (recorded pre-swap) — it's the source of truth. */
      var lb = null;
      try { lb = window.match.allBalls[window.match.allBalls.length-1]; } catch(e) {}
      var chip   = (lb && lb.chip) || '';
      var batter = (lb && lb.batsman) || '';
      var actual = (lb && typeof lb.runs === 'number') ? lb.runs : runs;
      /* Milestone detection uses the batter's running total post-ball. */
      var batterTotal = 0;
      try {
        var st = batter && window.match.batsmanStats && window.match.batsmanStats[batter];
        if (st && typeof st.runs === 'number') batterTotal = st.runs;
      } catch(e) {}
      var ev = null;
      if      (chip === 'SB')                                          ev = 'SUPERBALL';
      else if (batterTotal >= 100 && (batterTotal - actual) < 100)     ev = 'HUNDRED';
      else if (batterTotal >= 50  && (batterTotal - actual) < 50)      ev = 'FIFTY';
      else if (runs === 6)                                             ev = 'SIX';
      else if (runs === 4)                                             ev = 'FOUR';
      if (ev) {
        var o = { batterName: batter };
        if (ev === 'SUPERBALL') o.runs = actual;
        trigger(ev, o); sendBroadcast(ev, o);
      }
    };

    var _hw = window.handleWicket;
    window.handleWicket = function () {
      cancelFH();
      var b = ''; try { b = window.match.p1.name || ''; } catch(e) {}
      trigger('WICKET', { batterName: b }); sendBroadcast('WICKET', { batterName: b });
      _hw.apply(this, arguments);
    };

    function patchWWR() {
      if (typeof window.handleWicketWithRuns !== 'function' || window.handleWicketWithRuns._bp) return;
      var _hwr = window.handleWicketWithRuns;
      window.handleWicketWithRuns = function (x) {
        cancelFH();
        var b = ''; try { b = window.match.p1.name || ''; } catch(e) {}
        trigger('WICKET', { batterName: b }); sendBroadcast('WICKET', { batterName: b });
        _hwr.apply(this, arguments);
      };
      window.handleWicketWithRuns._bp = true;
    }
    patchWWR();
    setTimeout(patchWWR, 600);
    console.log('[BE] hooks ready.');
  });

  /* ── public API ── */
  global.BroadcastEvents = {
    trigger:   trigger,
    four:      function(o){ trigger('FOUR',      o); },
    six:       function(o){ trigger('SIX',       o); },
    wicket:    function(o){ trigger('WICKET',    o); },
    fifty:     function(o){ trigger('FIFTY',     o); },
    hundred:   function(o){ trigger('HUNDRED',   o); },
    freehit:   function(o){ trigger('FREEHIT',   o); },
    superball: function(o){ trigger('SUPERBALL', o); },
    noball:    function(o){ trigger('NOBALL',    o); },
    send: sendBroadcast,
  };

  console.log('[BE] loaded — JS-transition pop, appended to body.');
})(window);
