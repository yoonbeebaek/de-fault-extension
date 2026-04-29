// De.fault — background service worker
// window.ai only exists in the tab's MAIN world, not in a service worker.
// We bridge via chrome.scripting.executeScript (world: 'MAIN').

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_SUGGESTIONS') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No tab context — try reloading the page.' });
      return true;
    }
    chrome.scripting
      .executeScript({
        target: { tabId },
        world: 'MAIN',
        func: mainWorldAI,
        args: [message.payload]
      })
      .then(results => {
        if (!results || !results[0]) {
          sendResponse({ ok: false, error: 'Script injection failed — check extension permissions.' });
          return;
        }
        const r = results[0].result;
        if (r?.ok) sendResponse({ ok: true, data: r.data });
        else sendResponse({ ok: false, error: r?.error || 'AI call failed.' });
      })
      .catch(err => sendResponse({ ok: false, error: 'executeScript error: ' + err.message }));
    return true;
  }
});

// ─── Injected into the tab's MAIN world ────────────────────────
// Must be fully self-contained — no closures from service worker scope.
// Probes all known Chrome AI namespace variants (API changed across Chrome versions).
async function mainWorldAI({ context, intent, contentTypeDesc, disciplineKey, disciplineDesc }) {
  // Chrome AI namespace evolved across versions — probe all variants:
  //   Chrome 127-130: window.ai.languageModel
  //   Chrome 131+:    global LanguageModel  (no window.ai prefix)
  const langModel =
    (typeof LanguageModel !== 'undefined' && typeof LanguageModel.create === 'function'
      ? LanguageModel : null) ||
    window.ai?.languageModel ||
    (typeof window.ai?.create === 'function' ? window.ai : null);

  if (!langModel) {
    // Diagnostic: show what IS available so we can understand the Chrome state
    const hasWindowAI = typeof window.ai !== 'undefined';
    const aiKeys = hasWindowAI ? Object.keys(window.ai) : [];
    const hasLM = typeof LanguageModel !== 'undefined';
    return {
      ok: false,
      error:
        `Chrome AI not found. ` +
        `[window.ai=${hasWindowAI}, keys=(${aiKeys.join('|') || 'none'}), LanguageModel=${hasLM}] ` +
        `— enable "Prompt API for Gemini Nano" in chrome://flags and restart Chrome.`
    };
  }

  try {
    // availability() = Chrome 131+, capabilities() = Chrome 127-130
    if (typeof langModel.availability === 'function') {
      const avail = await langModel.availability();
      if (avail === 'unavailable')
        return { ok: false, error: 'Chrome AI not supported on this device.' };
      if (avail === 'downloading')
        return { ok: false, error: 'Chrome AI model is still downloading — try again in a moment.' };
    } else if (typeof langModel.capabilities === 'function') {
      const caps = await langModel.capabilities();
      if (caps.available === 'no')
        return { ok: false, error: 'Chrome AI not supported on this device.' };
      if (caps.available === 'after-download')
        return { ok: false, error: 'Chrome AI model is still downloading — try again in a moment.' };
    }

    const session = await langModel.create({
      temperature: 0.9,
      topK: 40,
      systemPrompt:
        'You are De.fault, a de-personalization engine. ' +
        'Surface what lies UNDER or AROUND topics — never confirm what the user already knows. ' +
        `Disciplinary lens — ${disciplineKey}: ${disciplineDesc}. ` +
        'Respond with a valid JSON array only. No markdown, no explanation.'
    });

    let responseText;
    try {
      responseText = await session.prompt(
        `The user is browsing: "${context}"\n` +
        `Curiosity intent: "${intent}"\n` +
        `Content angle: ${contentTypeDesc}\n\n` +
        'Generate exactly 3 content suggestions that illuminate this topic from unexpected but meaningful angles. ' +
        'Suggest real articles, videos, or podcasts — things a person would NEVER find in their personalized feed.\n\n' +
        'Return ONLY this JSON array (no markdown, no extra text):\n' +
        '[{"title":"exact title","source":"publisher name","type":"ARTICLE","description":"one sentence why this expands perspective","imageQuery":"3-4 word visual theme"},' +
        '{"title":"...","source":"...","type":"VIDEO","description":"...","imageQuery":"..."},' +
        '{"title":"...","source":"...","type":"AUDIO","description":"...","imageQuery":"..."}]'
      );
    } finally {
      session.destroy();
    }

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { ok: false, error: 'Could not parse AI response.' };

    const suggestions = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(suggestions) || !suggestions.length)
      return { ok: false, error: 'No suggestions returned.' };

    return { ok: true, data: suggestions.slice(0, 3) };
  } catch (e) {
    return { ok: false, error: e.message || 'AI call failed.' };
  }
}
