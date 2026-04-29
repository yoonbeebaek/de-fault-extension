// De.fault — background service worker
// Uses Chrome Built-in AI (Prompt API / Gemini Nano) — no external API key needed.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    fetchSuggestions(message.payload)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function fetchSuggestions({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  const ai = self.ai?.languageModel;
  if (!ai) {
    throw new Error(
      'Chrome AI not available. ' +
      'Go to chrome://flags, enable "Prompt API for Gemini Nano" and restart Chrome.'
    );
  }

  const caps = await ai.capabilities();
  if (caps.available === 'no') {
    throw new Error('Chrome AI is not supported on this device.');
  }
  if (caps.available === 'after-download') {
    throw new Error('Chrome AI model is still downloading — wait a moment and try again.');
  }

  const session = await ai.create({
    temperature: 0.9,
    topK: 40,
    systemPrompt:
      `You are De.fault, a de-personalization engine. ` +
      `Surface what lies UNDER or AROUND topics — never confirm what the user already knows. ` +
      `Disciplinary lens — ${disciplineKey}: ${disciplineDesc}. ` +
      `Respond with a valid JSON array only. No markdown, no explanation.`
  });

  let responseText;
  try {
    responseText = await session.prompt(buildPrompt(context, intent, contentTypeDesc));
  } finally {
    session.destroy();
  }

  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse suggestions from AI response.');

  const suggestions = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw new Error('No suggestions returned.');
  }
  return suggestions.slice(0, 3);
}

function buildPrompt(context, intent, contentTypeDesc) {
  return `The user is browsing: "${context}"
Curiosity intent: "${intent}"
Content angle: ${contentTypeDesc}

Generate exactly 3 content suggestions that illuminate "${context}" from unexpected but meaningful angles.
Suggest real articles, videos, or podcasts — things a person would NEVER find in their personalized feed.

Return ONLY this JSON array (no markdown, no commentary):
[
  {"title":"exact title","source":"publisher or channel name","type":"ARTICLE","description":"one sentence on why this expands perspective","imageQuery":"3-4 word visual theme"},
  {"title":"...","source":"...","type":"VIDEO","description":"...","imageQuery":"..."},
  {"title":"...","source":"...","type":"AUDIO","description":"...","imageQuery":"..."}
]`;
}
