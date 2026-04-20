const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'CHECK_API_KEY') {
    chrome.storage.local.get('apiKey').then(({ apiKey }) => {
      sendResponse({ hasKey: Boolean(apiKey && apiKey.trim()) });
    });
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc }) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY');

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(context, intent, contentTypeDesc) }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Could not parse suggestions from Claude response');

  const suggestions = JSON.parse(match[0]);
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('No suggestions returned');
  }

  return suggestions.slice(0, 3);
}

function buildPrompt(context, intent, contentTypeDesc) {
  return `You are De.fault, a de-personalization engine. Your mission is to expand perspective — not confirm it.

The user is currently browsing about: "${context}"
Detected user intent: "${intent}"
Explore this angle: "${contentTypeDesc}"

Generate exactly 3 real content suggestions (real articles, videos, or podcasts from well-known publishers) that sit at the intersection of this intent and content angle. Prioritize genuinely unexpected but meaningfully adjacent content — things the user would never encounter in a personalized feed.

Respond with ONLY a valid JSON array. No markdown, no explanation, no code fences — just raw JSON:
[
  {
    "title": "Title of the real content piece",
    "source": "Publisher or channel name",
    "type": "ARTICLE",
    "description": "One sentence on why this expands perspective on the topic",
    "imageQuery": "3-4 word visual theme"
  }
]

Use "ARTICLE", "VIDEO", or "AUDIO" for type. Vary types across the 3 suggestions when possible.`;
}
