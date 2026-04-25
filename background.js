// De.fault — background service worker
// Uses Pollinations.ai text API — free, no API key, no user setup required.

const POLLINATIONS_URL = 'https://text.pollinations.ai/';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const response = await fetch(POLLINATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'You are De.fault, a de-personalization engine. ' +
            'You respond ONLY with a valid JSON array — no markdown fences, no explanation, just the raw JSON.'
        },
        {
          role: 'user',
          content: buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc)
        }
      ],
      model: 'openai',
      jsonMode: true,
      temperature: 0.85,
      seed: Math.floor(Math.random() * 99999)
    })
  });

  if (!response.ok) throw new Error(`Request failed (${response.status})`);

  let text = await response.text();

  // Pollinations may wrap in OpenAI chat-completion format
  try {
    const obj = JSON.parse(text);
    if (obj?.choices?.[0]?.message?.content) {
      text = obj.choices[0].message.content;
    } else if (Array.isArray(obj)) {
      return validated(obj);
    }
  } catch {}

  // Strip markdown code fences if present
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Extract outermost JSON array
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start !== -1 && end !== -1) {
    try { return validated(JSON.parse(text.slice(start, end + 1))); } catch {}
  }

  // Last resort: try parsing the whole cleaned text
  try { return validated(JSON.parse(text)); } catch {}

  throw new Error('Could not parse AI response — try again');
}

function validated(arr) {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty suggestions from AI');
  return arr.slice(0, 3);
}

function buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc) {
  return `The user is browsing: "${context}"
Curiosity intent: "${intent}"
Content angle: ${contentTypeDesc}
Disciplinary lens — ${disciplineKey}: ${disciplineDesc}

Return a JSON array of exactly 3 real content suggestions from well-known publishers that explore "${context}" through the ${disciplineKey} lens. Make them unexpected — things never found in a personalized feed, yet meaningfully connected.

[
  {
    "title": "Exact article or video title",
    "source": "Publisher or channel name",
    "type": "ARTICLE",
    "description": "One sentence on why this expands perspective",
    "imageQuery": "3-4 word visual theme"
  }
]

Use ARTICLE, VIDEO, or AUDIO for type. Vary types. Output the JSON array only.`;
}
