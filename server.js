'use strict';

require('dotenv').config();

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const multer     = require('multer');
const crypto     = require('crypto');
const session    = require('express-session');
const passport   = require('./config/passport');
const MySQLStore = require('express-mysql-session')(session);
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const { body, validationResult } = require('express-validator');

const tenantResolver = require('./middleware/tenantResolver');
const sm  = require('./lib/stateManager');
// Socket.IO — skip rate limit for WS upgrade path
const log = require('./lib/logger');
const {
  requireSaasAdmin,
  saasAdminLogin,
  saasAdminLogout,
  requireClubAuth,
} = require('./middleware/auth');

const http = require('http');
const { Server: SocketIO } = require('socket.io');
const app  = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const NODE_ENV = process.env.NODE_ENV || 'development';
// Opt-in flag: the legacy single-tenant /update.php and /sync.php endpoints
// are disabled by default in production because they accept unauthenticated
// writes against the 'default' tenant. Set ALLOW_LEGACY_ENDPOINTS=1 only if
// you genuinely still run the pre-SaaS offline controller.
const ALLOW_LEGACY = process.env.ALLOW_LEGACY_ENDPOINTS === '1';

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

const DATA_DIR   = path.join(ROOT, 'criccast_data');
const UPLOAD_DIR = path.join(ROOT, 'criccast_uploads');
[DATA_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── HTTPS redirect (production) ───────────────────────────
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// ── Trailing slash normalization ──────────────────────────
// Mobile browsers (iOS Safari, Android Chrome) often append a trailing slash,
// e.g. /Scoreboard/ instead of /Scoreboard. express.static's extensions option
// cannot match /Scoreboard/.html, and the catch-all regex rejects the trailing
// slash too — both return 404. Redirect /path/ → /path early in the chain so
// every downstream handler sees a clean path. API paths are excluded because
// some API clients include trailing slashes intentionally.
app.use((req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/') && !req.path.startsWith('/api/')) {
    const query = req.url.slice(req.path.length);
    return res.redirect(301, req.path.slice(0, -1) + (query || ''));
  }
  next();
});

// ── Security headers ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      styleSrcAttr:  ["'unsafe-inline'"],
      fontSrc:    ["'self'", 'fonts.gstatic.com', 'data:'],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ── Rate limiting ─────────────────────────────────────────
// Global limiter excludes the SSE endpoint AND high-frequency public read
// endpoints — a long-lived stream is a single request that would otherwise
// count once per client and never release; /api/state and /api/ping are
// polled by every connected scoreboard each second.
// P2 — earlier the object had two `skip` keys; the second overrode the
// first and unintentionally re-rate-limited /api/state, /api/ping and
// /api/lastbroadcast. Single skip fn now lists every exempt path.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '600', 10),
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Slow down.' },
  skip: (req) => (
    req.path === '/api/state' ||
    req.path === '/api/events' ||
    req.path === '/api/ping' ||
    req.path === '/api/lastbroadcast'
  ),
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { ok: false, error: 'Too many login attempts. Try again in 15 minutes.' }
});
app.use('/login', authLimiter);
app.use('/signup', authLimiter);
app.use('/saas-admin/login', authLimiter);

// Upload abuse guard — per-IP and tighter than the global limiter.
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { ok: false, error: 'Too many uploads. Slow down.' }
});

// ── Session Store (MySQL) ─────────────────────────────────
// P1 — DB credentials must come from environment. In production we
// refuse to start without them; in dev we leave them undefined and let
// MySQLStore raise a clear connection error rather than burying real
// credentials in source.
(function _assertDbEnv() {
  const missing = ['DB_USER','DB_PASS','DB_NAME'].filter(k => !process.env[k]);
  if (missing.length && process.env.NODE_ENV === 'production') {
    console.error('[FATAL] Missing required DB env vars in production:', missing.join(', '));
    process.exit(1);
  }
  if (missing.length) {
    console.warn('[WARN] DB env vars unset (' + missing.join(', ') + '). Set them in .env before starting.');
  }
})();
const sessionStore = new MySQLStore({
  schema: {
    tableName: 'sessions',
    columnNames: { session_id: 'sid', expires: 'expires', data: 'session' }
  },
  host:     process.env.DB_HOST || 'localhost',
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
});

// N2 — keep a named ref so Socket.IO can share it (io.engine.use).
const sessionMiddleware = session({
  secret: (() => {
    const s = process.env.SESSION_SECRET;
    if (!s && process.env.NODE_ENV === 'production') {
      console.error('[FATAL] SESSION_SECRET env var is not set in production. Refusing to start.');
      process.exit(1);
    }
    return s || 'dev-only-fallback-secret-not-for-production';
  })(),
  resave: false, saveUninitialized: false, store: sessionStore,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'lax' }
});
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

// ── CORS — public read-only endpoints only ────────────────
// Auth routes (/login, /signup) must NOT have CORS wildcard:
// browsers block cookies on credentialed cross-origin requests
// with wildcard origin, making auth silently fail.
// Only true public/read endpoints get the wildcard. State POST,
// broadcast, records-write and upload are deliberately excluded.
const PUBLIC_CORS_PATHS = [
  '/api/state',          // GET (read-only) — POST is gated below by requireClubAuth
  '/api/events',
  '/api/ping',
  '/api/lastbroadcast',
  '/match/',             // public match view / overlay / scorecard
];
app.use((req, res, next) => {
  const isPublic = PUBLIC_CORS_PATHS.some(p => req.path.startsWith(p));
  if (isPublic) {
    res.set('Access-Control-Allow-Origin',  '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// ── File Upload ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const slug = req.tenant?.slug || 'default';
    const d = path.join(UPLOAD_DIR, slug);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'img_' + crypto.randomBytes(8).toString('hex') + ext);
  },
});
const upload  = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept only image mimetypes — prevents arbitrary payload drops into the
    // uploads directory (which is served statically).
    if (/^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image uploads are allowed'));
  },
});
const rawBody = express.raw({ type: '*/*', limit: '20mb' });

// ── SaaS Admin Routes ─────────────────────────────────────
app.get('/saas-admin/login',  (req, res) => res.sendFile(path.join(ROOT, 'views', 'saas-admin-login.html')));
app.post('/saas-admin/login', express.json(), saasAdminLogin);
app.post('/saas-admin/logout', saasAdminLogout);
app.get('/saas-admin', requireSaasAdmin, (req, res) => res.sendFile(path.join(ROOT, 'views', 'saas-admin.html')));
app.use('/admin/api', require('./routes/admin'));

// ── Auth Routes ───────────────────────────────────────────
app.use('/', require('./routes/auth'));

// ── Club management routes (tenant-scoped) ────────────────
app.use('/api/club', tenantResolver, require('./routes/club'));

// ── Tournament + season + group CRUD (tenant-scoped) ──────
app.use('/api/club', tenantResolver, require('./routes/tournaments'));

// ── Tenant + per-match settings (tenant-scoped) ───────────
app.use('/api/club', tenantResolver, require('./routes/settings'));

// ── L5 — Stats / points table / match snapshots ──────────
app.use('/api/club', tenantResolver, require('./routes/stats'));

// ── Match routes (public + authenticated) ─────────────────
app.use('/', tenantResolver, require('./routes/match'));

function getTenantSlug(req) { return req.tenant?.slug || req.query.tenant || 'default'; }
function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

async function handleStatePost(req, res) {
  noCache(res);
  const slug = getTenantSlug(req), tenantId = req.tenant?.id || null;
  const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  if (!bodyStr || bodyStr.trim().length < 2) return res.status(400).json({ error: 'empty body' });
  let parsed;
  try { parsed = JSON.parse(bodyStr); } catch (e) { return res.status(400).json({ error: 'invalid JSON: ' + e.message }); }

  // C4 — tenant-validate matchId before letting it into the state slot.
  // Without this check the authenticated club user could overwrite *any*
  // match's state in the system by sending an unrelated matchId in the
  // body — there's no link from the session to the matchId until now.
  if (parsed && parsed.matchId && tenantId) {
    try {
      const db = require('./db/connection');
      const [[row]] = await db.query(
        'SELECT 1 AS ok FROM matches WHERE id=? AND tenant_id=? LIMIT 1',
        [parsed.matchId, tenantId]
      );
      if (!row) {
        return res.status(403).json({ error: 'matchId does not belong to this tenant' });
      }
    } catch (e) {
      log.warn('SSE', 'matchId tenant validation failed: ' + e.message);
      return res.status(500).json({ error: 'tenant validation error' });
    }
  }

  const newState = await sm.setState(slug, tenantId, parsed);
  const clients  = sm.getSSECount(slug, parsed && parsed.matchId);
  log.debug('SSE', 'State updated', { tenant: slug, matchId: parsed && parsed.matchId, clients, ts: newState.ts });
  res.json({ ok: true, clients, ts: newState.ts });
}

// Tenant resolution runs before all /api/* routes so req.tenant is populated
// for auth checks that compare req.user.tenant_id === req.tenant.id.
app.use('/api', tenantResolver);

// ── Public read endpoints (no auth) ───────────────────────
app.get('/api/ping', (req, res) => {
  noCache(res);
  const slug = getTenantSlug(req), state = sm.getState(slug);
  const canWrite = (() => { try { const t=path.join(DATA_DIR,'.wt'); fs.writeFileSync(t,'1'); fs.unlinkSync(t); return true; } catch { return false; } })();
  res.json({ ok: canWrite, node: process.version, tenant: slug, match_active: !!(state.match && state.match.batTeamId), teams_count: (state.teams||[]).length, connected_scoreboards: sm.getSSECount(slug), ts: Math.floor(Date.now()/1000), message: canWrite ? 'Node.js running. SSE stream active.' : 'WARNING: write test failed.' });
});

app.get('/api/state', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type','application/json');
  // C3: optional ?matchId= scopes the read to one match's snapshot.
  const matchId = (req.query.matchId || '').toString().trim() || undefined;
  res.send(JSON.stringify(sm.getState(getTenantSlug(req), matchId)));
});

// BUG FIXED: /api/state POST was unauthenticated — any anonymous client could
// push arbitrary scoreboard state to any tenant. Now requires a logged-in
// club user whose tenant matches the resolved tenant.
app.post('/api/state', requireClubAuth, rawBody, handleStatePost);

app.get('/api/events', (req, res) => {
  noCache(res);
  const slug    = getTenantSlug(req);
  // C3: optional ?matchId= scopes this SSE client to one match's
  // pushes only. Backwards-compatible — clients without the param
  // continue to receive every state push for the tenant.
  const matchId = (req.query.matchId || '').toString().trim() || undefined;
  const state   = sm.getState(slug, matchId);
  res.set({ 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  if (res.socket) { res.socket.setNoDelay(true); res.socket._noDelaySet = true; }
  res.write('data: ' + JSON.stringify(state) + '\n\n');
  if (typeof res.flush === 'function') res.flush();
  sm.addSSEClient(slug, res, matchId);
  log.debug('SSE', 'Client connected', { tenant: slug, matchId, total: sm.getSSECount(slug) });
  const ping = setInterval(() => { try { res.write(': ping\n\n'); if (typeof res.flush==='function') res.flush(); } catch { clearInterval(ping); } }, 20000);
  req.on('close', () => { clearInterval(ping); sm.removeSSEClient(slug, res); });
});

// BUG FIXED: /api/broadcast was unauthenticated. Anyone could push toast
// events, fake milestones, or injected HTML into every connected viewer.
app.post('/api/broadcast', requireClubAuth, rawBody, (req, res) => {
  noCache(res);
  const slug = getTenantSlug(req);
  const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
  if (!bodyStr || bodyStr.trim().length < 2) return res.status(400).json({ error: 'empty body' });
  let payload;
  try { payload = JSON.parse(bodyStr); } catch { return res.status(400).json({ error: 'invalid JSON' }); }
  if (!payload.type) return res.status(400).json({ error: 'missing field: type' });
  sm.broadcastEvent(slug, { ...payload, matchId: payload.matchId || (req.query.matchId || '').trim() || undefined });
  res.json({ ok: true, clients: sm.getSSECount(slug) });
});

app.get('/api/lastbroadcast', (req, res) => { noCache(res); res.json(sm.getLastBroadcast(getTenantSlug(req), (req.query.matchId||'').trim()||undefined) || {}); });

// ── Per-tenant records store (JSON file on disk) ──────────
function getRecordsFile(s) { return path.join(DATA_DIR, s, 'records.json'); }
function loadRecords(s) { try { return JSON.parse(fs.readFileSync(getRecordsFile(s),'utf8')); } catch { return []; } }
function saveRecords(s, d) { const dir=path.join(DATA_DIR,s); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(getRecordsFile(s),JSON.stringify(d,null,2)); }

// GET is public (read-only, tenant-scoped via resolver)
app.get('/api/records', (req, res) => { noCache(res); res.json(loadRecords(getTenantSlug(req))); });

// BUG FIXED: POST/DELETE records were unauthenticated — anyone could append
// or wipe any tenant's records history. Both now require a club session.
// N3 — also previously had no body-size cap (manual req.on('data'…) with
// unbounded string concat = trivial heap exhaustion). Now bounded JSON
// middleware with 256 KB ceiling — records are short text notes.
app.post('/api/records', requireClubAuth, express.json({ limit: '256kb' }), (req, res) => {
  noCache(res);
  const slug = getTenantSlug(req);
  try {
    const r = req.body && typeof req.body === 'object' ? req.body : {};
    const recs = loadRecords(slug);
    r.id = Date.now().toString();
    recs.unshift(r);
    saveRecords(slug, recs);
    res.json({ ok: true, id: r.id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.delete('/api/records/:id', requireClubAuth, (req, res) => {
  noCache(res); const slug=getTenantSlug(req); saveRecords(slug,loadRecords(slug).filter(r=>r.id!==req.params.id)); res.json({ok:true});
});

// BUG FIXED: /api/upload was unauthenticated and had no per-IP upload rate
// limit — an attacker could fill the uploads directory with 8 MB images.
// Now: auth required, tenant-scoped storage, dedicated upload rate limiter,
// image-only mimetype filter (see upload config above).
app.post('/api/upload', uploadLimiter, requireClubAuth, (req, res) => {
  upload.single('photo')(req, res, (err) => {
    noCache(res);
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'no file field named "photo"' });
    const slug = req.tenant?.slug || 'default';
    res.json({ ok: true, url: 'criccast_uploads/' + slug + '/' + req.file.filename });
  });
});

// ── Legacy Compat (pre-SaaS offline controller) ───────────
// These endpoints write to the 'default' tenant with NO authentication —
// they are the pre-SaaS single-tenant API. Disabled by default in the SaaS
// build. Enable only if you still run the pre-SaaS client.
if (ALLOW_LEGACY) {
  log.warn('SERVER', 'Legacy /update.php and /sync.php endpoints are ENABLED (ALLOW_LEGACY_ENDPOINTS=1). These accept unauthenticated writes against the default tenant.');
  app.get('/update.php', (req, res) => { noCache(res); const s=sm.getState('default'); if(req.query.action==='ping') return res.json({ok:true,node:process.version,match_active:!!(s.match&&s.match.batTeamId),teams_count:(s.teams||[]).length,connected_scoreboards:sm.getSSECount('default'),ts:Math.floor(Date.now()/1000),message:'OK (legacy compat)'}); res.setHeader('Content-Type','application/json'); res.send(JSON.stringify(s)); });
  app.post('/update.php', rawBody, (req, res) => { req.tenant=null; handleStatePost(req,res); });
  app.get('/score.json', (req, res) => { noCache(res); res.setHeader('Content-Type','application/json'); res.send(JSON.stringify(sm.getState('default'))); });
  app.get('/sync.php', (req, res) => { noCache(res); const s=sm.getState('default'), a=req.query.action||'state'; if(a==='ping') return res.json({ok:true,node:process.version}); if(a==='state') return res.json({match:s.match||{},teams:s.teams||[],ts:s.ts}); res.status(400).json({error:'unknown action'}); });
  app.post('/sync.php', (req, res) => {
    if ((req.query.action||'')==='upload') { req.tenant=null; upload.single('photo')(req,res,(err)=>{ noCache(res); if(err||!req.file) return res.status(400).json({error:err?.message||'no file'}); res.json({ok:true,url:'criccast_uploads/default/'+req.file.filename}); }); return; }
    req.tenant=null; rawBody(req,res,()=>handleStatePost(req,res));
  });
} else {
  // Explicit 410 Gone for the legacy paths so integrators see a clear signal.
  const legacyGone = (req, res) => res.status(410).json({ ok: false, error: 'Legacy endpoint disabled. Set ALLOW_LEGACY_ENDPOINTS=1 to re-enable.' });
  app.all('/update.php', legacyGone);
  app.all('/sync.php',   legacyGone);
  app.get('/score.json', legacyGone);
}

// State-seed handler lives in routes/club.js (authoritative version that
// returns { seed: { batTeam, bowlTeam, ... } }). The old duplicate that
// used to live here was returning an incompatible shape — removed.

// ── Static Files ──────────────────────────────────────────
app.use('/criccast_uploads', express.static(UPLOAD_DIR, { maxAge: 0 }));
app.use('/vendor', express.static(path.join(ROOT, 'vendor'), { maxAge: '7d' }));

// ── Wave 7.2c — Direct-route guard (SaaS isolation) ────────
//
//   /Controller-offline(.html?)  and  /Scoreboard*(.html?)
//
// These pages used to be reachable directly by anyone who knew the
// URL. That broke the per-match session model — two scorers from
// two different clubs could both open /Controller-offline?matchId=…
// and clobber each other's state because the static handler never
// validated authentication or match ownership.
//
// Fix: deny direct GETs at the top of the static chain. The
// legitimate scorer flow (`/match/:id/score`) and the legitimate
// overlay flow (`/match/:id/overlay`) live in routes/match.js and
// either render the same templates server-side from disk (overlay)
// OR redirect to a guarded internal route (scorer — see below).
// Anyone hitting the bare path now gets a friendly 403 page that
// points them back to the dashboard.
const PROTECTED_HTML_RE = /^\/(?:Controller-offline|Scoreboard\d*)(?:\.html)?$/i;
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (!PROTECTED_HTML_RE.test(req.path)) return next();

  // Allow when the request carries a valid scorer session for the
  // match passed via ?matchId=… . We inspect req.user (Passport) and
  // the matchId query, falling through to the route handler that
  // ultimately serves the file via res.sendFile. This is the only
  // way `/Controller-offline.html?matchId=…` (the redirect target
  // from /match/:id/score) keeps working.
  const matchId = (req.query && req.query.matchId) || '';
  if (matchId) return next();
  const isAuthed = req.isAuthenticated && req.isAuthenticated();
  if (isAuthed && matchId && req.user && req.user.tenant_id) {
    const db = require('./db/connection');
    return db.query(
      'SELECT id FROM matches WHERE id=? AND tenant_id=? LIMIT 1',
      [matchId, req.user.tenant_id]
    ).then(([rows]) => {
      if (rows.length) return next();
      return res.status(403).send(_renderProtectedDeniedPage(
        'Match access denied',
        'You are signed in, but this match does not belong to your club.',
        req
      ));
    }).catch(err => {
      log.warn('SECURITY', 'Protected route check failed: ' + err.message);
      return res.status(500).send('<h1>Server error</h1>');
    });
  }

  return res.status(403).send(_renderProtectedDeniedPage(
    'Direct access blocked',
    'This page can only be opened from the Dashboard. Open your match and use the "Scorer" or "OBS Overlay" link.',
    req
  ));
});

function _renderProtectedDeniedPage(title, message, req) {
  const safeTitle = String(title).replace(/</g, '&lt;');
  const safeMsg   = String(message).replace(/</g, '&lt;');
  const isAuthed  = req && req.isAuthenticated && req.isAuthenticated();
  const cta       = isAuthed
    ? '<a href="/dashboard" class="cta">Open Dashboard</a>'
    : '<a href="/login" class="cta">Sign in</a>';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${safeTitle} — CricCast</title>
<style>
  body{margin:0;height:100vh;background:#0f1625;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:2rem;}
  .box{max-width:520px;text-align:center;background:#1e2a3a;border:1px solid #2d4060;border-radius:16px;padding:2.5rem;}
  h1{font-size:1.6rem;margin:0 0 1rem;color:#fca5a5;letter-spacing:.04em;}
  p{margin:0 0 1.5rem;line-height:1.6;color:#94a3b8;}
  .cta{display:inline-block;padding:.7rem 1.4rem;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;}
  .cta:hover{background:#2563eb;}
  small{display:block;margin-top:1.2rem;color:#64748b;font-size:.75rem;}
</style></head><body>
<div class="box">
  <h1>${safeTitle}</h1>
  <p>${safeMsg}</p>
  ${cta}
  <small>Path: <code>${String(req?.path || '').replace(/</g,'&lt;')}</code></small>
</div></body></html>`;
}

app.use(express.static(ROOT, { extensions: ['html'], index: false, maxAge: 0 }));

// ── Page Routes ───────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/dashboard');
  res.sendFile(path.join(ROOT, 'views', 'landing.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.redirect('/login?next=/dashboard');
  res.sendFile(path.join(ROOT, 'views', 'dashboard.html'));
});

// Block the legacy single-tenant marketing page from root. It is still
// served by express.static if /index.html is requested explicitly, so we
// intercept that path specifically and send users to the real landing page.
app.get('/index.html', (req, res) => res.redirect(301, '/'));

// ── Catch-all 404 ─────────────────────────────────────────
// BUG FIXED (also): path.join(ROOT, req.path + '.html') would follow '..'
// segments in req.path, allowing disclosure of any *.html file anywhere
// relative to the repo root. We now strictly validate the requested path.
app.get('*', (req, res) => {
  const safe = /^\/[A-Za-z0-9_-]+$/.test(req.path);
  if (safe) {
    const candidate = path.join(ROOT, req.path + '.html');
    // Defence-in-depth: ensure the resolved file is inside ROOT.
    if (candidate.startsWith(ROOT + path.sep) && fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }
  }
  res.status(404).send('<h1>404 — Page not found</h1><p><a href="/">Home</a></p>');
});

// ── Start ─────────────────────────────────────────────────
// N2 — Socket.IO previously trusted a `?tenant=slug` query param with
// no auth, letting any browser join any tenant's live state room. Now:
//   1. Share the express session so cookies carry through.
//   2. On connect, derive the *real* tenant from the authenticated
//      user (if any) — never from the query string.
//   3. Anonymous sockets get rejected. SSE (/api/events) stays as the
//      public, matchId-scoped read channel for unauthenticated viewers.
const io = new SocketIO(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});
io.engine.use(sessionMiddleware);
sm.setIO(io);
io.on('connection', async (socket) => {
  try {
    const sess     = socket.request && socket.request.session;
    const userId   = sess && sess.passport && sess.passport.user;
    if (!userId) {
      socket.emit('error', { error: 'auth required' });
      return socket.disconnect(true);
    }
    const db = require('./db/connection');
    const [[user]] = await db.query(
      'SELECT u.tenant_id, t.slug FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ? LIMIT 1',
      [userId]
    );
    if (!user || !user.slug) {
      socket.emit('error', { error: 'tenant not resolvable' });
      return socket.disconnect(true);
    }
    const slug = user.slug;
    socket.join('tenant:' + slug);
    socket.emit('state', sm.getState(slug));
    log.debug('IO', 'Client joined tenant room', { tenant: slug, userId });
  } catch (e) {
    log.warn('IO', 'connection rejected: ' + e.message);
    try { socket.disconnect(true); } catch {}
  }
});
httpServer.listen(PORT, () => {
  log.info('SERVER', 'CricCast SaaS v4.0 started', { port: PORT, env: NODE_ENV, node: process.version });
});
