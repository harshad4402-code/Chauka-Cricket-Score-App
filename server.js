'use strict';
const express = require('express'), fs = require('fs/promises'), path = require('path'), core = require('./lib/core');
const app = express(), PORT = process.env.PORT || 3000, DIR = process.env.DATA_DIR || path.join(__dirname, 'data'), FILE = path.join(DIR, 'state.json');
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
app.disable('x-powered-by'); app.use(require('compression')());
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': CSP }); next() });
app.use(express.json({ limit: '4mb' }));

/* storage: one JSON file, entities keyed by id. Durable: fsync'd atomic writes, .bak of the previous good file, daily snapshots (14 kept).
   A file that exists but cannot be read is NEVER treated as empty (that used to wipe everything on the next save): the server recovers from .bak or refuses to start saving. */
const EMPTY = () => ({ rev: 0, teams: {}, matches: {}, tours: {}, own: {}, ver: {}, gone: {} });
const byId = a => Array.isArray(a) ? Object.fromEntries(a.filter(x => x && core.isId(x.id)).map(x => [x.id, x])) : (a && typeof a === 'object' ? a : {});
const BAK = FILE + '.bak', SNAP = path.join(DIR, 'backups'), COPY_EXCL = require('fs').constants.COPYFILE_EXCL;
let chain = Promise.resolve(), cache = null;
async function parse(f) {
  const d = JSON.parse(await fs.readFile(f, 'utf8')), s = EMPTY();
  s.rev = +d.rev || 0; ['teams', 'matches', 'tours'].forEach(k => s[k] = byId(d[k]));
  s.own = d.own || {}; s.ver = d.ver || {}; s.gone = d.gone || {};
  if (Array.isArray(d.matches)) for (const m of d.matches) s.ver[m.id] = +m.ver || 0;
  return s;
}
async function read() {
  if (cache) return cache;
  let s;
  try { s = await parse(FILE) }
  catch (e) {
    if (e.code !== 'ENOENT') console.error('state.json unreadable, trying backup:', e.message);
    try { s = await parse(BAK); console.error('Recovered data from state.json.bak') }
    catch (e2) { if (e.code === 'ENOENT' && e2.code === 'ENOENT') s = EMPTY(); else throw e2.code === 'ENOENT' ? e : e2 }
  }
  return cache = s;
}
async function snapshot() {
  try {
    await fs.mkdir(SNAP, { recursive: true });
    await fs.copyFile(FILE, path.join(SNAP, new Date().toISOString().slice(0, 10) + '.json'), COPY_EXCL);
    for (const x of (await fs.readdir(SNAP)).sort().slice(0, -14)) await fs.unlink(path.join(SNAP, x));
  } catch (e) { if (e.code !== 'EEXIST') console.error('snapshot', e.message) }
}
async function write(d) {
  await fs.mkdir(DIR, { recursive: true });
  const t = FILE + '.tmp', h = await fs.open(t, 'w');
  try { await h.writeFile(JSON.stringify(d)); await h.sync() } finally { await h.close() }
  try { await fs.copyFile(FILE, BAK) } catch (e) { if (e.code !== 'ENOENT') console.error('backup', e.message) }
  await fs.rename(t, FILE); await snapshot();
}
const locked = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p };
const pub = s => ({ rev: s.rev, teams: Object.values(s.teams), tours: Object.values(s.tours), matches: Object.values(s.matches).map(m => core.view(m, !!s.own[m.id])), theme: null });

app.get('/api/health', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, admin: core.adminOn(), storage: 'file' }));
const FAIL = {};   /* wrong secret-key attempts per IP: 5 per 10 minutes */
app.get('/api/state', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { const s = await read(); if (req.query.since && +req.query.since === s.rev) return res.json({ rev: s.rev, same: true }); res.json(pub(s)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'Could not read' }) }
});
app.put('/api/state', async (req, res) => {
  if (!core.valid(req.body)) return res.status(400).json({ error: 'Invalid state' });
  const ip = req.ip, f = FAIL[ip], tryAdmin = req.body.admin !== undefined;
  if (tryAdmin && f && f.n >= 5 && Date.now() - f.t < 6e5) return res.status(429).json({ error: 'Too many attempts' });
  try {
    const out = await locked(async () => {
      const s = await read(), p = core.plan({ own: s.own, ver: s.ver, gone: s.gone }, req.body), prev = s.rev;
      let changed = false;
      core.KINDS.forEach(k => { for (const id in p.set[k]) { s[k][id] = p.set[k][id]; changed = true } p.del[k].forEach(id => { delete s[k][id]; delete s.ver[id]; delete s.own[id]; changed = true }) });
      Object.assign(s.own, p.own); Object.assign(s.ver, p.ver); Object.assign(s.gone, p.gone); s.gone = core.gc(s.gone);
      if (changed) { s.rev = Math.max(Date.now(), prev + 1); try { await write(s) } catch (e) { cache = null; throw e } }
      return { rev: s.rev, prev, rej: p.rej };
    });
    if (tryAdmin) { if (out.rej.some(x => x.why === 'admin')) FAIL[ip] = { n: ((f && Date.now() - f.t < 6e5 ? f.n : 0) + 1), t: Date.now() }; else delete FAIL[ip] }
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not save' }) }
});
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders: (res, p) => { res.setHeader('Cache-Control', /[\\/]fonts[\\/]/.test(p) ? 'public, max-age=31536000, immutable' : 'no-cache'); if (/sw\.js$/.test(p)) res.setHeader('Service-Worker-Allowed', '/') }
}));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(400).json({ error: 'Bad request' }));
const srv = app.listen(PORT, () => { console.log('Gully Live running on http://localhost:' + PORT + ' · data: ' + FILE + (core.adminOn() ? ' · delete needs ADMIN_KEY' : ' · ADMIN_KEY not set')); read().then(s => console.log('Loaded', Object.keys(s.matches).length, 'matches,', Object.keys(s.teams).length, 'teams,', Object.keys(s.tours).length, 'tournaments')).catch(e => console.error('DATA FILE PROBLEM, saving is paused until fixed:', e.message)) });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => chain.finally(() => srv.close(() => process.exit(0))));
