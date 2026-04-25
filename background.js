const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Built-in key — works out of the box. Override via chrome.storage if needed.
const BUILT_IN_KEY = 'REDACTED_KEY_1';

async function getApiKey() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return (apiKey && apiKey.trim()) ? apiKey.trim() : BUILT_IN_KEY;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.type === 'CHECK_API_KEY') {
    sendResponse({ hasKey: true }); // always ready
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc }) {
  const apiKey = await getApiKey();

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(context, intent, contentTypeDesc) }] }],
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

function buildPrompt(context, intent, contentTypeDesc) {
  return `You are De.fault, a de-personalization engine. Your mission is to expand perspective — not confirm it.

The user is currently browsing about: "${context}"
Detected user intent: "${intent}"
Explore this angle: "${contentTypeDesc}"

Generate exactly 3 real content suggestions (real articles, videos, or podcasts from well-known publishers) at the intersection of this intent and content angle. Prioritize genuinely unexpected but meaningfully adjacent content the user would never encounter in a personalized feed.

Return a JSON array with exactly 3 objects:
[
  {
    "title": "Title of the real content piece",
    "source": "Publisher or channel name",
    "type": "ARTICLE",
    "description": "One sentence on why this expands perspective",
    "imageQuery": "3-4 word visual theme"
  }
]

Use "ARTICLE", "VIDEO", or "AUDIO" for type. Vary types when possible.`;
}
