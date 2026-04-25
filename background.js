const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// API key is stored in chrome.storage.local — never hardcoded in source.
// Inject once via DevTools console on the extension's service worker:
//   chrome.storage.local.set({ apiKey: 'AIza...' })

async function getApiKey() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  return (apiKey && apiKey.trim()) ? apiKey.trim() : null;
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

async function fetchSuggestions({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('No API key set. Open the service worker console and run:\nchrome.storage.local.set({ apiKey: "AIza..." })');

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
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
  return `You are De.fault, a de-personalization engine. Your mission is to surface what lies UNDER or AROUND a topic — not to confirm what the user already knows.

The user is browsing about: "${context}"
Detected curiosity intent: "${intent}"

Content angle to explore: ${contentTypeDesc}

Disciplinary lens — ${disciplineKey}: ${disciplineDesc}

Generate exactly 3 real content suggestions (real articles, videos, or podcasts from well-known publishers) that illuminate "${context}" from the ${disciplineKey} disciplinary perspective through the above angle. Each suggestion should feel genuinely unexpected — something the user would never encounter in a personalized feed, yet meaningfully connected.

Return a JSON array with exactly 3 objects:
[
  {
    "title": "Title of the real content piece",
    "source": "Publisher or channel name",
    "type": "ARTICLE",
    "description": "One sentence on why this piece expands perspective through the ${disciplineKey} lens",
    "imageQuery": "3-4 word visual theme"
  }
]

Use "ARTICLE", "VIDEO", or "AUDIO" for type. Vary types when possible.`;
}
