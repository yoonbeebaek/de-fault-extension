// De.fault — background service worker
// Uses Chrome's built-in on-device AI (Gemini Nano via window.ai Prompt API).
// No API key required. Requires Chrome 127+.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  if (!('ai' in self) || !('languageModel' in self.ai)) {
    throw new Error('Chrome built-in AI not found. Update Chrome to version 127 or later.');
  }

  const { available } = await self.ai.languageModel.capabilities();
  if (available === 'no') {
    throw new Error('On-device AI is not supported on this hardware.');
  }
  // 'after-download' means the model is downloading — create() will wait for it

  const session = await self.ai.languageModel.create({
    systemPrompt:
      'You are De.fault, a de-personalization engine. ' +
      'You respond ONLY with a valid JSON array — no markdown, no explanation, just the raw JSON.',
    temperature: 0.9,
    topK: 40
  });

  let text;
  try {
    text = await session.prompt(buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc));
  } finally {
    session.destroy();
  }

  // Extract outermost JSON array from response
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('AI response did not contain a JSON array');

  const suggestions = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('No suggestions in AI response');
  }
  return suggestions.slice(0, 3);
}

function buildPrompt(context, intent, contentTypeDesc, disciplineKey, disciplineDesc) {
  return `The user is browsing: "${context}"
Curiosity intent: "${intent}"
Content angle: ${contentTypeDesc}
Disciplinary lens — ${disciplineKey}: ${disciplineDesc}

Return a JSON array of exactly 3 real content suggestions from well-known publishers that explore "${context}" through the ${disciplineKey} lens. Make them unexpected and perspective-expanding — things the user would never find in a personalized feed.

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
