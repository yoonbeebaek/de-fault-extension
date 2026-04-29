// De.fault — offscreen document
// This is an extension page, so window.ai IS available here (unlike service workers).
// Background.js creates this document and routes AI calls to it.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'df-offscreen') return false;
  if (message.type === 'AI_FETCH') {
    runAI(message.payload)
      .then(sendResponse)
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open
  }
});

async function runAI({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  // Chrome AI namespace changed across versions — probe all variants
  const lm =
    (typeof LanguageModel !== 'undefined' && typeof LanguageModel.create === 'function'
      ? LanguageModel : null)
    ?? window.ai?.languageModel
    ?? (typeof window.ai?.create === 'function' ? window.ai : null);

  if (!lm) {
    const hasAI   = typeof window.ai !== 'undefined';
    const aiKeys  = hasAI ? Object.keys(window.ai) : [];
    const hasLM   = typeof LanguageModel !== 'undefined';
    return {
      ok: false,
      error:
        `Gemini Nano not found. ` +
        `[window.ai=${hasAI}, keys=(${aiKeys.join('|') || 'none'}), LanguageModel=${hasLM}] ` +
        `— check chrome://components and search "Optimization Guide On Device Model", then click Update.`
    };
  }

  // Check availability — method name changed in Chrome 131+
  if (typeof lm.availability === 'function') {
    const s = await lm.availability();
    if (s === 'unavailable')
      return { ok: false, error: 'Gemini Nano not supported on this device.' };
    if (s === 'downloading')
      return { ok: false, error: 'Gemini Nano model is downloading — wait a moment and retry.' };
  } else if (typeof lm.capabilities === 'function') {
    const c = await lm.capabilities();
    if (c.available === 'no')
      return { ok: false, error: 'Gemini Nano not supported on this device.' };
    if (c.available === 'after-download')
      return { ok: false, error: 'Gemini Nano model is downloading — wait a moment and retry.' };
  }

  // Keep prompt short — Gemini Nano has a small context window
  const session = await lm.create({
    temperature: 0.9,
    topK: 40,
    systemPrompt:
      `You are De.fault. Lens: ${disciplineKey} (${disciplineDesc}). ` +
      `Output valid JSON array only, no markdown.`
  });

  let text;
  try {
    text = await session.prompt(
      `Topic: "${context}". Intent: "${intent}". Angle: ${contentTypeDesc}.\n` +
      `3 surprising but real content suggestions (articles/videos/podcasts).\n` +
      `[{"title":"...","source":"...","type":"ARTICLE","description":"...","imageQuery":"..."},` +
      `{"title":"...","source":"...","type":"VIDEO","description":"...","imageQuery":"..."},` +
      `{"title":"...","source":"...","type":"AUDIO","description":"...","imageQuery":"..."}]`
    );
  } finally {
    session.destroy();
  }

  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return { ok: false, error: 'AI response was not valid JSON. Raw: ' + text.slice(0, 120) };

  let suggestions;
  try {
    suggestions = JSON.parse(match[0]);
  } catch (e) {
    return { ok: false, error: 'JSON parse failed: ' + e.message };
  }

  if (!Array.isArray(suggestions) || !suggestions.length)
    return { ok: false, error: 'AI returned an empty suggestions array.' };

  return { ok: true, data: suggestions.slice(0, 3) };
}
