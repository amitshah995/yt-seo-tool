// Vercel serverless function. Set env var ANTHROPIC_API_KEY (optional: MODEL)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { title = '', description = '', tags = [], keyword = '', notes = '', channel = '' } = req.body || {};
  const prompt = `You are a senior YouTube SEO expert. Optimize this video's metadata.
Channel: ${channel}
Current title: ${title}
Current description: ${description.slice(0, 3000)}
Current tags: ${tags.join(', ')}
Target keyword (may be empty, then pick the best one): ${keyword}
Extra notes/transcript: ${notes.slice(0, 6000)}

Rules:
- Keep the SAME language/script as the original (Hindi/Hinglish/English). Never change the video's meaning.
- Title: 50-70 chars, primary keyword in the first 40 chars, click-worthy, no clickbait lies.
- Description: 250+ words, keyword in first 150 chars, natural keyword variations, short intro, what viewers learn, timestamps placeholder only if present in the original (keep original timestamps/links/CTAs). Do NOT put hashtags inside.
- Tags: 10-14 tags, total under 450 characters, mix of exact keyword, long-tail, related.
- Hashtags: exactly 3-5, each starting with #, no spaces.
Return ONLY JSON: {"keyword":"","title":"","description":"","tags":[],"hashtags":[]}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.MODEL || 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(500).json({ error: j.error?.message || 'AI error' });
    const text = j.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(text));
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
