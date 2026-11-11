// Vercel serverless function: GET/PUT /api/state
// Storage: Upstash Redis (add it from Vercel Marketplace -> Storage). Without it the app still works,
// saving on the device only (the frontend falls back to localStorage when this returns 503).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'chauka:state';
const EMPTY = { rev: 0, teams: [], matches: [], tours: [], theme: null };

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).result;
}
const valid = d => d && typeof d === 'object' && ['teams', 'matches', 'tours'].every(k => Array.isArray(d[k]));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'Storage not configured' });
  try {
    if (req.method === 'GET') {
      const v = await redis(['GET', KEY]);
      return res.status(200).json(v ? JSON.parse(v) : EMPTY);
    }
    if (req.method === 'PUT') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!valid(b)) return res.status(400).json({ error: 'Invalid state' });
      const d = { rev: Date.now(), teams: b.teams, matches: b.matches, tours: b.tours, theme: b.theme || null };
      await redis(['SET', KEY, JSON.stringify(d)]);
      return res.status(200).json({ rev: d.rev });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Storage error' });
  }
};
