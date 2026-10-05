// Supabase proxy. Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, APP_PASSWORD
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY;
const sb = (path, opt = {}) => fetch(`${U}/rest/v1/${path}`, { ...opt, headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', ...(opt.headers || {}) } })
  .then(async r => { const t = await r.text(); if (!r.ok) throw new Error(t); return t ? JSON.parse(t) : null; });
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.APP_PASSWORD || req.headers['x-app-password'] !== process.env.APP_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  const b = req.body || {};
  try {
    if (b.action === 'getKB') { const r = await sb(`yts_kb?channel_id=eq.${encodeURIComponent(b.channel)}&select=data`); return res.json({ data: r[0]?.data || null }); }
    if (b.action === 'setKB') { await sb('yts_kb', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ channel_id: b.channel, data: b.data, updated_at: new Date().toISOString() }) }); return res.json({ ok: true }); }
    if (b.action === 'addLog') { await sb('yts_log', { method: 'POST', body: JSON.stringify({ channel_id: b.channel, video_id: b.video, kind: b.kind, keyword: b.keyword || null, position: b.position ?? null, payload: b.payload || null }) }); return res.json({ ok: true }); }
    if (b.action === 'getLog') { const r = await sb(`yts_log?video_id=eq.${encodeURIComponent(b.video)}&order=created_at.desc&limit=30&select=kind,keyword,position,payload,created_at`); return res.json({ rows: r }); }
    return res.status(400).json({ error: 'bad action' });
  } catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
}
