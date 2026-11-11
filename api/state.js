// Vercel serverless function: GET/PUT /api/state
// Storage: Upstash Redis (Vercel Marketplace -> Storage). Without it the app still works,
// saving on each device only (the frontend falls back to localStorage when this returns 503).
// Every match/team/tournament is its own Redis hash field, so two scorers never overwrite each other.
const core = require('../lib/core');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const K = { rev: 'gl:rev', teams: 'gl:teams', matches: 'gl:matches', tours: 'gl:tours', own: 'gl:own', ver: 'gl:ver', gone: 'gl:gone' };
const OLD = 'chauka:state';   // single-JSON format used by earlier versions

async function pipe(cmds) {
  const r = await fetch(URL_ + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error('redis ' + r.status);
  const j = await r.json();
  return j.map(x => { if (x && x.error) throw new Error('redis: ' + x.error); return x.result });
}
const obj = r => { if (!r) return {}; if (!Array.isArray(r)) return r; const o = {}; for (let i = 0; i < r.length; i += 2) o[r[i]] = r[i + 1]; return o };
const parsed = o => { const m = {}; for (const k in o) { try { m[k] = JSON.parse(o[k]) } catch (e) {} } return m };
const hset = (key, o) => { const a = []; for (const k in o) a.push(k, typeof o[k] === 'string' ? o[k] : JSON.stringify(o[k])); return a.length ? [['HSET', key, ...a]] : [] };

let ready = false;
async function ensure() {
  if (ready) return;
  const [rev] = await pipe([['GET', K.rev]]);
  if (rev == null) {                       // first run: upgrade old single-JSON data if present
    const [old] = await pipe([['GET', OLD]]);
    let d; try { d = old && JSON.parse(old) } catch (e) {}
    const cmds = [];
    if (core.valid(d)) {
      ['teams', 'matches', 'tours'].forEach(k => cmds.push(...hset(K[k], Object.fromEntries(d[k].filter(x => x && core.isId(x.id)).map(x => [x.id, x])))));
      cmds.push(...hset(K.ver, Object.fromEntries(d.matches.filter(m => m && core.isId(m.id)).map(m => [m.id, String(+m.ver || 0)]))));
    }
    cmds.push(['SETNX', K.rev, String((core.valid(d) && +d.rev) || 0)]);
    await pipe(cmds);
  }
  ready = true;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'Storage not configured' });
  try {
    await ensure();
    if (req.method === 'GET') {
      const since = req.query && req.query.since;
      if (since) { const [rev] = await pipe([['GET', K.rev]]); if (String(rev) === String(since)) return res.status(200).json({ rev: +rev, same: true }) }
      const [rev, t, m, o, own] = await pipe([['GET', K.rev], ['HGETALL', K.teams], ['HGETALL', K.matches], ['HGETALL', K.tours], ['HGETALL', K.own]]);
      const owned = obj(own), matches = parsed(obj(m));
      return res.status(200).json({ rev: +rev || 0, teams: Object.values(parsed(obj(t))), tours: Object.values(parsed(obj(o))), matches: Object.values(matches).map(x => core.view(x, !!owned[x.id])), theme: null });
    }
    if (req.method === 'PUT') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!core.valid(b)) return res.status(400).json({ error: 'Invalid state' });
      const ids = core.ids(b);
      let ctx = { own: {}, ver: {}, gone: {} }, prev = 0;
      if (ids.length) {
        const [rev, own, ver, gone] = await pipe([['GET', K.rev], ['HMGET', K.own, ...ids], ['HMGET', K.ver, ...ids], ['HMGET', K.gone, ...ids]]);
        prev = +rev || 0;
        ids.forEach((id, i) => { if (own[i]) ctx.own[id] = own[i]; if (ver[i]) ctx.ver[id] = +ver[i]; if (gone[i]) ctx.gone[id] = +gone[i] });
      } else { const [rev] = await pipe([['GET', K.rev]]); prev = +rev || 0 }
      const p = core.plan(ctx, b);
      // claim ownership atomically; if someone else claimed first, drop our write for that match
      const claims = Object.keys(p.own);
      if (claims.length) {
        const r = await pipe(claims.map(id => ['HSETNX', K.own, id, p.own[id]]));
        claims.forEach((id, i) => { if (!r[i]) { delete p.set.matches[id]; delete p.ver[id]; p.rej.push({ id, why: 'key' }) } });
      }
      const cmds = [];
      core.KINDS.forEach(k => { cmds.push(...hset(K[k], p.set[k])); if (p.del[k].length) { cmds.push(['HDEL', K[k], ...p.del[k]]); cmds.push(['HDEL', K.own, ...p.del[k]]); cmds.push(['HDEL', K.ver, ...p.del[k]]) } });
      cmds.push(...hset(K.ver, Object.fromEntries(Object.entries(p.ver).map(([k, v]) => [k, String(v)]))));
      cmds.push(...hset(K.gone, Object.fromEntries(Object.entries(p.gone).map(([k, v]) => [k, String(v)]))));
      let rev = prev;
      if (cmds.length) { rev = Math.max(Date.now(), prev + 1); cmds.push(['SET', K.rev, String(rev)]); await pipe(cmds) }
      return res.status(200).json({ rev, prev, rej: p.rej });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Storage error' });
  }
};
