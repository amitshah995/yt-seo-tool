// Vercel serverless function. Env: ANTHROPIC_API_KEY, APP_PASSWORD (optional: MODEL)
const compose = (j, ch = []) => {
  let d = (j.description || '').replace(/\s*#[\p{L}\p{N}_]+/gu, '').trim();
  const f = (j.faqs || []).map(x => 'Q: ' + x.q + '\nA: ' + x.a).join('\n\n');
  if (f) d += '\n\nFAQs\n' + f;
  const c = ch.map((x, i) => x.t + ' ' + ((j.chapter_titles || [])[i] || '')).join('\n'); if (c) d += '\n\n' + c;
  const h = (j.hashtags || []).join(' ');
  return h ? d + '\n\n' + h : d;
};
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.APP_PASSWORD || req.headers['x-app-password'] !== process.env.APP_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  const { title = '', description = '', tags = [], keyword = '', notes = '', channel = '', kb = {}, vr = '', len = {}, chapters = [] } = req.body || {};
  const cmin = +len.cmin || 4800, cmax = +len.cmax || 5000, wmin = +len.wmin || 700, wmax = +len.wmax || 850;
  const prompt = `You are a senior YouTube SEO expert. Optimize this video's metadata.
Channel: ${channel}
Current title: ${title}
Current description: ${description.slice(0, 3000)}
Current tags: ${tags.join(', ')}
Target keyword (may be empty, then pick the best one): ${keyword}
Video notes/transcript: ${notes.slice(0, 12000)}

OFFICIAL DATA (the only source of facts):
${(kb.o || 'none').slice(0, 8000)}

VOICE & RULES (follow strictly; never claim anything listed as off-limits):
${(kb.v || 'none').slice(0, 3000)}

PAST EXAMPLES (copy their structure, tone, formatting for title, description, tags, hashtags, FAQs):
${(kb.e || 'none').slice(0, 6000)}

SEO RESEARCH from top-10 ranking videos (entities, attributes, sentiment words):
${(kb.r || '').slice(0, 4000)}
${vr.slice(0, 4000)}

${chapters.length ? 'CHAPTER SECTIONS (timestamps are fixed; return a 3-5 word title for each, in the video language and channel voice, promising what that section gives, in "chapter_titles" in the same order; do NOT put timestamps or chapters inside "description"):\n' + chapters.map((c, i) => (i + 1) + '. ' + c.t + ' - ' + String(c.text).slice(0, 250)).join('\n') + '\n' : ''}
Rules:
- Keep the SAME language/script as the original (Hindi/Hinglish/Marathi/English). Never change the video's meaning.
- Use ONLY facts from official data/notes. Never invent facts, prices, income or earning claims, guarantees, or medical claims.
- Weave the research entities, attributes and sentiment words naturally into title, description, tags and FAQs. No keyword stuffing, do not copy competitor text. Aim to naturally cover at least 70% of the research terms.
- Title: 45-60 chars (desktop search cuts at 60), primary keyword in the first 40 chars (mobile feed cuts at 40), at most two ALL-CAPS words, a number/name/date beats adjectives, 1-2 strongest research terms, click-worthy but honest. Also give 3 title_options with different angles (curiosity, benefit, how-to), each 45-60 chars, keyword in the first 40 chars; set "title" to the one you think will rank and get clicked best.
- LENGTH (most important): description + FAQs + hashtags combined must be between ${cmin} and ${cmax} characters (about ${wmin}-${wmax} words). The YouTube description box must look fully used, like a human SEO expert wrote it: keyword in first 150 chars, strong intro, detailed sections (what the video covers, who it is for, key takeaways, step-by-step points), keyword variations, about the brand/channel, original timestamps/links/CTAs kept. Never pad with repeated sentences or invented facts. No hashtags and no FAQs inside "description".
- FAQs: 6-10 Q&A, answers 1-3 sentences, based on official data. They count toward the length.
- Thumbnail: "thumbnail.text" max 3 words and must NOT repeat the title's words (same promise, different words); "thumbnail.brief": expression, framing, and what the background must do to keep contrast at feed size.
- "queries": the 3 search queries a real person would type that this video should win (in the video language); the title and the first two description lines must contain the words of those queries.
- Description structure: first paragraph (before the first blank line) = two lines saying what the viewer gets in the words they would type, plus the main link/resource from the original description; chapters are inserted by the app after that paragraph; then the long version.
- Tags (weak signal; use for disambiguation: alternate spellings, tool/brand names, abbreviations, common misspellings): 8-15, total under 450 characters. Hashtags: exactly 3-5, each starting with #.
Return ONLY JSON: {"keyword":"","title":"","title_options":[{"angle":"","title":""}],"description":"","faqs":[{"q":"","a":""}],"chapter_titles":[],"thumbnail":{"text":"","brief":""},"queries":[],"tags":[],"hashtags":[]}`;
  const ask = async msgs => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-5-5', max_tokens: 8000, messages: msgs })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'AI error');
    return j.content.map(c => c.text || '').join('');
  };
  try {
    const msgs = [{ role: 'user', content: prompt }];
    const mid = (cmin + cmax) / 2;
    let best = null, bestLen = 0;
    for (let i = 0; i < 4; i++) {
      const text = await ask(msgs);
      let out;
      try { out = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch (e) { if (best) break; throw e; }
      const L = compose(out, chapters).length;
      if (!best || Math.abs(L - mid) < Math.abs(bestLen - mid)) { best = out; bestLen = L; }
      if (L >= cmin && L <= cmax) break;
      msgs.push({ role: 'assistant', content: text }, { role: 'user', content: `Combined length (description + FAQs + hashtags) is ${L} characters but it must be between ${cmin} and ${cmax}. ${L < cmin ? 'Add about ' + (cmin - L + 150) + ' more characters of genuinely useful, non-repeating content (more detail sections, takeaways, FAQs)' : 'Cut about ' + (L - cmax + 150) + ' characters'}. Return the full JSON again.` });
    }
    return res.status(200).json({ ...best, _len: bestLen });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
