'use strict';
/* Shared server logic (Express server and Vercel function use the same rules).
   Rules:
   - Every live match has an owner: the scorer's secret key. Only its SHA-256 hash is stored.
   - Only a request that proves the key can change or delete that match. Everyone else is read-only.
   - Writes are merged by id. A stale or offline device can never wipe other people's data.
   - Each match carries a `ver`; an older copy never overwrites a newer one.
   - Deleted ids are remembered (tombstones) so a stale device cannot bring them back. */
const crypto = require('crypto');
const KINDS = ['teams', 'matches', 'tours'];
const H = k => crypto.createHash('sha256').update(String(k)).digest('hex');
const isId = s => typeof s === 'string' && s.length > 0 && s.length <= 64 && /^[\w-]+$/.test(s);
const okKey = k => typeof k === 'string' && k.length >= 8 && k.length <= 128;
const eq = (a, b) => { try { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y) } catch (e) { return false } };
const valid = d => !!d && typeof d === 'object' && KINDS.every(k => Array.isArray(d[k])) && KINDS.every(k => d[k].length <= 5000);
const arr = a => Array.isArray(a) ? a : [];
/* ADMIN_KEY (env): when set, a match can only be deleted by a request that proves this secret key. */
const ADMIN = () => String(process.env.ADMIN_KEY || '');

/* ids a request touches (used to fetch only those from storage) */
function ids(body) {
  const s = new Set();
  KINDS.forEach(k => { arr(body[k]).forEach(x => x && isId(x.id) && s.add(x.id)); arr(body.del && body.del[k]).forEach(i => isId(i) && s.add(i)) });
  return [...s];
}

/* ctx = { own:{id:hash}, ver:{id:n}, gone:{id:ts} } for the ids in the request */
function plan(ctx, body) {
  const keys = body.keys && typeof body.keys === 'object' ? body.keys : {};
  const out = { set: { teams: {}, matches: {}, tours: {} }, del: { teams: [], matches: [], tours: [] }, own: {}, gone: {}, ver: {}, rej: [] };
  const now = Date.now(), dead = new Set(), adm = ADMIN(), admOk = !!adm && typeof body.admin === 'string' && eq(H(body.admin), H(adm));
  const proves = id => okKey(keys[id]) && ctx.own[id] && eq(H(keys[id]), ctx.own[id]);
  KINDS.forEach(k => arr(body.del && body.del[k]).forEach(id => {
    if (!isId(id)) return;
    if (k === 'matches') {
      if (adm) { if (!admOk) { out.rej.push({ id, why: 'admin' }); return } }
      else if (ctx.own[id] && !proves(id)) { out.rej.push({ id, why: 'key' }); return }
    }
    out.del[k].push(id); out.gone[id] = now; dead.add(id);
  }));
  KINDS.forEach(k => arr(body[k]).forEach(x => {
    if (!x || typeof x !== 'object' || !isId(x.id) || dead.has(x.id) || ctx.gone[x.id]) return;
    const v = +(k === 'matches' ? x.ver : x.u) || 0, sv = +ctx.ver[x.id] || 0;
    if (k === 'matches') {
      if (ctx.own[x.id]) {
        if (!proves(x.id)) { out.rej.push({ id: x.id, why: 'key' }); return }
      } else if (okKey(keys[x.id])) out.own[x.id] = H(keys[x.id]);      /* first writer claims the match */
      if (v < sv) { out.rej.push({ id: x.id, why: 'ver' }); return }
      const c = { ...x }; delete c.lk;
      c.inn = arr(c.inn).map(n => { if (!n || typeof n !== 'object') return n; const q = { ...n }; delete q.h; return q });   /* undo history stays on the scorer's device */
      out.set.matches[x.id] = c; out.ver[x.id] = v;
    } else {
      if (v < sv) return;
      out.set[k][x.id] = x; out.ver[x.id] = v;
    }
  }));
  return out;
}

const view = (m, own) => own ? { ...m, lk: 1 } : m;
const gc = gone => { const t = Date.now() - 30 * 864e5, o = {}; for (const k in gone) if (gone[k] > t) o[k] = gone[k]; return o };

module.exports = { adminOn: () => !!ADMIN(), KINDS, H, isId, valid, ids, plan, view, gc, arr };
