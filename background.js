// De.fault — background service worker
// API key lives in config.js (gitignored) — never in source control.
importScripts('config.js');

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: 'You are De.fault, a de-personalization engine. You return ONLY a valid JSON array — no markdown, no explanation, no code fences. Your output must be parseable by JSON.parse().',
      messages: [{
        role: 'user',
        content: buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc)
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  // Strip any accidental markdown code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const suggestions = JSON.parse(cleaned);
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('No suggestions returned');
  }
  return suggestions.slice(0, 3);
}

function buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc) {
  return `Surface what lies UNDER or AROUND a topic — never confirm what the user already knows.

The user is browsing: "${context}"
Detected curiosity intent: "${intent}"
Content angle to explore: ${contentTypeDesc}
Disciplinary lens — ${disciplineKey}: ${disciplineDesc}

Generate exactly 3 real content suggestions (real articles, videos, or podcasts from well-known publishers) that illuminate "${context}" through the ${disciplineKey} lens, at the "${intent}" × content angle intersection.

Rules:
- Suggestions must be genuinely unexpected — things never found in a personalized feed, yet meaningfully connected
- Each suggestion must fit the content angle precisely (not just thematically related)
- Vary the content types (use a mix of ARTICLE, VIDEO, AUDIO)
- Use real, verifiable titles and publishers

Return a JSON array only (no markdown, no explanation):
[
  {
    "title": "Exact article or video title",
    "source": "Publisher or channel name",
    "type": "ARTICLE",
    "description": "One sentence on why this expands perspective",
    "imageQuery": "3-4 word visual theme"
  }
]`;
}
