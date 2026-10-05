// Vercel serverless function. Env: ANTHROPIC_API_KEY (optional: MODEL)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { title = '', description = '', tags = [], keyword = '', notes = '', channel = '', kb = {}, vr = '' } = req.body || {};
  const prompt = `You are a senior YouTube SEO expert. Optimize this video's metadata.
Channel: ${channel}
Current title: ${title}
Current description: ${description.slice(0, 3000)}
Current tags: ${tags.join(', ')}
Target keyword (may be empty, then pick the best one): ${keyword}
Video notes/transcript: ${notes.slice(0, 6000)}

OFFICIAL DATA (the only source of facts):
${(kb.o || 'none').slice(0, 8000)}

PAST EXAMPLES (copy their structure, tone, formatting for title, description, tags, hashtags, FAQs):
${(kb.e || 'none').slice(0, 6000)}

SEO RESEARCH from top-10 ranking videos (entities, attributes, sentiment words):
${(kb.r || '').slice(0, 4000)}
${vr.slice(0, 4000)}

Rules:
- Keep the SAME language/script as the original (Hindi/Hinglish/Marathi/English). Never change the video's meaning.
- Use ONLY facts from official data/notes. Never invent facts, prices, income or earning claims, guarantees, or medical claims.
- Weave the research entities, attributes and sentiment words naturally into title, description, tags and FAQs. No keyword stuffing, do not copy competitor text.
- Title: 50-70 chars, primary keyword in the first 40 chars, 1-2 strongest research terms, click-worthy but honest.
- Description: 250+ words, keyword in first 150 chars, keep original timestamps/links/CTAs. No hashtags and no FAQs inside it.
- FAQs: 4-6 Q&A, answers 1-2 sentences, based on official data.
- Tags: 10-14, total under 450 characters. Hashtags: exactly 3-5, each starting with #.
Return ONLY JSON: {"keyword":"","title":"","description":"","faqs":[{"q":"","a":""}],"tags":[],"hashtags":[]}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-5-5', max_tokens: 3500, messages: [{ role: 'user', content: prompt }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(500).json({ error: j.error?.message || 'AI error' });
    const text = j.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    return res.status(200).json(JSON.parse(text));
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
