// De.fault — background service worker
// API key lives in _config.js (gitignored) — never in source control.
importScripts('config.js');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.85,
        maxOutputTokens: 1024
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  const suggestions = JSON.parse(text);
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('No suggestions returned');
  }
  return suggestions.slice(0, 3);
}

function buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc) {
  return `You are De.fault, a de-personalization engine. Surface what lies UNDER or AROUND a topic — never confirm what the user already knows.

The user is browsing: "${context}"
Curiosity intent: "${intent}"
Content angle: ${contentTypeDesc}
Disciplinary lens — ${disciplineKey}: ${disciplineDesc}

Generate exactly 3 real content suggestions (real articles, videos, or podcasts from well-known publishers) that illuminate "${context}" through the ${disciplineKey} lens. Make them genuinely unexpected — things never found in a personalized feed, yet meaningfully connected.

Return a JSON array only:
[
  {
    "title": "Exact article or video title",
    "source": "Publisher or channel name",
    "type": "ARTICLE",
    "description": "One sentence on why this expands perspective",
    "imageQuery": "3-4 word visual theme"
  }
]

Use ARTICLE, VIDEO, or AUDIO for type. Vary types.`;
}
